"""One-shot ingest: handbook markdown -> chunks -> embeddings -> pgvector."""
from __future__ import annotations
import sys
from pathlib import Path

import psycopg
from langchain_text_splitters import MarkdownHeaderTextSplitter
from langchain_openai import OpenAIEmbeddings

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from settings import get_settings  # noqa: E402

HANDBOOK_PATH = Path(__file__).resolve().parent / "skynova_handbook.md"

HEADERS_TO_SPLIT_ON = [
    ("##", "section"),
    ("###", "subsection"),
]


def _chunk_handbook(markdown: str) -> list[dict]:
    splitter = MarkdownHeaderTextSplitter(headers_to_split_on=HEADERS_TO_SPLIT_ON)
    docs = splitter.split_text(markdown)
    out: list[dict] = []
    for d in docs:
        section = d.metadata.get("section") or d.metadata.get("subsection") or "preamble"
        out.append({
            "content": d.page_content,
            "metadata": {"source": "skynova_handbook", "section": section},
        })
    return out


def _ensure_table_exists(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "select 1 from information_schema.tables "
            "where table_schema='public' and table_name='documents'"
        )
        if cur.fetchone() is None:
            raise RuntimeError(
                "documents table missing — apply backend/migrations/001_pgvector.sql first"
            )


def ingest_handbook() -> int:
    s = get_settings()
    if not HANDBOOK_PATH.exists():
        raise FileNotFoundError(HANDBOOK_PATH)

    chunks = _chunk_handbook(HANDBOOK_PATH.read_text(encoding="utf-8"))
    if not chunks:
        raise RuntimeError("no chunks produced from handbook")

    embedder = OpenAIEmbeddings(
        model=s.embedding_model, api_key=s.openai_api_key,
    )
    vectors = embedder.embed_documents([c["content"] for c in chunks])

    with psycopg.connect(s.supabase_db_url) as conn:
        _ensure_table_exists(conn)
        with conn.cursor() as cur:
            cur.execute(
                "delete from documents where metadata->>'source' = 'skynova_handbook'"
            )
            for chunk, vec in zip(chunks, vectors):
                cur.execute(
                    "insert into documents (content, metadata, embedding) "
                    "values (%s, %s::jsonb, %s::vector)",
                    (chunk["content"],
                     psycopg.types.json.Json(chunk["metadata"]),
                     str(vec)),
                )
        conn.commit()

    print(f"Ingested {len(chunks)} chunks into documents table.")
    return len(chunks)


if __name__ == "__main__":
    sys.exit(0 if ingest_handbook() else 1)
