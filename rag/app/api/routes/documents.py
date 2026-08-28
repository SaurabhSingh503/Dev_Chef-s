from fastapi import APIRouter, HTTPException
from app.api.schemas.contracts import DocumentResponse
from app.services.container import store

router = APIRouter(prefix="/documents", tags=["documents"])

def response(document) -> DocumentResponse:
    metadata=document.metadata
    return DocumentResponse(document_id=metadata.document_id,title=metadata.title,document_type=metadata.document_type,source=metadata.source,category=metadata.category,categories=metadata.categories,industry=metadata.industry,language=metadata.language,version=metadata.version,publication_date=metadata.publication_date,effective_date=metadata.effective_date,file_name=metadata.file_name,chunk_count=document.chunk_count,status=document.status)

@router.get("", response_model=list[DocumentResponse])
def list_documents() -> list[DocumentResponse]: return [response(document) for document in store.documents()]

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str) -> DocumentResponse:
    document=store.document(document_id)
    if not document: raise HTTPException(status_code=404, detail={"code":"DOCUMENT_NOT_FOUND", "message":"Document not found"})
    return response(document)
