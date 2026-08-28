from fastapi import APIRouter
from app.api.schemas.contracts import HealthResponse
from app.services.container import settings

router = APIRouter(tags=["health"])

@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", environment=settings.environment, dependencies={"embedding_provider":"development_deterministic", "vector_store":"development_in_memory", "llm_provider":"not_configured"})
