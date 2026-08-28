from fastapi import APIRouter
from app.api.schemas.contracts import QueryRequest, QueryResponse, SearchRequest, SearchResponse
from app.services.container import rag_service, search_service

router = APIRouter(tags=["retrieval"])

@router.post("/search", response_model=SearchResponse)
def search(request: SearchRequest) -> SearchResponse: return search_service.search(request)

@router.post("/query", response_model=QueryResponse)
def query(request: QueryRequest) -> QueryResponse: return rag_service.answer(request)
