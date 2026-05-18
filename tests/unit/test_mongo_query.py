"""Unit tests for the mongo_query LangChain tool.

These tests must not hit a real MongoDB. The integration test in
tests/integration/test_mongo_query_integration.py covers the real round-trip.
"""
from __future__ import annotations

import json

import pytest


class _FakeCursor:
    """Mimics enough of a pymongo cursor for find()/aggregate() tests."""
    def __init__(self, docs):
        self._docs = list(docs)
        self.applied: dict = {}

    def sort(self, spec):
        self.applied["sort"] = spec
        return self

    def limit(self, n):
        self.applied["limit"] = n
        self._docs = self._docs[:n]
        return self

    def __iter__(self):
        return iter(self._docs)


class _FakeCollection:
    def __init__(self, docs=None):
        self._docs = list(docs or [])
        self.last_call: dict = {}

    def find(self, filter=None, projection=None):
        self.last_call = {"op": "find", "filter": filter, "projection": projection}
        cur = _FakeCursor(self._docs)
        self.last_call["cursor"] = cur
        return cur

    def count_documents(self, filter):
        self.last_call = {"op": "count_documents", "filter": filter}
        return len(self._docs)

    def aggregate(self, pipeline):
        self.last_call = {"op": "aggregate", "pipeline": pipeline}
        return _FakeCursor(self._docs)


class _FakeDB:
    def __init__(self, collection: _FakeCollection):
        self._coll = collection

    def __getitem__(self, name):
        return self._coll


def _install_fake_mongo(monkeypatch, docs=None):
    """Patch backend.tools.mongo_query.get_mongo_db to return our fake DB.
    Returns the FakeCollection so the test can introspect what was called."""
    coll = _FakeCollection(docs=docs)
    db = _FakeDB(coll)
    import backend.tools.mongo_query as mq
    monkeypatch.setattr(mq, "get_mongo_db", lambda: db)
    return coll


def test_tool_metadata():
    """@tool decoration exposes name, description, and the expected args."""
    from backend.tools.mongo_query import mongo_query

    assert mongo_query.name == "mongo_query"
    assert mongo_query.description, "tool description should be non-empty"
    fields = mongo_query.args_schema.model_fields
    for required_field in ("collection", "operation"):
        assert required_field in fields, f"missing required arg {required_field!r}"


@pytest.mark.parametrize("col", [
    "customers", "flights", "bookings", "randomstring", "", "documents",
])
def test_rejects_unknown_collection(col):
    """Anything outside the 3-collection whitelist must be refused before any
    Mongo call is attempted."""
    from backend.tools.mongo_query import mongo_query

    result = mongo_query.invoke({
        "collection": col,
        "operation": "find",
        "filter": {},
    })
    assert isinstance(result, str)
    assert result.startswith("REFUSED:"), f"expected refusal for {col!r}, got: {result!r}"
    assert "whitelist" in result.lower() or "not allowed" in result.lower()


@pytest.mark.parametrize("bad_filter", [
    {"$where": "this.x > 1"},                                    # top-level
    {"status": "Open", "$where": "fn()"},                        # mixed with normal fields
    {"$or": [{"status": "Open"}, {"$where": "1==1"}]},           # nested in $or
    {"meta": {"$where": "true"}},                                # nested one level deep
    {"a": {"b": [{"$where": "1"}, {"c": 1}]}},                   # deeply nested in list
])
def test_rejects_where_in_filter(bad_filter):
    """`$where` must be refused regardless of where it appears in the filter tree.
    Server-side JS is a remote-code-execution vector and the spec bans it."""
    from backend.tools.mongo_query import mongo_query

    result = mongo_query.invoke({
        "collection": "support_tickets",
        "operation": "find",
        "filter": bad_filter,
    })
    assert result.startswith("REFUSED:"), f"expected refusal for {bad_filter!r}, got: {result!r}"
    assert "$where" in result


@pytest.mark.parametrize("bad_stage", [
    "$lookup", "$out", "$merge", "$accumulator", "$function", "$where",
    "$unwind",        # not in our allow-list; spec only OKs match/group/sort/limit/project
    "$bizarre",       # any unknown stage
])
def test_rejects_banned_or_unknown_stage(bad_stage):
    """Any aggregation stage outside the safe allow-list must be refused."""
    from backend.tools.mongo_query import mongo_query

    result = mongo_query.invoke({
        "collection": "flight_reviews",
        "operation": "aggregate",
        "pipeline": [{bad_stage: {}}],
    })
    assert result.startswith("REFUSED:"), f"expected refusal for {bad_stage!r}, got: {result!r}"
    assert bad_stage in result


@pytest.mark.parametrize("good_stage", ["$match", "$group", "$sort", "$limit", "$project"])
def test_allows_safe_stages(good_stage, monkeypatch):
    """The 5 safe stages must pass guardrails and proceed to execution."""
    from backend.tools.mongo_query import mongo_query

    _install_fake_mongo(monkeypatch, docs=[])
    result = mongo_query.invoke({
        "collection": "flight_reviews",
        "operation": "aggregate",
        "pipeline": [{good_stage: {} if good_stage != "$limit" else 5}],
    })
    assert not result.startswith("REFUSED:"), f"falsely refused {good_stage!r}: {result!r}"


def test_find_returns_wrapper_dict(monkeypatch):
    """Happy path: find returns the {rows, truncated, shown, total} envelope
    used by sql_query, so the LLM sees a consistent shape."""
    from backend.tools.mongo_query import mongo_query

    docs = [{"ticket_id": f"TCK-{i}", "status": "Open"} for i in range(3)]
    _install_fake_mongo(monkeypatch, docs=docs)

    result = mongo_query.invoke({
        "collection": "support_tickets",
        "operation": "find",
        "filter": {"status": "Open"},
    })
    data = json.loads(result)
    assert data["truncated"] is False
    assert data["total"] == 3
    assert data["shown"] == 3
    assert data["rows"] == docs


def test_find_clamps_limit_to_settings(monkeypatch):
    """A LLM-supplied `limit=10_000` must be clamped to settings.sql_default_limit (200).
    Verified by inspecting what the fake cursor saw."""
    from backend.tools.mongo_query import mongo_query
    from settings import get_settings

    coll = _install_fake_mongo(monkeypatch, docs=[{"x": i} for i in range(500)])

    mongo_query.invoke({
        "collection": "support_tickets",
        "operation": "find",
        "filter": {},
        "limit": 10_000,
    })
    cap = get_settings().sql_default_limit  # 200
    assert coll.last_call["cursor"].applied["limit"] == cap


def test_find_passes_sort_and_projection(monkeypatch):
    """Optional `sort` and `projection` args round-trip into the cursor."""
    from backend.tools.mongo_query import mongo_query

    coll = _install_fake_mongo(monkeypatch, docs=[])
    mongo_query.invoke({
        "collection": "user_activity_logs",
        "operation": "find",
        "filter": {"customer_id": 13},
        "projection": {"action": 1, "_id": 0},
        "sort": [["timestamp", -1]],
        "limit": 10,
    })
    assert coll.last_call["filter"] == {"customer_id": 13}
    assert coll.last_call["projection"] == {"action": 1, "_id": 0}
    assert coll.last_call["cursor"].applied["sort"] == [("timestamp", -1)]
    assert coll.last_call["cursor"].applied["limit"] == 10


def test_aggregate_runs_pipeline(monkeypatch):
    """aggregate dispatches to coll.aggregate(pipeline) and returns the rows."""
    from backend.tools.mongo_query import mongo_query

    agg_rows = [
        {"_id": "SN401", "avg": 2.3, "n": 5},
        {"_id": "SN301", "avg": 1.8, "n": 3},
    ]
    coll = _install_fake_mongo(monkeypatch, docs=agg_rows)
    pipeline = [
        {"$group": {"_id": "$flight_number", "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
        {"$sort": {"avg": 1}},
    ]

    result = mongo_query.invoke({
        "collection": "flight_reviews",
        "operation": "aggregate",
        "pipeline": pipeline,
    })
    data = json.loads(result)

    assert coll.last_call["op"] == "aggregate"
    assert coll.last_call["pipeline"] == pipeline
    assert data["rows"] == agg_rows
    assert data["total"] == 2


def test_count_documents_returns_count(monkeypatch):
    """count_documents returns a wrapper dict with a single `{count: N}` row."""
    from backend.tools.mongo_query import mongo_query

    coll = _install_fake_mongo(monkeypatch, docs=[{"x": i} for i in range(7)])
    result = mongo_query.invoke({
        "collection": "support_tickets",
        "operation": "count_documents",
        "filter": {"status": "Open"},
    })
    data = json.loads(result)

    assert coll.last_call["op"] == "count_documents"
    assert coll.last_call["filter"] == {"status": "Open"}
    assert data["rows"] == [{"count": 7}]
    assert data["total"] == 1


def test_pymongo_error_returns_error_string(monkeypatch):
    """A pymongo error during execution becomes an "ERROR: ..." string so the
    agent can self-correct, paralleling the psycopg path in sql_query."""
    from pymongo.errors import OperationFailure

    from backend.tools.mongo_query import mongo_query

    class _RaisingCollection:
        last_call: dict = {}
        def find(self, *a, **kw):
            raise OperationFailure("simulated boom")

    class _RaisingDB:
        def __getitem__(self, name):
            return _RaisingCollection()

    import backend.tools.mongo_query as mq
    monkeypatch.setattr(mq, "get_mongo_db", lambda: _RaisingDB())

    result = mongo_query.invoke({
        "collection": "support_tickets",
        "operation": "find",
        "filter": {},
    })
    assert result.startswith("ERROR:"), f"expected ERROR string, got: {result!r}"
    assert "OperationFailure" in result
    assert "simulated boom" in result


def test_serializes_objectid_and_datetime(monkeypatch):
    """BSON-native types (ObjectId, datetime) must come back as strings inside
    the JSON envelope — `json.dumps(..., default=str)` is what does the work."""
    from datetime import datetime

    from bson import ObjectId

    from backend.tools.mongo_query import mongo_query

    oid = ObjectId()
    when = datetime(2026, 5, 1, 12, 34, 56)
    _install_fake_mongo(monkeypatch, docs=[{"_id": oid, "created_at": when, "n": 1}])

    result = mongo_query.invoke({
        "collection": "support_tickets",
        "operation": "find",
        "filter": {},
    })
    data = json.loads(result)
    row = data["rows"][0]
    assert row["_id"] == str(oid)
    assert "2026-05-01" in row["created_at"]
    assert row["n"] == 1
