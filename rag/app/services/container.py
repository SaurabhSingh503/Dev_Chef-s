from app.config.settings import get_settings
from app.services.chunker import Chunker, ChunkingConfig
from app.services.cleaner import DocumentCleaner
from app.services.embeddings import embedding_provider
from app.services.ingestion import IngestionService
from app.services.parser import DocumentParser
from app.services.rag_service import RagService
from app.services.vector_search import VectorSearchService
from app.services.vector_store import InMemoryVectorStore, PgVectorStore

settings = get_settings()
store = PgVectorStore(settings.database_url, settings.embedding_dimensions) if settings.database_url else InMemoryVectorStore()
embeddings = embedding_provider(settings)
ingestion_service = IngestionService(DocumentParser(), DocumentCleaner(), Chunker(ChunkingConfig(settings.chunk_size, settings.chunk_overlap)), embeddings, store)
search_service = VectorSearchService(embeddings, store, settings)
rag_service = RagService(search_service)
