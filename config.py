from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / "instance"
STORAGE_DIR = BASE_DIR / "storage"

PDF_DIR = STORAGE_DIR / "pdf"
TEI_DIR = STORAGE_DIR / "tei"
IMAGE_DIR = STORAGE_DIR / "images"
TRANSLATION_DIR = STORAGE_DIR / "translations"

DB_PATH = INSTANCE_DIR / "app.db"

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
DEEPL_AUTH_KEY = os.environ.get("DEEPL_AUTH_KEY", "").strip()
DEEPL_BASE_URL = os.environ.get("DEEPL_BASE_URL", "https://api-free.deepl.com").strip()
GROBID_URL = os.environ.get("GROBID_URL", "http://localhost:8070").strip()

for p in [INSTANCE_DIR, STORAGE_DIR, PDF_DIR, TEI_DIR, IMAGE_DIR, TRANSLATION_DIR]:
    p.mkdir(parents=True, exist_ok=True)