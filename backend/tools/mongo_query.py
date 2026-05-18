"""SkyNova read-only MongoDB tool for the ReAct agent.

Hardened against destructive operations: collection whitelist, banned
aggregation stages, $where blocked recursively in filters. Returns a
JSON-encoded wrapper dict so the LLM sees the same envelope as sql_query.
"""
from __future__ import annotations

import json
from typing import Literal

from langchain_core.tools import tool
from pymongo.errors import PyMongoError

from backend.db import get_mongo_db

_ALLOWED_COLLECTIONS: frozenset[str] = frozenset({
    "support_tickets", "flight_reviews", "user_activity_logs",
})

_ALLOWED_STAGES: frozenset[str] = frozenset({
    "$match", "$group", "$sort", "$limit", "$project",
})


def _check_pipeline(pipeline: list[dict]) -> str | None:
    """Return a refusal string if any stage is outside the safe allow-list,
    or if `$where` appears anywhere in the pipeline. Returns None when OK."""
    for stage in pipeline:
        if not isinstance(stage, dict) or not stage:
            return f"REFUSED: pipeline stage must be a non-empty dict, got {stage!r}."
        # Each stage dict has exactly one operator key.
        for op in stage:
            if op not in _ALLOWED_STAGES:
                allowed = ", ".join(sorted(_ALLOWED_STAGES))
                return (
                    f"REFUSED: aggregation stage {op!r} is not allowed. "
                    f"Allowed: {allowed}."
                )
        if _contains_where(stage):
            return "REFUSED: $where (server-side JS) is not allowed in pipelines."
    return None


def _contains_where(value) -> bool:
    """Return True if a `$where` operator appears anywhere in a dict/list tree."""
    if isinstance(value, dict):
        if "$where" in value:
            return True
        return any(_contains_where(v) for v in value.values())
    if isinstance(value, list):
        return any(_contains_where(item) for item in value)
    return False


@tool
def mongo_query(
    collection: str,
    operation: Literal["find", "aggregate", "count_documents"],
    filter: dict | None = None,
    projection: dict | None = None,
    pipeline: list[dict] | None = None,
    sort: list | None = None,
    limit: int = 50,
) -> str:
    """Read-only query against MongoDB Atlas.

    Allowed collections: support_tickets, flight_reviews, user_activity_logs.
    Allowed aggregation stages: $match, $group, $sort, $limit, $project.
    `$where` is blocked anywhere in filters and pipelines.

    Returns a JSON string of {rows, truncated, shown, total}, matching the
    sql_query envelope.
    """
    if collection not in _ALLOWED_COLLECTIONS:
        allowed = ", ".join(sorted(_ALLOWED_COLLECTIONS))
        return (
            f"REFUSED: collection {collection!r} is not in the whitelist. "
            f"Allowed: {allowed}."
        )

    if filter and _contains_where(filter):
        return "REFUSED: $where (server-side JS) is not allowed in filters."

    if operation == "aggregate":
        pl = pipeline or []
        refusal = _check_pipeline(pl)
        if refusal:
            return refusal

    from settings import get_settings
    cap = get_settings().sql_default_limit
    effective_limit = max(1, min(int(limit), cap))

    db = get_mongo_db()
    coll = db[collection]

    try:
        if operation == "find":
            cursor = coll.find(filter or {}, projection)
            if sort:
                cursor = cursor.sort([tuple(pair) for pair in sort])
            cursor = cursor.limit(effective_limit)
            rows = list(cursor)
        elif operation == "aggregate":
            rows = list(coll.aggregate(pipeline or []))
        elif operation == "count_documents":
            n = coll.count_documents(filter or {})
            rows = [{"count": n}]
        else:  # pragma: no cover — Literal already constrains operation
            return f"REFUSED: unknown operation {operation!r}."
    except PyMongoError as exc:
        return f"ERROR: {type(exc).__name__}: {str(exc).strip()}"

    total = len(rows)
    wrapped = {
        "rows": rows,
        "truncated": False,
        "shown": total,
        "total": total,
    }
    return json.dumps(wrapped, default=str)
