from app.api.schemas.contracts import DocumentInput, IngestResponse
from app.models.domain import StoredDocument
from app.services.chunker import Chunker
from app.services.cleaner import DocumentCleaner
from app.services.embeddings import EmbeddingProvider
from app.services.metadata import metadata_from_input
from app.services.parser import DocumentParser, ParseInput
from app.services.vector_store import VectorRecord, VectorStore


class IngestionService:
    def __init__(self, parser: DocumentParser, cleaner: DocumentCleaner, chunker: Chunker, embeddings: EmbeddingProvider, store: VectorStore):
        self._parser, self._cleaner, self._chunker, self._embeddings, self._store = parser, cleaner, chunker, embeddings, store

    def ingest(self, document: DocumentInput) -> IngestResponse:
        metadata = metadata_from_input(document)
        pages = self._cleaner.clean(self._parser.parse(ParseInput(document.text, document.content_base64, document.file_name)))
        chunks = self._chunker.create(pages, metadata)
        if not chunks: raise ValueError("Document contains no usable knowledge chunks after cleaning")
        vectors = []
        valid_chunks = []
        for chunk in chunks:
            try:
                vec = self._embeddings.embed([chunk.text])[0]
                vectors.append(vec)
                valid_chunks.append(chunk)
            except ValueError:
                continue
                
        if not valid_chunks: raise ValueError("Document contains no valid chunks after embedding")
        
        self._store.upsert(StoredDocument(metadata=metadata, chunk_count=len(valid_chunks)), [VectorRecord(chunk, vector) for chunk, vector in zip(valid_chunks, vectors, strict=True)])
        return IngestResponse(document_id=metadata.document_id, status="ready", chunks_created=len(valid_chunks), message="Document ingested and available for retrieval")
