from __future__ import annotations

from pathlib import Path
import fitz


def extract_images_from_pdf(pdf_path: Path, output_dir: Path) -> list[dict]:
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    items: list[dict] = []
    ord_no = 1

    try:
        for page_no in range(doc.page_count):
            page = doc[page_no]
            for img in page.get_images(full=True):
                xref = img[0]
                base = doc.extract_image(xref)
                image_bytes = base["image"]
                ext = base.get("ext", "png")

                filename = f"page_{page_no+1:03d}_img_{ord_no:03d}.{ext}"
                path = output_dir / filename
                path.write_bytes(image_bytes)

                items.append({
                    "ord": ord_no,
                    "page_no": page_no,
                    "image_path": str(path),
                })
                ord_no += 1
    finally:
        doc.close()

    return items