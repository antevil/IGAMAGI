from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import fitz  # PyMuPDF

from config import Y_MIN_RATIO, Y_MAX_RATIO


@dataclass
class ExtractedBlock:
    block_no: int
    block_type: int
    x0: float
    y0: float
    x1: float
    y1: float
    text: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "block_no": self.block_no,
            "block_type": self.block_type,
            "x0": self.x0,
            "y0": self.y0,
            "x1": self.x1,
            "y1": self.y1,
            "text": self.text,
        }


def extract_blocks_for_page(doc: fitz.Document, page_no: int) -> tuple[dict[str, float], list[ExtractedBlock]]:
    """
    PDF抽出（extraction）
    - PyMuPDF blocks を取得
    - y範囲（15%〜90%）のブロックのみ残す（境界含む）
    - A案：結合（merge）しない。1ブロック＝1論理ブロック（logical block）
    """
    page = doc.load_page(page_no)
    rect = page.rect
    width, height = float(rect.width), float(rect.height)

    raw = page.get_text("blocks")
    blocks: list[ExtractedBlock] = []

    y_min = height * Y_MIN_RATIO
    y_max = height * Y_MAX_RATIO

    for t in raw:
        if len(t) < 7:
            continue
        x0, y0, x1, y1, text, block_no, block_type = t[:7]
        x0 = float(x0); y0 = float(y0); x1 = float(x1); y1 = float(y1)
        text = (text or "").strip()

        # y範囲フィルタ（normalize）
        if y1 < y_min or y0 > y_max:
            continue
        if not text:
            continue

        blocks.append(
            ExtractedBlock(
                block_no=int(block_no),
                block_type=int(block_type),
                x0=x0, y0=y0, x1=x1, y1=y1,
                text=text,
            )
        )

    meta = {"width": width, "height": height, "y_min": y_min, "y_max": y_max}
    return meta, blocks