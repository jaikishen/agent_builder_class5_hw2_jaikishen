"""Unit tests for the sql_query LangChain tool.

These tests must not hit a real database. Cycle 11 in tests/integration covers
the real DB roundtrip.
"""
from __future__ import annotations


import pytest


def test_tool_metadata():
    """The @tool decoration exposes a name, description, and `sql: str` arg."""
    from backend.tools.sql_query import sql_query

    assert sql_query.name == "sql_query"
    assert sql_query.description, "tool description should be non-empty"
    # args_schema is a Pydantic model; check the 'sql' field is required & a str.
    fields = sql_query.args_schema.model_fields
    assert "sql" in fields
    assert fields["sql"].annotation is str


@pytest.mark.parametrize("empty_sql", ["", "   ", "\n\t", "  \n  "])
def test_rejects_empty_sql(empty_sql):
    """Empty / whitespace-only input must be refused, not sent to Postgres."""
    from backend.tools.sql_query import sql_query

    result = sql_query.invoke({"sql": empty_sql})
    assert isinstance(result, str)
    assert result.startswith("REFUSED:"), f"expected refusal, got: {result!r}"
    assert "empty" in result.lower()


def test_rejects_multi_statement():
    """Two statements separated by ';' must be refused — defends against
    SQL-injection style chained statements even if the LLM tries it."""
    from backend.tools.sql_query import sql_query

    result = sql_query.invoke({"sql": "SELECT 1; SELECT 2"})
    assert result.startswith("REFUSED:")
    assert "multi-statement" in result.lower()


def test_allows_trailing_semicolon():
    """A single trailing ';' is valid SQL and must not trigger the multi-stmt guard."""
    from backend.tools.sql_query import sql_query

    result = sql_query.invoke({"sql": "SELECT 1;"})
    assert "multi-statement" not in result.lower(), (
        f"trailing ; falsely flagged as multi-statement: {result!r}"
    )


@pytest.mark.parametrize("sql", [
    "UPDATE customers SET loyalty_tier = 'Gold' WHERE customer_id = 1",
    "DELETE FROM customers WHERE customer_id = 1",
    "DROP TABLE customers",
    "INSERT INTO customers (name) VALUES ('mallory')",
    "TRUNCATE customers",
    "ALTER TABLE customers ADD COLUMN x int",
])
def test_rejects_non_select_leading_keyword(sql):
    """Anything that doesn't start with SELECT (or WITH) must be refused."""
    from backend.tools.sql_query import sql_query

    result = sql_query.invoke({"sql": sql})
    assert result.startswith("REFUSED:"), f"expected refusal for {sql!r}, got: {result!r}"


@pytest.mark.parametrize("sql", [
    # DML hidden in a CTE — leading WITH is allowed but body contains a write.
    "WITH x AS (DELETE FROM customers RETURNING *) SELECT * FROM x",
    "WITH x AS (INSERT INTO customers (name) VALUES ('m') RETURNING *) SELECT * FROM x",
    "WITH x AS (UPDATE customers SET name='m' RETURNING *) SELECT * FROM x",
    # DDL embedded somewhere after the leading SELECT.
    "SELECT * FROM customers; DROP TABLE foo",  # multi-stmt also catches this, both fine
    "SELECT * FROM customers WHERE 1=1 OR (DROP TABLE foo)",
])
def test_rejects_dangerous_keyword_anywhere(sql):
    """Banned keywords must be refused even when they appear after the leading SELECT/WITH."""
    from backend.tools.sql_query import sql_query

    result = sql_query.invoke({"sql": sql})
    assert result.startswith("REFUSED:"), f"expected refusal for {sql!r}, got: {result!r}"


@pytest.mark.parametrize("sql", [
    # Keyword appears inside a single-quoted string literal — must NOT trip the check.
    "SELECT 'INSERT' AS label FROM customers",
    "SELECT 'DELETE FROM x' AS sample_text FROM customers",
    # Keyword is a substring of a real identifier — \b should prevent the match.
    "SELECT created_at FROM customers",
    # Keyword appears inside a line comment — comment stripping must run before regex.
    "SELECT * FROM customers -- DROP TABLE foo",
    # Keyword appears inside a block comment — block stripping must run before regex.
    "SELECT 1 /* DELETE */ FROM customers",
    # Combined: literal + comment + substring.
    "SELECT created_at, 'INSERT' AS lbl FROM customers /* DROP */",
])
def test_allows_keywords_in_strings_substrings_and_comments(sql):
    """False-positive defense: literals, substrings, and comments are NOT keywords."""
    from backend.tools.sql_query import sql_query

    result = sql_query.invoke({"sql": sql})
    assert not result.startswith("REFUSED:"), f"falsely refused {sql!r}: {result!r}"


def test_allows_cte():
    """A CTE that wraps a SELECT (no DML inside) must pass all guardrails."""
    from backend.tools.sql_query import sql_query

    result = sql_query.invoke({"sql": "WITH x AS (SELECT 1 AS n) SELECT * FROM x"})
    assert not result.startswith("REFUSED:"), f"valid CTE falsely refused: {result!r}"


def test_apply_limit_appends_when_absent():
    """When no LIMIT clause is present, default LIMIT must be appended."""
    from backend.tools.sql_query import _apply_limit

    out = _apply_limit("SELECT * FROM customers", default=200)
    assert out == "SELECT * FROM customers LIMIT 200"


@pytest.mark.parametrize("sql", [
    "SELECT * FROM customers LIMIT 5",
    "SELECT * FROM customers limit 5",  # lowercase variant
    "SELECT * FROM customers\nLIMIT  42",  # whitespace variations
])
def test_apply_limit_preserves_existing(sql):
    """Existing LIMIT (any case / whitespace) must be left untouched."""
    from backend.tools.sql_query import _apply_limit

    assert _apply_limit(sql, default=200) == sql


def test_truncate_under_caps_returns_all():
    """When rows fit under both caps, return everything with truncated=False."""
    from backend.tools.sql_query import _truncate

    rows = [{"i": i} for i in range(5)]
    out = _truncate(rows, max_rows=50, max_bytes=8192)
    assert out == {"rows": rows, "truncated": False, "shown": 5, "total": 5}


def test_truncate_row_cap_fires():
    """When row count exceeds max_rows, keep the first max_rows and flag truncation."""
    from backend.tools.sql_query import _truncate

    rows = [{"i": i} for i in range(100)]
    out = _truncate(rows, max_rows=50, max_bytes=8192)
    assert out["shown"] == 50
    assert out["total"] == 100
    assert out["truncated"] is True
    assert out["rows"] == rows[:50]


def test_truncate_byte_cap_fires():
    """When the row count fits but the JSON payload exceeds max_bytes, drop tail rows."""
    from backend.tools.sql_query import _truncate

    rows = [{"i": i, "name": "x" * 50} for i in range(20)]
    out = _truncate(rows, max_rows=100, max_bytes=200)
    assert out["truncated"] is True
    assert out["shown"] < 20
    assert out["total"] == 20
