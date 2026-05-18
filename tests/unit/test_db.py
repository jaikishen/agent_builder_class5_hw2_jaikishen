"""Unit tests for backend.db helpers."""
from __future__ import annotations


def test_parse_pg_url_with_at_in_password():
    """Reserved chars in the password must be percent-decoded into the kwargs.

    Supabase passwords commonly contain '@'. The raw URL has it percent-encoded
    as '%40'; urlparse handles the decode and we pass kwargs (not the URL) to
    psycopg to avoid the parser confusion described in test_connections.py.
    """
    from backend.db import _parse_pg_url

    url = "postgresql://alice:p%40ss@db.example.com:5432/skynova"
    kw = _parse_pg_url(url)

    assert kw["host"] == "db.example.com"
    assert kw["port"] == 5432
    assert kw["user"] == "alice"
    assert kw["password"] == "p@ss"
    assert kw["dbname"] == "skynova"


def test_parse_pg_url_defaults_port_and_dbname():
    """Missing port falls back to 5432; missing dbname falls back to 'postgres'."""
    from backend.db import _parse_pg_url

    kw = _parse_pg_url("postgresql://u:p@h")
    assert kw["port"] == 5432
    assert kw["dbname"] == "postgres"


def test_get_mongo_db_uses_settings_db(monkeypatch):
    """get_mongo_db() returns the database named by settings.mongodb_db and
    constructs MongoClient with settings.mongodb_uri. Module-level cached."""
    from backend import db

    captured: dict = {}

    class _FakeDB:
        def __init__(self, name):
            self.name = name

    class _FakeClient:
        def __init__(self, uri, **kwargs):
            captured["uri"] = uri
            captured["kwargs"] = kwargs

        def __getitem__(self, name):
            return _FakeDB(name)

    # Reset module cache, swap in fake
    monkeypatch.setattr(db, "_mongo_client", None, raising=False)
    monkeypatch.setattr(db, "MongoClient", _FakeClient)

    out = db.get_mongo_db()

    assert isinstance(out, _FakeDB)
    assert out.name == "skynova"  # comes from .env (settings.mongodb_db)
    assert captured["uri"].startswith("mongodb+srv://")


def test_get_pg_conn_uses_dict_row_factory(monkeypatch):
    """get_pg_conn must pass row_factory=dict_row so we get dict rows back.

    We don't hit a real DB here — patch psycopg.connect to capture kwargs and
    assert on them. The integration test in cycle 11 covers real connectivity.
    """
    from backend import db
    from psycopg.rows import dict_row

    captured: dict = {}

    class _FakeConnCtx:
        def __enter__(self):
            return "fake-conn"
        def __exit__(self, *exc):
            return False

    def _fake_connect(**kwargs):
        captured["kwargs"] = kwargs
        return _FakeConnCtx()

    monkeypatch.setattr(db.psycopg, "connect", _fake_connect)

    with db.get_pg_conn("postgresql://u:p%40w@h:5432/skynova") as conn:
        assert conn == "fake-conn"

    assert captured["kwargs"]["row_factory"] is dict_row
    assert captured["kwargs"]["host"] == "h"
    assert captured["kwargs"]["port"] == 5432
    assert captured["kwargs"]["user"] == "u"
    assert captured["kwargs"]["password"] == "p@w"
    assert captured["kwargs"]["dbname"] == "skynova"
