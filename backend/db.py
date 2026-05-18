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
