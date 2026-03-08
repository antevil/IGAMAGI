from __future__ import annotations

import io
import os
from pathlib import Path

from flask import Blueprint, abort, jsonify, send_file

import db
from config import APP_VERSION, BASE_DIR, DB_PATH, INSTANCE_DIR, STORAGE_DIR, Y_MIN_RATIO, Y_MAX_RATIO, PREVIEW_DPI
from services.preview import render_page_image_bytes

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/diagnose")
def diagnose():
    deepl_key_present = bool(os.environ.get("DEEPL_AUTH_KEY", "").strip())
    deepl_base_url = os.environ.get("DEEPL_BASE_URL", "").strip() or "https://api-free.deepl.com"

    return jsonify(
        {
            "app_version": APP_VERSION,
            "paths": {
                "base_dir": str(BASE_DIR),
                "instance_dir": str(INSTANCE_DIR),
                "db_path": str(DB_PATH),
                "storage_dir": str(STORAGE_DIR),
            },
            "config": {
                "Y_MIN_RATIO": Y_MIN_RATIO,
                "Y_MAX_RATIO": Y_MAX_RATIO,
                "PREVIEW_DPI": PREVIEW_DPI,
            },
                       "deepl": {
                "auth_key_present": deepl_key_present,
                "auth_key_tail": (os.environ.get("DEEPL_AUTH_KEY", "")[-6:] if deepl_key_present else ""),
                "base_url": deepl_base_url,
            },
            "db": {
                "tables": db.list_tables(),
                "counts": db.table_counts(),
            },
        }
    )


@api_bp.get("/doc/<int:doc_id>/page/<int:page_no>/blocks")
def api_blocks(doc_id: int, page_no: int):
    con = db.connect()
    try:
        rows = con.execute(
            """
            SELECT id, block_no, block_type, x0, y0, x1, y1, text_raw
            FROM logical_blocks
            WHERE doc_id=? AND page_no=?
            ORDER BY block_no ASC
            """,
            (doc_id, page_no),
        ).fetchall()
        return jsonify({"blocks": [dict(r) for r in rows]})
    finally:
        con.close()


@api_bp.get("/doc/<int:doc_id>/page/<int:page_no>/preview_meta")
def api_preview_meta(doc_id: int, page_no: int):
    con = db.connect()
    try:
        doc_row = con.execute(
            "SELECT stored_path, num_pages FROM documents WHERE id=?",
            (doc_id,),
        ).fetchone()
        if doc_row is None:
            abort(404)
        if page_no < 0 or page_no >= int(doc_row["num_pages"]):
            abort(404)

        _, meta = render_page_image_bytes(Path(doc_row["stored_path"]), page_no)
        return jsonify(meta)
    finally:
        con.close()


@api_bp.get("/doc/<int:doc_id>/page/<int:page_no>/preview.png")
def api_preview_png(doc_id: int, page_no: int):
    con = db.connect()
    try:
        doc_row = con.execute(
            "SELECT stored_path, num_pages FROM documents WHERE id=?",
            (doc_id,),
        ).fetchone()
        if doc_row is None:
            abort(404)
        if page_no < 0 or page_no >= int(doc_row["num_pages"]):
            abort(404)

        png_bytes, _ = render_page_image_bytes(Path(doc_row["stored_path"]), page_no)
        return send_file(
            io.BytesIO(png_bytes),
            mimetype="image/png",
            as_attachment=False,
            download_name=f"doc{doc_id}_p{page_no}.png",
        )
    finally:
        con.close()
        

from services.translator import load_translator

@api_bp.get("/deepl_test")
def deepl_test():
    tr = load_translator()
    if tr is None:
        return jsonify({"ok": False, "reason": "DEEPL_AUTH_KEY not loaded"}), 400
    try:
        out = tr.translate_text("<<<SENT_0001>>> Hello world.")
        return jsonify({"ok": True, "translated": out})
    except Exception as e:
        # requests の例外は中身が重要なので文字列化して返す
        return jsonify({"ok": False, "error": str(e)}), 500