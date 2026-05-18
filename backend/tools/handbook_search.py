"""Vector RAG over the SkyNova handbook via pgvector.

Embeds the user's query with OpenAI text-embedding-3-small, calls the
`match_documents` RPC against Supabase, and returns the top-k chunks with
their section labels. Same `{rows, truncated, shown, total}` envelope as
sql_query and mongo_query so the LLM sees a consistent shape.
"""
from __future__ import annotations

import json

from langchain_core.tools import tool

from backend.db import get_pg_conn

_embedder = None


def _get_embedder():
    """Lazy module-cached embedder. Tests monkeypatch this to inject a fake."""
    global _embedder
    if _embedder is None:
        from langchain_openai import OpenAIEmbeddings
        from settings import get_settings
        s = get_settings()
        _embedder = OpenAIEmbeddings(model=s.embedding_model, api_key=s.openai_api_key)
    return _embedder


@tool
def handbook_search(query: str, k: int = 4) -> str:
    """Semantic search over the SkyNova passenger handbook (baggage, refunds,
    delays, loyalty, special assistance, boarding, etc.).

    Returns top-k matching chunks ordered by cosine similarity to the query.
    Each row carries the original handbook section heading and a similarity
    score in [0, 1]. Use this for policy questions; for relational facts use
    sql_query, for tickets/reviews/activity use mongo_query.
    """
    if not query or not query.strip():
        return "REFUSED: empty query — pass a non-empty natural-language question."

    effective_k = max(1, min(int(k), 10))

    try:
        embedder = _get_embedder()
        vector = embedder.embed_query(query)

        with get_pg_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT id, content, metadata, similarity "
                "FROM match_documents(%s::vector, %s)",
                (str(vector), effective_k),
            )
            raw_rows = cur.fetchall()
    except Exception as exc:
        return f"ERROR: {type(exc).__name__}: {str(exc).strip()}"

    rows = [
        {
            "content": (r["content"] or "")[:500],
            "section": ((r.get("metadata") or {}).get("section") or "preamble"),
            "similarity": round(float(r["similarity"]), 4),
        }
        for r in raw_rows
    ]
    wrapped = {
        "rows": rows,
        "truncated": False,
        "shown": len(rows),
        "total": len(rows),
    }
    return json.dumps(wrapped, default=str)
