import math
import asyncio
import json
import asyncpg
from abc import ABC, abstractmethod
from dataclasses import dataclass
from threading import RLock
from app.models.domain import Chunk, SearchResult, StoredDocument, DocumentMetadata

@dataclass(frozen=True)
class VectorRecord:
    chunk: Chunk
    embedding: list[float]

class VectorStore(ABC):
    @abstractmethod
    def upsert(self, document: StoredDocument, records: list[VectorRecord]) -> None: ...
    @abstractmethod
    def search(self, query: list[float], filters: dict[str, str | None], top_k: int) -> list[SearchResult]: ...
    @abstractmethod
    def documents(self) -> list[StoredDocument]: ...
    @abstractmethod
    def document(self, document_id: str) -> StoredDocument | None: ...

class InMemoryVectorStore(VectorStore):
    """Process-local development store; replace through VectorStore when vector infrastructure is provisioned."""
    def __init__(self) -> None:
        self._lock = RLock(); self._records: dict[str, VectorRecord] = {}; self._documents: dict[str, StoredDocument] = {}

    def upsert(self, document: StoredDocument, records: list[VectorRecord]) -> None:
        with self._lock:
            self._records = {key: value for key, value in self._records.items() if value.chunk.metadata.document_id != document.metadata.document_id}
            self._records.update({record.chunk.chunk_id: record for record in records}); self._documents[document.metadata.document_id] = document

    def search(self, query: list[float], filters: dict[str, str | None], top_k: int) -> list[SearchResult]:
        with self._lock:
            results = [SearchResult(record.chunk, self._cosine(query, record.embedding)) for record in self._records.values() if self._matches(record.chunk, filters)]
        return sorted(results, key=lambda result: result.score, reverse=True)[:top_k]

    def documents(self) -> list[StoredDocument]:
        with self._lock: return list(self._documents.values())

    def document(self, document_id: str) -> StoredDocument | None:
        with self._lock: return self._documents.get(document_id)

    @staticmethod
    def _cosine(left: list[float], right: list[float]) -> float:
        denominator = math.sqrt(sum(v * v for v in left)) * math.sqrt(sum(v * v for v in right))
        return sum(a * b for a, b in zip(left, right)) / denominator if denominator else 0.0

    @staticmethod
    def _matches(chunk: Chunk, filters: dict[str, str | None]) -> bool:
        metadata = chunk.metadata
        return all(not value or str(getattr(metadata, key, "")) == value for key, value in filters.items())

class PgVectorStore(VectorStore):
    def __init__(self, dsn: str, dimensions: int = 256):
        self._dsn = dsn
        self._dimensions = dimensions

    def _run_async(self, coro):
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
        return loop.run_until_complete(coro)

    async def _upsert_async(self, document: StoredDocument, records: list[VectorRecord]) -> None:
        conn = await asyncpg.connect(self._dsn)
        try:
            async with conn.transaction():
                meta = document.metadata
                await conn.execute(
                    "INSERT INTO documents (id, title, type, category, metadata) VALUES ($1::uuid, $2, $3::document_type, $4, $5) ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata",
                    meta.document_id, meta.title, meta.document_type, meta.category, json.dumps({"document_type": meta.document_type, "category": meta.category, "source": meta.source, "file_name": meta.file_name})
                )
                
                for index, record in enumerate(records):
                    chunk = record.chunk
                    cmeta = chunk.metadata
                    await conn.execute(
                        "INSERT INTO document_chunks (id, document_id, content, chunk_index, page, section, clause, metadata) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata",
                        chunk.chunk_id, meta.document_id, chunk.text, index, chunk.page, chunk.section, chunk.clause, json.dumps({"title": cmeta.title, "document_type": cmeta.document_type, "category": cmeta.category, "source": cmeta.source, "file_name": cmeta.file_name})
                    )
                    await conn.execute(
                        "INSERT INTO chunk_vectors (chunk_id, embedding) VALUES ($1::uuid, $2::vector)",
                        chunk.chunk_id, json.dumps(record.embedding)
                    )
        finally:
            await conn.close()

    def upsert(self, document: StoredDocument, records: list[VectorRecord]) -> None:
        self._run_async(self._upsert_async(document, records))

    async def _search_async(self, query: list[float], filters: dict[str, str | None], top_k: int) -> list[SearchResult]:
        if len(query) != self._dimensions:
            raise ValueError(f"Vector dimension mismatch: expected {self._dimensions}, got {len(query)}")
            
        conn = await asyncpg.connect(self._dsn)
        try:
            import json
            # vector_cosine_ops distance is (embedding <=> $1). Score is 1 - distance.
            # Base query
            sql = """
                SELECT 
                    c.id as chunk_id, c.document_id, c.content, c.page, c.section, c.clause, c.metadata,
                    1 - (v.embedding <=> $1::vector) as relevance
                FROM chunk_vectors v
                JOIN document_chunks c ON c.id = v.chunk_id
            """
            
            # Filters
            conditions = []
            import json
            params = [json.dumps(query)]
            idx = 2
            
            # Optional: add filters on metadata if required
            # e.g., if 'category' in filters:
            for key, val in filters.items():
                if val:
                    conditions.append(f"c.metadata->>'{key}' = ${idx}")
                    params.append(val)
                    idx += 1
                    
            if conditions:
                sql += " WHERE " + " AND ".join(conditions)
                
            sql += f" ORDER BY v.embedding <=> $1::vector LIMIT {top_k}"
            
            rows = await conn.fetch(sql, *params)
            
            results = []
            for row in rows:
                meta_dict = json.loads(row['metadata']) if row['metadata'] else {}
                metadata = DocumentMetadata(
                    document_id=str(row['document_id']),
                    title=meta_dict.get('title', 'Unknown'),
                    document_type=meta_dict.get('document_type', 'other'),
                    source=meta_dict.get('source'),
                    category=meta_dict.get('category'),
                    categories=meta_dict.get('categories'),
                    industry=meta_dict.get('industry'),
                    language=meta_dict.get('language'),
                    file_name=meta_dict.get('file_name')
                )
                chunk = Chunk(
                    chunk_id=str(row['chunk_id']),
                    text=row['content'],
                    metadata=metadata,
                    page=row['page'],
                    section=row['section'],
                    clause=row['clause']
                )
                results.append(SearchResult(chunk=chunk, score=float(row['relevance'])))
            return results
        finally:
            await conn.close()

    def search(self, query: list[float], filters: dict[str, str | None], top_k: int) -> list[SearchResult]:
        return self._run_async(self._search_async(query, filters, top_k))

    async def _documents_async(self) -> list[StoredDocument]:
        import json
        conn = await asyncpg.connect(self._dsn)
        try:
            rows = await conn.fetch("SELECT id, title, type, category, metadata FROM documents")
            results = []
            for row in rows:
                meta_dict = json.loads(row['metadata']) if row['metadata'] else {}
                metadata = DocumentMetadata(
                    document_id=str(row['id']),
                    title=row['title'],
                    document_type=row['type'],
                    source=meta_dict.get('source'),
                    category=row['category'] or meta_dict.get('category'),
                    categories=meta_dict.get('categories'),
                    industry=meta_dict.get('industry'),
                    language=meta_dict.get('language'),
                    file_name=meta_dict.get('file_name')
                )
                results.append(StoredDocument(metadata=metadata, chunk_count=0, status="ready"))
            return results
        finally:
            await conn.close()

    def documents(self) -> list[StoredDocument]:
        return self._run_async(self._documents_async())
    
    def document(self, document_id: str) -> StoredDocument | None:
        docs = self.documents()
        for d in docs:
            if d.metadata.document_id == document_id:
                return d
        return None
