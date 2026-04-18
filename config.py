from __future__ import annotations

import os
from pathlib import Path

APP_NAME = "IGAMAGI"


def get_data_root() -> Path:
    base = os.environ.get("LOCALAPPDATA")
    if not base:
        base = os.environ.get("APPDATA")
    if not base:
        base = str(Path.home())

    path = Path(base) / APP_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


DATA_ROOT = get_data_root()

# ===== データ保存系 =====
INSTANCE_DIR = DATA_ROOT
STORAGE_DIR = DATA_ROOT / "storage"
PDF_DIR = STORAGE_DIR / "pdfs"
FIGURE_DIR = STORAGE_DIR / "figures"
PREVIEW_DIR = STORAGE_DIR / "previews"
DB_PATH = DATA_ROOT / "app.db"

# ===== DeepL設定保存先 =====
SETTINGS_ENV_PATH = DATA_ROOT / "settings.env"


def load_settings_env() -> None:
    if not SETTINGS_ENV_PATH.exists():
        return

    for raw_line in SETTINGS_ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if key and key not in os.environ:
            os.environ[key] = value

# settings.env を先に読む
load_settings_env()

# ===== その他 =====
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
DEEPL_AUTH_KEY = os.environ.get("DEEPL_AUTH_KEY", "").strip()
DEEPL_BASE_URL = os.environ.get("DEEPL_BASE_URL", "https://api-free.deepl.com").strip()
DEEPL_TARGET_LANG = os.environ.get("DEEPL_TARGET_LANG", "JA").strip()
PREVIEW_DPI = int(os.environ.get("PREVIEW_DPI", "150"))
MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", str(80 * 1024 * 1024)))
ALLOWED_EXTENSIONS = {"pdf"}

for path in (INSTANCE_DIR, STORAGE_DIR, PDF_DIR, FIGURE_DIR, PREVIEW_DIR):
    path.mkdir(parents=True, exist_ok=True) 

def get_deepl_settings() -> tuple[str, str, str]:
    load_settings_env()
    auth_key = os.environ.get("DEEPL_AUTH_KEY", "").strip()
    base_url = os.environ.get("DEEPL_BASE_URL", "https://api-free.deepl.com").strip()
    target_lang = os.environ.get("DEEPL_TARGET_LANG", "JA").strip()
    return auth_key, base_url, target_lang