"""Verify MongoDB Atlas and Supabase connectivity from .env credentials.

Run:
    uv run python test_connections.py
"""
from __future__ import annotations

import os
import sys
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv

load_dotenv()

OK = "[ OK ]"
FAIL = "[FAIL]"


def _parse_pg_url(url: str) -> dict[str, object]:
    """Parse a postgres URL into psycopg connect() kwargs.

    Passing components as kwargs avoids needing to URL-encode reserved
    chars in the password (e.g. '@'). urlparse percent-decodes username
    and password automatically.
    """
    p = urlparse(url)
    return {
        "host": p.hostname,
        "port": p.port or 5432,
        "user": unquote(p.username or ""),
        "password": unquote(p.password or ""),
        "dbname": p.path.lstrip("/") or "postgres",
    }


def test_mongodb() -> bool:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError

    uri = os.environ.get("MONGODB_URI")
    db_name = os.environ.get("MONGODB_DB", "skynova")
    if not uri:
        print(f"{FAIL} MONGODB_URI not set in .env")
        return False

    print(f"\n--- MongoDB ---")
    print(f"  URI host: {urlparse(uri).hostname}")
    print(f"  DB:       {db_name}")
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        db = client[db_name]
        collections = db.list_collection_names()
        print(f"{OK} ping succeeded")
        print(f"  collections in '{db_name}': {collections or '(none)'}")
        for coll in ("support_tickets", "flight_reviews", "user_activity_logs"):
            count = db[coll].estimated_document_count() if coll in collections else 0
            print(f"  {coll}: {count} docs")
        client.close()
        return True
    except PyMongoError as exc:
        print(f"{FAIL} {type(exc).__name__}: {exc}")
        return False


def test_supabase_postgres() -> bool:
    import psycopg

    raw_url = os.environ.get("SUPABASE_DB_URL")
    if not raw_url:
        print(f"{FAIL} SUPABASE_DB_URL not set in .env")
        return False

    kwargs = _parse_pg_url(raw_url)

    print(f"\n--- Supabase Postgres (psycopg) ---")
    print(f"  host:     {kwargs['host']}:{kwargs['port']}")
    print(f"  user:     {kwargs['user']}")
    print(f"  db:       {kwargs['dbname']}")

    try:
        with psycopg.connect(connect_timeout=10, **kwargs) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
                print(f"{OK} connected")
                print(f"  server:   {version.split(',')[0]}")

                cur.execute(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public' ORDER BY table_name;"
                )
                tables = [r[0] for r in cur.fetchall()]
                print(f"  tables:   {tables or '(none)'}")
                for tbl in ("customers", "airports", "aircraft", "flights", "bookings"):
                    if tbl in tables:
                        cur.execute(f'SELECT COUNT(*) FROM "{tbl}";')
                        print(f"  {tbl}: {cur.fetchone()[0]} rows")
        return True
    except Exception as exc:
        print(f"{FAIL} {type(exc).__name__}: {exc}")
        return False


def test_supabase_rest() -> bool:
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    if not (url and key):
        print(f"{FAIL} SUPABASE_URL or SUPABASE_ANON_KEY not set in .env")
        return False

    print(f"\n--- Supabase REST (supabase-py) ---")
    print(f"  URL: {url}")
    try:
        client = create_client(url, key)
        resp = client.table("customers").select("customer_id", count="exact").limit(1).execute()
        print(f"{OK} REST call succeeded")
        print(f"  customers count: {resp.count}")
        return True
    except Exception as exc:
        msg = str(exc)
        if "permission denied" in msg.lower() or "row-level security" in msg.lower():
            print(f"{OK} reached API (RLS blocked anon read, which is normal)")
            print(f"  detail: {msg[:120]}")
            return True
        print(f"{FAIL} {type(exc).__name__}: {msg[:200]}")
        return False


def main() -> int:
    print("Loading .env from:", os.path.abspath(".env"))
    results = {
        "MongoDB Atlas":       test_mongodb(),
        "Supabase Postgres":   test_supabase_postgres(),
        "Supabase REST":       test_supabase_rest(),
    }
    print("\n=== Summary ===")
    for name, ok in results.items():
        print(f"  {OK if ok else FAIL} {name}")
    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
