"""Integration test for handbook_search — real OpenAI embedding + real
Supabase pgvector RPC. Costs a few embedding tokens per run (cents per
hundred runs)."""
from __future__ import annotations

import json


def test_real_pet_policy_query():
    """A real semantic query should retrieve at least one chunk that mentions
    pets / animals — proves the embedder, vector index, and RPC all wire up."""
    from backend.tools.handbook_search import handbook_search

    result = handbook_search.invoke({"query": "pet travel policy", "k": 3})
    data = json.loads(result)

    assert data["total"] > 0, f"got no results: {data!r}"
    combined = " ".join(row["content"].lower() for row in data["rows"])
    assert "pet" in combined or "animal" in combined, (
        f"top chunks don't mention pets/animals: {combined[:300]!r}"
    )
    # similarities should be in [0, 1] and sorted descending.
    sims = [row["similarity"] for row in data["rows"]]
    for s in sims:
        assert 0.0 <= s <= 1.0
    assert sims == sorted(sims, reverse=True), f"results not sorted by similarity: {sims}"


def test_real_baggage_query():
    """A different topic to confirm semantic ranking isn't fixed on one answer."""
    from backend.tools.handbook_search import handbook_search

    result = handbook_search.invoke({"query": "checked baggage allowance", "k": 3})
    data = json.loads(result)

    assert data["total"] > 0
    combined = " ".join(row["content"].lower() for row in data["rows"])
    assert "baggage" in combined or "luggage" in combined or "kg" in combined, (
        f"top chunks don't mention baggage: {combined[:300]!r}"
    )
