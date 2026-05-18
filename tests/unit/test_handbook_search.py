"""Unit tests for the handbook_search LangChain tool.

These tests must not hit OpenAI or Postgres. The integration test in
tests/integration/test_handbook_search_integration.py covers the real
embed + match_documents RPC round-trip.
"""
from __future__ import annotations

import json

import pytest


# --- Fakes -------------------------------------------------------------------

class _FakeEmbedder:
    """Mimics LangChain's OpenAIEmbeddings.embed_query — returns a fixed vector."""
    def __init__(self, vector=None):
        self.vector = vector if vector is not None else [0.0] * 1536
        self.calls: list[str] = []

    def embed_query(self, text: str) -> list[float]:
        self.calls.append(text)
        return self.vector


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows
        self.executed: list[tuple] = []

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchall(self):
        return list(self._rows)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeConn:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _install_fakes(monkeypatch, *, rows, embedder=None):
    """Patch the tool's embedder factory + get_pg_conn so nothing hits the network."""
    import backend.tools.handbook_search as hs

    embedder = embedder or _FakeEmbedder()
    cursor = _FakeCursor(rows)
    conn = _FakeConn(cursor)

    monkeypatch.setattr(hs, "_get_embedder", lambda: embedder)
    monkeypatch.setattr(hs, "get_pg_conn", lambda: conn)
    return embedder, cursor


# --- Cycle 1 -----------------------------------------------------------------

def test_tool_metadata():
    """@tool decoration exposes name, description, and `query: str` arg."""
    from backend.tools.handbook_search import handbook_search

    assert handbook_search.name == "handbook_search"
    assert handbook_search.description, "tool description should be non-empty"
    fields = handbook_search.args_schema.model_fields
    assert "query" in fields
    assert fields["query"].annotation is str


@pytest.mark.parametrize("empty", ["", "   ", "\n\t", "  \n  "])
def test_rejects_empty_query(empty, monkeypatch):
    """Empty / whitespace-only queries must be refused — never reach OpenAI."""
    from backend.tools.handbook_search import handbook_search

    # Install fakes anyway so if the tool accidentally proceeds, we'd see it.
    embedder, _ = _install_fakes(monkeypatch, rows=[])

    result = handbook_search.invoke({"query": empty})

    assert result.startswith("REFUSED:"), f"expected refusal, got: {result!r}"
    assert "empty" in result.lower()
    assert embedder.calls == [], "embedder should NOT have been called for empty query"


@pytest.mark.parametrize("k_in,k_expected", [
    (0, 1),
    (-5, 1),
    (4, 4),
    (10, 10),
    (15, 10),
    (999, 10),
])
def test_clamps_k(k_in, k_expected, monkeypatch):
    """LLM-supplied k is clamped to [1, 10] before the RPC is called.
    Verified by inspecting the captured params of the SQL execute."""
    from backend.tools.handbook_search import handbook_search

    _, cursor = _install_fakes(monkeypatch, rows=[])

    handbook_search.invoke({"query": "anything", "k": k_in})

    assert cursor.executed, "RPC should have been executed"
    _, params = cursor.executed[0]
    assert params[1] == k_expected, (
        f"k_in={k_in}: expected clamped {k_expected}, got {params[1]}"
    )


def test_returns_wrapper_dict_with_section_and_similarity(monkeypatch):
    """Happy path: embedder fires, RPC returns chunks, tool returns the
    wrapper dict shape with section pulled from metadata and similarity rounded."""
    from backend.tools.handbook_search import handbook_search

    rows = [
        {"id": 7, "content": "Section 3.5 on delay compensation: ...",
         "metadata": {"section": "3.5 Delay compensation"}, "similarity": 0.8734},
        {"id": 12, "content": "Section 5.1 on special assistance: ...",
         "metadata": {"section": "5.1 Special assistance"}, "similarity": 0.6101},
    ]
    embedder, _ = _install_fakes(monkeypatch, rows=rows)

    result = handbook_search.invoke({"query": "delay compensation"})

    data = json.loads(result)
    assert data["truncated"] is False
    assert data["total"] == 2
    assert data["shown"] == 2
    assert len(data["rows"]) == 2

    row0 = data["rows"][0]
    assert row0["section"] == "3.5 Delay compensation"
    assert row0["content"].startswith("Section 3.5")
    assert isinstance(row0["similarity"], float)
    assert 0.87 <= row0["similarity"] <= 0.88  # rounded

    # Embedder was called once with the user's query.
    assert embedder.calls == ["delay compensation"]


def test_content_trimmed_to_500_chars(monkeypatch):
    """A 2000-char chunk gets truncated to 500 chars in the output row, so the
    tool's response stays under the LLM's per-tool budget."""
    from backend.tools.handbook_search import handbook_search

    long_content = "X" * 2000
    _install_fakes(monkeypatch, rows=[{
        "id": 1, "content": long_content,
        "metadata": {"section": "Test"}, "similarity": 0.9,
    }])

    result = handbook_search.invoke({"query": "anything"})
    data = json.loads(result)
    assert len(data["rows"][0]["content"]) == 500


@pytest.mark.parametrize("md", [None, {}, {"source": "skynova_handbook"}])
def test_section_falls_back_to_preamble_when_missing(md, monkeypatch):
    """Some chunks have no `section` key in metadata (content above the first
    `##` heading). Those should surface as `"preamble"`, not crash."""
    from backend.tools.handbook_search import handbook_search

    _install_fakes(monkeypatch, rows=[{
        "id": 1, "content": "Welcome to SkyNova.",
        "metadata": md, "similarity": 0.7,
    }])

    result = handbook_search.invoke({"query": "anything"})
    data = json.loads(result)
    assert data["rows"][0]["section"] == "preamble"


def test_embedder_error_returns_error_string(monkeypatch):
    """If OpenAI's embedding call fails, surface it as `"ERROR: ..."` so the
    agent can choose to retry or give up — not a raw traceback."""
    import backend.tools.handbook_search as hs

    class _BoomEmbedder:
        def embed_query(self, text):
            raise RuntimeError("simulated openai outage")

    monkeypatch.setattr(hs, "_get_embedder", lambda: _BoomEmbedder())
    # Don't need to install a fake conn — execution should fail before that.

    result = hs.handbook_search.invoke({"query": "anything"})
    assert result.startswith("ERROR:"), f"expected ERROR string, got: {result!r}"
    assert "simulated openai outage" in result


def test_pg_error_returns_error_string(monkeypatch):
    """If the match_documents RPC raises (e.g. extension missing in some env),
    surface it the same way."""
    import psycopg

    import backend.tools.handbook_search as hs

    class _BoomCursor:
        def execute(self, *a, **kw):
            raise psycopg.errors.OperationalError("simulated pg outage")
        def fetchall(self): return []
        def __enter__(self): return self
        def __exit__(self, *exc): return False

    class _BoomConn:
        def cursor(self): return _BoomCursor()
        def __enter__(self): return self
        def __exit__(self, *exc): return False

    monkeypatch.setattr(hs, "_get_embedder", lambda: _FakeEmbedder())
    monkeypatch.setattr(hs, "get_pg_conn", lambda: _BoomConn())

    result = hs.handbook_search.invoke({"query": "anything"})
    assert result.startswith("ERROR:"), f"expected ERROR string, got: {result!r}"
    assert "simulated pg outage" in result
