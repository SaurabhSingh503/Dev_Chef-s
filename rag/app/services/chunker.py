import re
from dataclasses import dataclass
import uuid
from app.models.domain import DocumentMetadata, ParsedPage, Chunk
from app.services.parser import extract_section


@dataclass(frozen=True)
class ChunkingConfig:
    size: int
    overlap: int


class Chunker:
    def __init__(self, config: ChunkingConfig):
        self._config = config

    def create(self, pages: list[ParsedPage], metadata: DocumentMetadata) -> list[Chunk]:
        chunks: list[Chunk] = []
        for page in pages:
            section = page.section or extract_section(page.text)
            for index, text in enumerate(self._split(page.text)):
                chunks.append(Chunk(chunk_id=str(uuid.uuid4()), text=text, metadata=metadata, page=page.page, section=section, clause=self._clause(text)))
        return chunks

    def _split(self, text: str) -> list[str]:
        if len(text) <= self._config.size:
            return [text] if text.strip() else []
        sentences = re.split(r"(?<=[.!?;:])\s+", text)
        chunks: list[str] = []
        current = ""
        for sentence in sentences:
            if current and len(current) + len(sentence) + 1 > self._config.size:
                chunks.append(current.strip())
                current = current[max(0, len(current) - self._config.overlap):] + " " + sentence
            else:
                current = f"{current} {sentence}".strip()
        if current.strip():
            chunks.append(current.strip())
        return chunks

    @staticmethod
    def _clause(text: str) -> str | None:
        match = re.match(r"\s*(\d+(?:\.\d+){1,4})\b", text)
        return match.group(1) if match else None
