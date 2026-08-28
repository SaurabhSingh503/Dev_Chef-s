from dataclasses import dataclass, field
from typing import Literal


DocumentType = Literal["standard", "handbook", "technical", "certification", "testing", "organization", "regulatory", "other"]


@dataclass(frozen=True)
class DocumentMetadata:
    document_id: str
    title: str
    document_type: DocumentType
    source: str | None = None
    category: str | None = None
    categories: list[str] | None = None
    industry: str | None = None
    language: str | None = None
    version: str | None = None
    publication_date: str | None = None
    effective_date: str | None = None
    file_name: str | None = None


@dataclass(frozen=True)
class ParsedPage:
    text: str
    page: int | None
    section: str | None = None


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    text: str
    metadata: DocumentMetadata
    page: int | None
    section: str | None
    clause: str | None = None


@dataclass(frozen=True)
class SearchResult:
    chunk: Chunk
    score: float


@dataclass
class StoredDocument:
    metadata: DocumentMetadata
    chunk_count: int
    status: Literal["ready", "failed"] = "ready"
    errors: list[str] = field(default_factory=list)
