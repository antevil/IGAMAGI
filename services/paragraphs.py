from __future__ import annotations

import re
from typing import Any


def build_paragraph_text(lines: list[dict[str, Any]]) -> str:
    return "\n".join(line["text"] for line in lines)


def normalize_paragraph_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = text.replace("-\n", "")
    text = text.replace("\n", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()
