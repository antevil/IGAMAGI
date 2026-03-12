from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from flask import g

from config import DB_PATH


def dict_factory(cursor: sqlite3.Cursor, row: tuple[Any, ...]) -> dict[str, Any]:
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


def connect_db(db_path: Path | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path or DB_PATH))
    conn.row_factory = dict_factory
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = connect_db()
    return g.db


def close_db(_: Exception | None = None) -> None:
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db() -> None:
    schema_path = Path(__file__).resolve().parent / "schema.sql"
    conn = connect_db()
    try:
        schema_sql = schema_path.read_text(encoding="utf-8")
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()


def fetch_one(query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    cur = get_db().execute(query, params)
    row = cur.fetchone()
    cur.close()
    return row


def fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    cur = get_db().execute(query, params)
    rows = cur.fetchall()
    cur.close()
    return rows


def execute(query: str, params: tuple[Any, ...] = ()) -> int:
    conn = get_db()
    cur = conn.execute(query, params)
    conn.commit()
    lastrowid = cur.lastrowid
    cur.close()
    return lastrowid


def execute_many(query: str, params_seq: list[tuple[Any, ...]]) -> None:
    conn = get_db()
    conn.executemany(query, params_seq)
    conn.commit()
