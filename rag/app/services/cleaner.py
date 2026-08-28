import re
from collections import Counter
from app.models.domain import ParsedPage


class DocumentCleaner:
    def clean(self, pages: list[ParsedPage]) -> list[ParsedPage]:
        normalized = [self._normalize(page) for page in pages]
        repeated = self._repeated_edge_lines(normalized)
        return [ParsedPage(text=self._remove_repeated_edges(page.text, repeated), page=page.page, section=page.section) for page in normalized]

    @staticmethod
    def _normalize(page: ParsedPage) -> ParsedPage:
        text = page.text.replace("\u00ad", "").replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"(?<=\w)-\n(?=\w)", "", text)  # repair hyphenation only across a line break
        text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)  # preserve paragraph boundaries
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        return ParsedPage(text=text, page=page.page, section=page.section)

    @staticmethod
    def _repeated_edge_lines(pages: list[ParsedPage]) -> set[str]:
        if len(pages) < 2:
            return set()
        candidates: list[str] = []
        for page in pages:
            lines = [line.strip() for line in page.text.splitlines() if line.strip()]
            candidates.extend(lines[:1] + lines[-1:])
        counts = Counter(candidates)
        threshold = max(2, len(pages) // 2)
        return {line for line, count in counts.items() if count >= threshold and len(line) < 160}

    @staticmethod
    def _remove_repeated_edges(text: str, repeated: set[str]) -> str:
        lines = text.splitlines()
        if lines and lines[0].strip() in repeated:
            lines.pop(0)
        if lines and lines[-1].strip() in repeated:
            lines.pop()
        return "\n".join(lines).strip()
