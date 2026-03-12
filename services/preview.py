from __future__ import annotations

import io
from pathlib import Path

import fitz


def render_page_png_bytes(pdf_path: str | Path, page_no: int, dpi: int = 150) -> bytes:
    doc = fitz.open(str(pdf_path))
    try:
        page = doc.load_page(page_no)
        pix = page.get_pixmap(dpi=dpi, alpha=False)
        return pix.tobytes("png")
    finally:
        doc.close()


def crop_page_rect_to_png_bytes(pdf_path: str | Path, page_no: int, rect: fitz.Rect, dpi: int = 180) -> bytes:
    doc = fitz.open(str(pdf_path))
    try:
        page = doc.load_page(page_no)
        mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        pix = page.get_pixmap(matrix=mat, clip=rect, alpha=False)
        return pix.tobytes("png")
    finally:
        doc.close()
