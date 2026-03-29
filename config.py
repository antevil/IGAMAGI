from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / "instance"
STORAGE_DIR = BASE_DIR / "storage"
PDF_DIR = STORAGE_DIR / "pdfs"
FIGURE_DIR = BASE_DIR / "static" / "figures"
PREVIEW_DIR = STORAGE_DIR / "previews"
DB_PATH = INSTANCE_DIR / "app.db"

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
DEEPL_AUTH_KEY = os.environ.get("DEEPL_AUTH_KEY", "").strip()
DEEPL_BASE_URL = os.environ.get("DEEPL_BASE_URL", "https://api-free.deepl.com").strip()
DEEPL_TARGET_LANG = os.environ.get("DEEPL_TARGET_LANG", "JA")
PREVIEW_DPI = int(os.environ.get("PREVIEW_DPI", "150"))
MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", str(80 * 1024 * 1024)))
ALLOWED_EXTENSIONS = {"pdf"}

for path in (INSTANCE_DIR, STORAGE_DIR, PDF_DIR, FIGURE_DIR, PREVIEW_DIR):
    path.mkdir(parents=True, exist_ok=True)
