import hashlib
import math
import re
from abc import ABC, abstractmethod
from app.config.settings import Settings


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class SemanticEmbeddingProvider(EmbeddingProvider):
    def __init__(self, settings):
        from sentence_transformers import SentenceTransformer
        self._model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        self._dimensions = settings.embedding_dimensions
        if self._model.get_sentence_embedding_dimension() != self._dimensions:
            raise ValueError(f"Model dimensions ({self._model.get_sentence_embedding_dimension()}) don't match settings ({self._dimensions})")
            
    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        embeddings = self._model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()


def embedding_provider(settings: Settings) -> EmbeddingProvider:
    return SemanticEmbeddingProvider(settings)
