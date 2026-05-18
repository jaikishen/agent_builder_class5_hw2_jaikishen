"""SkyNova read-only SQL tool for the ReAct agent.

Hardened against writes via regex guardrails. Auto-injects LIMIT. Returns a
JSON-encoded wrapper dict so the LLM can see truncation state at a glance.
"""
from __future__ import annotations

import json
import re

import psycopg
from langchain_core.tools import tool

from backend.db import get_pg_conn
from settings import get_settings

_LEADING_KEYWORD_RE = re.compile(r"^\s*(SELECT|WITH)\b", re.IGNORECASE)

_DANGEROUS_KEYWORDS = (
    "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER",
    "GRANT", "REVOKE", "CREATE", "MERGE", "VACUUM", "COPY",
    "CALL", "DO", "EXEC", "EXECUTE",
)
_DANGEROUS_KEYWORDS_RE = re.compile(
    r"\b(" + "|".join(_DANGEROUS_KEYWORDS) + r")\b", re.IGNORECASE,
)

_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
_LINE_COMMENT_RE = re.compile(r"--[^\n]*")
_SINGLE_QUOTE_STR_RE = re.compile(r"'(?:[^']|'')*'")
_DOUBLE_QUOTE_ID_RE = re.compile(r'"(?:[^"]|"")*"')

_LIMIT_RE = re.compile(r"\bLIMIT\s+\d+", re.IGNORECASE)


def _apply_limit(sql: str, default: int) -> str:
    """Append `LIMIT {default}` if the query has no LIMIT clause.

    Known limitation: a LIMIT in a subquery satisfies this check too. Not
    worth fixing for SkyNova scale — the tool's truncation step also caps
    rows defensively.
    """
    if _LIMIT_RE.search(sql):
        return sql
    return f"{sql} LIMIT {default}"


def _truncate(rows: list, max_rows: int = 50, max_bytes: int = 8192) -> dict:
    """Cap the result set by both row count and JSON byte size.

    Returns a wrapper dict — `{rows, truncated, shown, total}` — so the LLM
    can see the cap state in one glance and ask for narrower queries when
    `truncated=True`.
    """
    total = len(rows)
    kept = list(rows[:max_rows])
    while kept and len(json.dumps(kept, default=str).encode("utf-8")) > max_bytes:
        kept.pop()
    return {
        "rows": kept,
        "truncated": len(kept) < total,
        "shown": len(kept),
        "total": total,
    }


def _strip_comments_and_literals(sql: str) -> str:
    """Replace block/line comments and quoted strings with spaces.

    Keyword regex runs against the cleaned text so 'SELECT \\'INSERT\\' AS x'
    and 'SELECT 1 -- DROP TABLE foo' do NOT trigger false positives.
    """
    sql = _BLOCK_COMMENT_RE.sub(" ", sql)
    sql = _LINE_COMMENT_RE.sub(" ", sql)
    sql = _SINGLE_QUOTE_STR_RE.sub(" ", sql)
    sql = _DOUBLE_QUOTE_ID_RE.sub(" ", sql)
    return sql


@tool
def sql_query(sql: str) -> str:
    """Run a read-only SQL SELECT against the SkyNova Postgres store.

    Only SELECT (and WITH ... SELECT) statements are allowed; writes, DDL,
    multi-statements, and dangerous keywords are refused before execution.
    A LIMIT is auto-injected if absent.
    """
    if not sql or not sql.strip():
        return "REFUSED: empty SQL — pass a non-empty SELECT statement."

    # Strip a single trailing ';' (valid SQL); reject anything beyond that.
    stripped = sql.rstrip().rstrip(";").rstrip()
    if ";" in stripped:
        return "REFUSED: multi-statement queries are not allowed."

    if not _LEADING_KEYWORD_RE.match(stripped):
        return "REFUSED: only SELECT (or WITH ... SELECT) statements are allowed."

    cleaned = _strip_comments_and_literals(stripped)
    banned = _DANGEROUS_KEYWORDS_RE.search(cleaned)
    if banned:
        return f"REFUSED: dangerous keyword '{banned.group(0).upper()}' is not allowed."

    settings = get_settings()
    safe_sql = _apply_limit(stripped, default=settings.sql_default_limit)
    try:
        with get_pg_conn() as conn, conn.cursor() as cur:
            cur.execute(f"SET LOCAL statement_timeout = {int(settings.sql_timeout_ms)}")
            cur.execute(safe_sql)
            rows = cur.fetchall()
    except psycopg.Error as exc:
        # Surface DB errors as tool output so the agent can adjust its query,
        # rather than crashing the ReAct loop.
        return f"ERROR: {type(exc).__name__}: {str(exc).strip()}"

    wrapped = _truncate(rows, max_rows=50, max_bytes=8192)
    return json.dumps(wrapped, default=str)
