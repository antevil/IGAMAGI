from __future__ import annotations

import os
from pathlib import Path

# -----------------------------------------------------------------------------
# 設定（config）
# -----------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / "instance"
DB_PATH = INSTANCE_DIR / "app.db"

STORAGE_DIR = INSTANCE_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# 抽出（extraction）y範囲フィルタ：ページ高さの 15%〜90%
Y_MIN_RATIO = 0.15
Y_MAX_RATIO = 0.90

# PDFプレビュー（preview）
PREVIEW_DPI = 110  # 72dpi基準の拡大率へ変換して使用

# アプリ識別（diagnoseで返す）
APP_VERSION = "A-plan-0.2-refactor"
