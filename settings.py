"""Application settings, loaded once from .env at the repo root."""
from __future__ import annotations
from functools import lru_cache
from pathlib import Path
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    mongodb_uri: str = Field(..., alias="MONGODB_URI")
    mongodb_db: str = Field(..., alias="MONGODB_DB")
    supabase_db_url: str = Field(..., alias="SUPABASE_DB_URL")
    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_anon_key: str = Field(..., alias="SUPABASE_ANON_KEY")

    model_name: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    max_iterations: int = 10
    cors_origins: List[str] = ["http://localhost:5173"]
    sql_timeout_ms: int = 5000
    sql_default_limit: int = 200


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton accessor; reused by every backend module."""
    return Settings()