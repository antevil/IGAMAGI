from __future__ import annotations

import json
from pathlib import Path

import fitz

from config import FIGURE_DIR
from services.preview import crop_page_rect_to_png_bytes


def bbox_json(x0: float, y0: float, x1: float, y1: float) -> str:
    return json.dumps({"x0": x0, "y0": y0, "x1": x1, "y1": y1}, ensure_ascii=False)


def parse_bbox(raw: str | None) -> dict[str, float] | None:
    if not raw:
        return None
    data = json.loads(raw)
    return {
        "x0": float(data["x0"]),
        "y0": float(data["y0"]),
        "x1": float(data["x1"]),
        "y1": float(data["y1"]),
    }


def save_figure_crop(
    doc_id: int,
    figure_id: int,
    pdf_path: str | Path,
    page_no: int,
    bbox_raw: str,
) -> str:
    bbox = parse_bbox(bbox_raw)
    if bbox is None:
        raise ValueError("image_bbox is required")

    rect = fitz.Rect(bbox["x0"], bbox["y0"], bbox["x1"], bbox["y1"])
    png_bytes = crop_page_rect_to_png_bytes(pdf_path, page_no, rect)

    FIGURE_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"doc_{doc_id}_fig_{figure_id}.png"
    out_path = FIGURE_DIR / filename
    out_path.write_bytes(png_bytes)

    return f"/static/figures/{filename}"