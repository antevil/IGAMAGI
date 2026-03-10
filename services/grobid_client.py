from __future__ import annotations

from pathlib import Path
import requests


def run_grobid(pdf_path: Path, grobid_url: str) -> str:
    url = f"{grobid_url.rstrip('/')}/api/processFulltextDocument"

    with pdf_path.open("rb") as f:
        files = {"input": (pdf_path.name, f, "application/pdf")}
        data = {
            "includeRawCitations": "1",
            "includeRawAffiliations": "1",
        }
        response = requests.post(url, files=files, data=data, timeout=180)

    response.raise_for_status()
    return response.text