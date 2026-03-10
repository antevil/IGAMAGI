from __future__ import annotations

import re


_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text: str) -> list[str]:
    text = " ".join(text.split())
    if not text:
        return []
    parts = _SENT_SPLIT_RE.split(text)
    return [p.strip() for p in parts if p.strip()]