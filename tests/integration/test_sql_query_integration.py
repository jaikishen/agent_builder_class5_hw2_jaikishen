"""Integration tests for sql_query — hit real Supabase Postgres.

Per spec these run by default with `pytest tests/unit tests/integration` or
plain `pytest`. They use the credentials in .env and expect the SkyNova seed
to be loaded (25 customers).
"""
from __future__ import annotations

import json


def test_select_count_customers():
    """End-to-end happy path: returns the JSON-wrapped row from the seed."""
    from backend.tools.sql_query import sql_query

    result = sql_query.invoke({"sql": "SELECT COUNT(*) AS n FROM customers"})
    data = json.loads(result)

    assert data["truncated"] is False
    assert data["total"] == 1, f"COUNT(*) should produce one row: {data!r}"
    assert data["rows"] == [{"n": 25}], f"expected 25 customers, got {data['rows']!r}"


def test_group_by_returns_grouped_rows():
    """Non-trivial query: GROUP BY loyalty_tier returns one row per tier."""
    from backend.tools.sql_query import sql_query

    result = sql_query.invoke({
        "sql": "SELECT loyalty_tier, COUNT(*) AS n FROM customers GROUP BY 1 ORDER BY 1",
    })
    data = json.loads(result)

    assert data["total"] >= 2, f"expected several tiers, got {data!r}"
    tiers = {row["loyalty_tier"] for row in data["rows"]}
    assert tiers, "no tiers returned"
    assert sum(row["n"] for row in data["rows"]) == 25


def test_postgres_error_is_returned_as_string():
    """When the SQL is syntactically valid but Postgres rejects it (e.g. unknown
    column), sql_query must return an ERROR string so the agent can react and
    retry — never raise out of the tool."""
    from backend.tools.sql_query import sql_query

    result = sql_query.invoke({"sql": "SELECT nonexistent_col FROM customers"})

    assert isinstance(result, str)
    assert result.startswith("ERROR:"), f"expected ERROR string, got: {result!r}"
    assert "nonexistent_col" in result or "does not exist" in result.lower()
