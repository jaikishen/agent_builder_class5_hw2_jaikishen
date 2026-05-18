"""Integration tests for mongo_query — hit real MongoDB Atlas.

Run by default (per spec: integration tier uses live DB, no LLM). The seed
loaded by data/load_mongodb.py provides: 20 support_tickets, 27 flight_reviews,
40 user_activity_logs.
"""
from __future__ import annotations

import json


def test_find_open_support_tickets():
    """Filter by status — returns at least one Open ticket from the seed."""
    from backend.tools.mongo_query import mongo_query

    result = mongo_query.invoke({
        "collection": "support_tickets",
        "operation": "find",
        "filter": {"status": "Open"},
        "projection": {"ticket_id": 1, "status": 1, "_id": 0},
    })
    data = json.loads(result)
    assert data["total"] > 0, f"no Open tickets in seed? {data!r}"
    for row in data["rows"]:
        assert row["status"] == "Open"


def test_aggregate_avg_rating_by_flight():
    """Group flight_reviews by flight_number, sorted by avg ascending —
    confirms the safe pipeline stages all work against real Mongo."""
    from backend.tools.mongo_query import mongo_query

    pipeline = [
        {"$group": {
            "_id": "$flight_number",
            "avg_rating": {"$avg": "$rating"},
            "n": {"$sum": 1},
        }},
        {"$sort": {"avg_rating": 1}},
        {"$limit": 5},
    ]
    result = mongo_query.invoke({
        "collection": "flight_reviews",
        "operation": "aggregate",
        "pipeline": pipeline,
    })
    data = json.loads(result)
    assert data["total"] > 0, f"empty aggregate result: {data!r}"
    # Lowest-rated flight comes first.
    first = data["rows"][0]
    assert "_id" in first and "avg_rating" in first and "n" in first


def test_count_documents_real():
    """count_documents against support_tickets returns the seed count (20)."""
    from backend.tools.mongo_query import mongo_query

    result = mongo_query.invoke({
        "collection": "support_tickets",
        "operation": "count_documents",
        "filter": {},
    })
    data = json.loads(result)
    assert data["rows"] == [{"count": 20}], f"expected 20 support_tickets, got {data!r}"
