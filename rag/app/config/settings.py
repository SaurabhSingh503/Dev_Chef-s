from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: str = Field("development", alias="RAG_ENV")
    host: str = Field("127.0.0.1", alias="RAG_HOST")
    port: int = Field(8000, alias="RAG_PORT")
    chunk_size: int = Field(900, alias="RAG_CHUNK_SIZE", ge=200, le=4000)
    chunk_overlap: int = Field(120, alias="RAG_CHUNK_OVERLAP", ge=0, le=1000)
    embedding_dimensions: int = Field(384, alias="RAG_EMBEDDING_DIMENSIONS", ge=64, le=4096)
    min_relevance: float = Field(0.08, alias="RAG_MIN_RELEVANCE", ge=0, le=1)
    database_url: str | None = Field(None, alias="DATABASE_URL")


@lru_cache
def get_settings() -> Settings:
    return Settings()
