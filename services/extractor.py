from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import fitz


def _normalize_line(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_pages(pdf_path: str | Path) -> list[dict]:
    pdf = fitz.open(str(pdf_path))
    try:
        rows: list[dict] = []

        for page_no in range(len(pdf)):
            page = pdf[page_no]
            rows.append(
                {
                    "page_no": page_no,
                    "page_width": float(page.rect.width),
                    "page_height": float(page.rect.height),
                }
            )

        return rows
    finally:
        pdf.close()

def extract_lines(pdf_path: str | Path) -> list[dict[str, Any]]:
    doc = fitz.open(str(pdf_path))
    rows: list[dict[str, Any]] = []
    try:
        for page_no, page in enumerate(doc):
            line_no = 0
            text_dict = page.get_text("dict")
            for block in text_dict.get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    spans = line.get("spans", [])
                    if not spans:
                        continue
                    text = "".join(span.get("text", "") for span in spans)
                    text = _normalize_line(text)
                    if not text:
                        continue
                    x0 = min(float(span["bbox"][0]) for span in spans)
                    y0 = min(float(span["bbox"][1]) for span in spans)
                    x1 = max(float(span["bbox"][2]) for span in spans)
                    y1 = max(float(span["bbox"][3]) for span in spans)
                    rows.append(
                        {
                            "page_no": page_no,
                            "line_no": line_no,
                            "text": text,
                            "x0": x0,
                            "y0": y0,
                            "x1": x1,
                            "y1": y1,
                        }
                    )
                    line_no += 1
    finally:
        doc.close()
    return rows
