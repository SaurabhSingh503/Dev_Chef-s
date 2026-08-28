from app.api.schemas.contracts import DocumentInput, QueryRequest, SearchRequest
from app.services.chunker import Chunker, ChunkingConfig
from app.services.cleaner import DocumentCleaner
from app.services.embeddings import SemanticEmbeddingProvider
from app.services.ingestion import IngestionService
from app.services.parser import DocumentParser
from app.services.rag_service import RagService
from app.services.vector_search import VectorSearchService
from app.services.vector_store import InMemoryVectorStore
from app.config.settings import Settings


def build_services():
    settings = Settings(chunk_size=300, chunk_overlap=50, embedding_dimensions=384, min_relevance=0)
    store = InMemoryVectorStore(); provider = SemanticEmbeddingProvider(settings)
    ingestion = IngestionService(DocumentParser(), DocumentCleaner(), Chunker(ChunkingConfig(300, 50)), provider, store)
    search = VectorSearchService(provider, store, settings)
    return ingestion, search, RagService(search)


def test_ingest_search_and_grounded_response():
    ingestion, search, rag = build_services()
    ingestion.ingest(DocumentInput(document_id="is-demo", title="IS Demo Water Standard", document_type="standard", text="4.2 Water samples shall be tested for quality parameters before release.", source="internal:demo", category="quality", industry="water", language="en"))
    results = search.search(SearchRequest(query="water quality testing", top_k=3))
    assert results.results[0].document_id == "is-demo"
    response = rag.answer(QueryRequest(question="What testing is required for water?"))
    assert response.grounding in {"supported", "partially_supported"}
    assert response.citations[0].document_id == "is-demo"


def test_missing_knowledge_is_not_invented():
    _ingestion, _search, rag = build_services()
    response = rag.answer(QueryRequest(question="What does an unavailable standard require?"))
    assert response.grounding == "insufficient_information"
    assert response.citations == []
