from __future__ import annotations

import sqlite3
from pathlib import Path
from config import DB_PATH, BASE_DIR

SCHEMA_PATH = BASE_DIR / "schema.sql"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    schema_sql = Path(SCHEMA_PATH).read_text(encoding="utf-8")
    conn = get_conn()
    try:
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()