from uuid import uuid4
from app.api.schemas.contracts import DocumentInput
from app.models.domain import DocumentMetadata


def metadata_from_input(document: DocumentInput) -> DocumentMetadata:
    return DocumentMetadata(document_id=document.document_id or str(uuid4()), title=document.title, document_type=document.document_type, source=document.source, category=document.category, categories=None, industry=document.industry, language=document.language, version=document.version, publication_date=document.publication_date, effective_date=document.effective_date, file_name=document.file_name)
