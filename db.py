from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any

from config import DB_PATH


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def table_counts() -> dict[str, int]:
    con = connect()
    try:
        counts: dict[str, int] = {}
        for t in ["documents", "pages", "logical_blocks", "sentences"]:
            row = con.execute(f"SELECT COUNT(*) AS n FROM {t}").fetchone()
            counts[t] = int(row["n"]) if row else 0
        return counts
    finally:
        con.close()


def list_tables() -> list[str]:
    con = connect()
    try:
        rows = con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        return [r["name"] for r in rows]
    finally:
        con.close()