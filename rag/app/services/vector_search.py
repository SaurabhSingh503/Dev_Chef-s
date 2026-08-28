from app.api.schemas.contracts import ChunkResponse, SearchFilters, SearchRequest, SearchResponse
from app.config.settings import Settings
from app.services.embeddings import EmbeddingProvider
from app.services.vector_store import VectorStore


class VectorSearchService:
    def __init__(self, embeddings: EmbeddingProvider, store: VectorStore, settings: Settings): self._embeddings, self._store, self._settings = embeddings, store, settings
    def search(self, request: SearchRequest) -> SearchResponse:
        import re
        vector = self._embeddings.embed([request.query])[0]
        filters = request.filters.model_dump()
        
        # Explicit standard-number routing
        match = re.search(r'\b(IS|SP)[\s-]*(\d+(?:[-/]\d+)*)\b', request.query, re.IGNORECASE)
        explicit_doc_id = None
        if match:
            prefix = match.group(1).upper()
            number = match.group(2)
            # Find a matching document in the store
            for doc in self._store.documents():
                if doc.metadata.source and prefix in doc.metadata.source and number in doc.metadata.source:
                    explicit_doc_id = doc.metadata.document_id
                    break
        
        if explicit_doc_id:
            filters['document_id'] = explicit_doc_id
            
        matches = [match for match in self._store.search(vector, filters, request.top_k) if match.score >= self._settings.min_relevance or explicit_doc_id]
        
        # Fallback if strict filter yields nothing
        if not matches and explicit_doc_id:
            filters.pop('document_id')
            matches = [match for match in self._store.search(vector, filters, request.top_k) if match.score >= self._settings.min_relevance]
            
        return SearchResponse(results=[self._to_response(match) for match in matches])
    @staticmethod
    def _to_response(match) -> ChunkResponse:
        chunk = match.chunk; metadata = chunk.metadata
        return ChunkResponse(chunk_id=chunk.chunk_id,text=chunk.text,document_id=metadata.document_id,document_title=metadata.title,document_type=metadata.document_type,source=metadata.source,page=chunk.page,section=chunk.section,clause=chunk.clause,category=metadata.category,industry=metadata.industry,language=metadata.language,relevance=round(max(0, match.score), 4),file_name=metadata.file_name)
