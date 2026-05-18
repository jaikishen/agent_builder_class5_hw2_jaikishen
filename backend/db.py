"""Shared Postgres helpers for the SkyNova backend.

Both the agent's `sql_query` tool and the handbook_search RPC call go through
`get_pg_conn()` so the URL-parsing quirks (reserved chars in the password) are
fixed once, here.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator
from urllib.parse import unquote, urlparse

import psycopg
from psycopg.rows import dict_row
from pymongo import MongoClient

_mongo_client: MongoClient | None = None


def _parse_pg_url(url: str) -> dict:
    """Parse a postgres URL into psycopg `connect()` kwargs.

    Passing fields as kwargs side-steps URL-parser confusion when the password
    contains reserved characters like '@'. urlparse percent-decodes username
    and password for us.
    """
    p = urlparse(url)
    return {
        "host": p.hostname,
        "port": p.port or 5432,
        "user": unquote(p.username or ""),
        "password": unquote(p.password or ""),
        "dbname": p.path.lstrip("/") or "postgres",
    }


@contextmanager
def get_pg_conn(url: str | None = None) -> Iterator[psycopg.Connection]:
    """Yield a psycopg connection with dict-row results.

    Defaults to `settings.supabase_db_url` if no url is passed.
    """
    if url is None:
        from settings import get_settings
        url = get_settings().supabase_db_url
    kwargs = _parse_pg_url(url)
    with psycopg.connect(row_factory=dict_row, **kwargs) as conn:
        yield conn


def get_mongo_db():
    """Return the SkyNova MongoDB database, lazily caching the client.

    Module-level cached because pymongo.MongoClient is thread-safe and is
    designed to be reused across the process.
    """
    global _mongo_client
    from settings import get_settings
    s = get_settings()
    if _mongo_client is None:
        _mongo_client = MongoClient(s.mongodb_uri, serverSelectionTimeoutMS=5000)
    return _mongo_client[s.mongodb_db]
