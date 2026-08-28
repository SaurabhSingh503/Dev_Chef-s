from typing import Literal
from pydantic import BaseModel, Field, HttpUrl, field_validator


class DocumentInput(BaseModel):
    document_id: str | None = Field(None, max_length=120)
    title: str = Field(min_length=1, max_length=300)
    document_type: Literal["standard", "handbook", "technical", "certification", "testing", "organization", "regulatory", "other"] = "other"
    text: str | None = Field(None, max_length=5_000_000)
    content_base64: str | None = Field(None, max_length=100_000_000)
    file_name: str | None = Field(None, max_length=300)
    source: str | None = Field(None, max_length=1000)
    category: str | None = Field(None, max_length=100)
    industry: str | None = Field(None, max_length=100)
    language: str | None = Field(None, max_length=30)
    version: str | None = Field(None, max_length=100)
    publication_date: str | None = Field(None, max_length=30)
    effective_date: str | None = Field(None, max_length=30)

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str | None) -> str | None:
        if value and not (value.startswith("http://") or value.startswith("https://") or value.startswith("urn:") or value.startswith("internal:")):
            raise ValueError("source must be a URL, URN, or internal reference")
        return value

class IngestResponse(BaseModel):
    document_id: str
    status: Literal["ready"]
    chunks_created: int
    message: str

class SearchFilters(BaseModel):
    document_type: str | None = None
    industry: str | None = None
    category: str | None = None
    language: str | None = None
    document_id: str | None = None

class SearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=4000)
    top_k: int = Field(5, ge=1, le=20)
    filters: SearchFilters = Field(default_factory=SearchFilters)

class ChunkResponse(BaseModel):
    chunk_id: str
    text: str
    document_id: str
    document_title: str
    document_type: str
    source: str | None
    page: int | None
    section: str | None
    clause: str | None
    category: str | None
    industry: str | None
    language: str | None
    relevance: float
    file_name: str | None = None

class SearchResponse(BaseModel):
    results: list[ChunkResponse]

class QueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=4000)
    language: str = Field("en", min_length=2, max_length=30)
    top_k: int = Field(5, ge=1, le=12)
    filters: SearchFilters = Field(default_factory=SearchFilters)

class SourceResponse(BaseModel):
    title: str
    reference: str

class CitationResponse(BaseModel):
    document_id: str
    document_title: str
    page: int | None
    section: str | None
    clause: str | None
    chunk_id: str
    relevance: float
    source: str | None = None
    file_name: str | None = None

class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceResponse]
    citations: list[CitationResponse]
    confidence: int | None
    relatedStandards: list[str]
    suggestedQuestions: list[str]
    grounding: Literal["supported", "partially_supported", "insufficient_information"]

class DocumentResponse(BaseModel):
    document_id: str
    title: str
    document_type: str
    source: str | None
    category: str | None
    categories: list[str] | None = None
    industry: str | None
    language: str | None
    version: str | None
    publication_date: str | None
    effective_date: str | None
    file_name: str | None = None
    chunk_count: int
    status: str

class HealthResponse(BaseModel):
    status: Literal["ok"]
    environment: str
    dependencies: dict[str, str]
