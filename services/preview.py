from __future__ import annotations

import fitz  # PyMuPDF
from pathlib import Path
from typing import Any

from config import PREVIEW_DPI


def render_page_image_bytes(pdf_path: Path, page_no: int) -> tuple[bytes, dict[str, Any]]:
    """
    ページプレビュー（preview）PNG生成
    """
    with fitz.open(pdf_path) as doc:
        page = doc.load_page(page_no)
        rect = page.rect
        width, height = float(rect.width), float(rect.height)

        zoom = PREVIEW_DPI / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        png_bytes = pix.tobytes("png")

        meta = {
            "pdf_width": width,
            "pdf_height": height,
            "zoom": zoom,
            "img_width": pix.width,
            "img_height": pix.height,
        }
        return png_bytes, meta