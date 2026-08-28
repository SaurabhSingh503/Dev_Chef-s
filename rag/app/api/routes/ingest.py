from fastapi import APIRouter, HTTPException, status
from app.api.schemas.contracts import DocumentInput, IngestResponse
from app.services.container import ingestion_service
from app.services.parser import DocumentParseError

router = APIRouter(tags=["ingestion"])

@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
def ingest(document: DocumentInput) -> IngestResponse:
    try: return ingestion_service.ingest(document)
    except (DocumentParseError, ValueError) as error: raise HTTPException(status_code=422, detail={"code":"INGESTION_ERROR", "message":str(error)}) from error
