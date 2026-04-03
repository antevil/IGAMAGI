from __future__ import annotations

import os
from pathlib import Path

APP_NAME = "IGAMAGI"

# 👇 Windowsのユーザーデータフォルダ
def get_data_root() -> Path:
    base = os.environ.get("LOCALAPPDATA")  # 推奨
    if not base:
        base = os.environ.get("APPDATA")   # fallback
    if not base:
        base = str(Path.home())            # 最終fallback

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

# ===== その他 =====
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
# 追加
SETTINGS_ENV_PATH = DATA_ROOT / "settings.env"
DEEPL_AUTH_KEY = os.environ.get("DEEPL_AUTH_KEY", "").strip()
DEEPL_BASE_URL = os.environ.get("DEEPL_BASE_URL", "https://api-free.deepl.com").strip()
DEEPL_TARGET_LANG = os.environ.get("DEEPL_TARGET_LANG", "JA")
PREVIEW_DPI = int(os.environ.get("PREVIEW_DPI", "150"))
MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", str(80 * 1024 * 1024)))
ALLOWED_EXTENSIONS = {"pdf"}

# 👇 必須：フォルダ作成
for path in (INSTANCE_DIR, STORAGE_DIR, PDF_DIR, FIGURE_DIR, PREVIEW_DIR):
    path.mkdir(parents=True, exist_ok=True)