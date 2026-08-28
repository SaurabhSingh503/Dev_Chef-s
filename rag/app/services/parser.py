import base64
import io
import re
from dataclasses import dataclass
from pathlib import Path
from app.models.domain import ParsedPage


class DocumentParseError(ValueError):
    """Raised when submitted content cannot be parsed without losing traceability."""


@dataclass(frozen=True)
class ParseInput:
    text: str | None
    content_base64: str | None
    file_name: str | None


class DocumentParser:
    def parse(self, input_data: ParseInput) -> list[ParsedPage]:
        if input_data.text and input_data.text.strip():
            return self._text_pages(input_data.text)
        if not input_data.content_base64:
            raise DocumentParseError("Provide non-empty text or base64 document content")
        extension = Path(input_data.file_name or "").suffix.lower()
        if extension != ".pdf":
            raise DocumentParseError("Only text and PDF ingestion are currently supported")
        return self._pdf_pages(input_data.content_base64)

    @staticmethod
    def _text_pages(text: str) -> list[ParsedPage]:
        # Form-feed is a lossless page convention for text exports.
        return [ParsedPage(text=page, page=index + 1) for index, page in enumerate(text.split("\f")) if page.strip()]

    @staticmethod
    def _pdf_pages(content_base64: str) -> list[ParsedPage]:
        try:
            from pypdf import PdfReader
            binary = base64.b64decode(content_base64, validate=True)
            reader = PdfReader(io.BytesIO(binary))
            pages = [ParsedPage(text=page.extract_text() or "", page=index + 1) for index, page in enumerate(reader.pages)]
        except Exception as error:
            raise DocumentParseError("PDF could not be parsed") from error
        usable = [page for page in pages if page.text.strip()]
        if not usable:
            raise DocumentParseError("PDF contains no extractable text; OCR is not configured")
        return usable


def extract_section(text: str) -> str | None:
    match = re.search(r"(?m)^\s*((?:\d+(?:\.\d+){0,4}|[A-Z][A-Z .-]{2,}))\s*(?:[—:-]|$)", text)
    return match.group(1).strip() if match else None
