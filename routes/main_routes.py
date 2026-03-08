from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

import fitz
from flask import Blueprint, abort, flash, redirect, render_template, request, url_for

import db
from config import STORAGE_DIR, Y_MIN_RATIO, Y_MAX_RATIO
from services.extractor import extract_blocks_for_page
from services.sentences import (
    build_sentence_units,
    compose_for_translation,
    split_translated_by_marker,
)
from services.translator import load_translator

main_bp = Blueprint("main", __name__)


# ------------------------------------------------------------
# 安全なファイル名
# ------------------------------------------------------------
def safe_filename(name: str) -> str:
    name = name.strip().replace("\\", "_").replace("/", "_")
    name = re.sub(r"[^A-Za-z0-9._() -]+", "_", name)
    name = re.sub(r"_+", "_", name)
    return name or "uploaded.pdf"


# ------------------------------------------------------------
# PDF保存＋1ページ目抽出
# ------------------------------------------------------------
def store_doc_and_extract_page0(pdf_path: Path, original_name: str) -> int:
    with fitz.open(pdf_path) as doc_obj:
        num_pages = doc_obj.page_count
        con = db.connect()
        try:
            cur = con.execute(
                "INSERT INTO documents(filename, stored_path, num_pages, created_at) VALUES (?, ?, ?, ?)",
                (original_name, str(pdf_path), num_pages, db.now_iso()),
            )
            doc_id = int(cur.lastrowid)

            meta, blocks = extract_blocks_for_page(doc_obj, 0)

            con.execute(
                "INSERT INTO pages(doc_id, page_no, width, height, created_at) VALUES (?, ?, ?, ?, ?)",
                (doc_id, 0, meta["width"], meta["height"], db.now_iso()),
            )

            for b in blocks:
                con.execute(
                    """
                    INSERT INTO logical_blocks(
                        doc_id, page_no, block_no, block_type,
                        x0, y0, x1, y1, text_raw, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (doc_id, 0, b.block_no, b.block_type,
                     b.x0, b.y0, b.x1, b.y1, b.text, db.now_iso()),
                )

            con.commit()
            return doc_id
        finally:
            con.close()


# ------------------------------------------------------------
# ページ抽出（lazy）
# ------------------------------------------------------------
def ensure_page_extracted(con, doc_row, doc_id: int, page_no: int):
    page = con.execute(
        "SELECT width, height FROM pages WHERE doc_id=? AND page_no=?",
        (doc_id, page_no),
    ).fetchone()

    if page:
        return float(page["width"]), float(page["height"])

    with fitz.open(doc_row["stored_path"]) as doc_obj:
        meta, blocks = extract_blocks_for_page(doc_obj, page_no)

    con.execute(
        "INSERT INTO pages(doc_id, page_no, width, height, created_at) VALUES (?, ?, ?, ?, ?)",
        (doc_id, page_no, meta["width"], meta["height"], db.now_iso()),
    )

    for b in blocks:
        con.execute(
            """
            INSERT INTO logical_blocks(
                doc_id, page_no, block_no, block_type,
                x0, y0, x1, y1, text_raw, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (doc_id, page_no, b.block_no, b.block_type,
             b.x0, b.y0, b.x1, b.y1, b.text, db.now_iso()),
        )

    con.commit()
    return meta["width"], meta["height"]


# ------------------------------------------------------------
# Phase B: 文キャッシュ生成
# ------------------------------------------------------------
def ensure_sentence_cache(doc_id: int, page_no: int):
    translator = load_translator()
    con = db.connect()

    try:
        exists = con.execute(
            "SELECT 1 FROM sentences WHERE doc_id=? AND page_no=? LIMIT 1",
            (doc_id, page_no),
        ).fetchone()

        if exists:
            return

        blocks = con.execute(
            """
            SELECT id, text_raw
            FROM logical_blocks
            WHERE doc_id=? AND page_no=?
            ORDER BY block_no ASC
            """,
            (doc_id, page_no),
        ).fetchall()

        for b in blocks:
            block_id = b["id"]
            units = build_sentence_units(b["text_raw"])
            if not units:
                continue

            ja_map = {}

            if translator:
                try:
                    payload = compose_for_translation(units)
                    translated = translator.translate_text(payload)

                    # --- DEBUG: ここから（最初の1ブロックだけ出す） ---
                    if block_id == blocks[0]["id"]:
                        print("=== DEEPL PAYLOAD (first block) ===")
                        print(payload[:800])
                        print("=== DEEPL TRANSLATED (first block) ===")
                        print(translated[:800])
                    # --- DEBUG: ここまで ---

                    ja_map = split_translated_by_marker(translated)

                    # --- DEBUG: 復元件数 ---
                    if block_id == blocks[0]["id"]:
                        print("=== JA_MAP KEYS (first block) ===")
                        print(list(ja_map.keys())[:20])
                        print("JA_MAP SIZE:", len(ja_map))
                except Exception as e:
                    import traceback
                    print("DEEPL ERROR:", repr(e))
                    print(traceback.format_exc())
                    ja_map = {}

            for u in units:
                con.execute(
                    """
                    INSERT INTO sentences(
                        doc_id, page_no, block_id, idx_in_block,
                        marker, text_en, text_ja, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        doc_id,
                        page_no,
                        block_id,
                        u.idx,
                        u.marker,
                        u.text_en,
                        ja_map.get(u.marker),
                        db.now_iso(),
                        db.now_iso(),
                    ),
                )

        con.commit()

    finally:
        con.close()


# ------------------------------------------------------------
# ルート
# ------------------------------------------------------------
@main_bp.get("/")
def index():
    con = db.connect()
    docs = con.execute(
        "SELECT id, filename FROM documents ORDER BY id DESC"
    ).fetchall()
    con.close()
    return render_template("index.html", docs=docs)


@main_bp.post("/upload")
def upload():
    f = request.files.get("pdf")
    if not f:
        flash("PDFが選択されていません")
        return redirect(url_for("main.index"))

    original_name = safe_filename(f.filename)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    stored_name = f"{stamp}_{original_name}"
    pdf_path = STORAGE_DIR / stored_name
    f.save(pdf_path)

    doc_id = store_doc_and_extract_page0(pdf_path, original_name)
    return redirect(url_for("main.viewer", doc_id=doc_id, page_no=0))


@main_bp.get("/doc/<int:doc_id>/page/<int:page_no>")
def viewer(doc_id: int, page_no: int):
    con = db.connect()
    doc_row = con.execute(
        "SELECT * FROM documents WHERE id=?",
        (doc_id,),
    ).fetchone()

    if not doc_row:
        abort(404)

    page_width, page_height = ensure_page_extracted(con, doc_row, doc_id, page_no)
    con.close()

    ensure_sentence_cache(doc_id, page_no)

    con = db.connect()
    blocks = con.execute(
        """
        SELECT * FROM logical_blocks
        WHERE doc_id=? AND page_no=?
        ORDER BY block_no ASC
        """,
        (doc_id, page_no),
    ).fetchall()

    rows = con.execute(
        """
        SELECT block_id, idx_in_block, text_en, text_ja
        FROM sentences
        WHERE doc_id=? AND page_no=?
        ORDER BY block_id, idx_in_block
        """,
        (doc_id, page_no),
    ).fetchall()

    con.close()

    by_block = {}
    for r in rows:
        by_block.setdefault(r["block_id"], []).append(
            {"en": r["text_en"], "ja": r["text_ja"]}
        )

    return render_template(
        "viewer.html",
        doc=dict(doc_row),
        page_no=page_no,
        page_width=page_width,
        page_height=page_height,
        y_min_ratio=Y_MIN_RATIO,
        y_max_ratio=Y_MAX_RATIO,
        blocks=[dict(b) for b in blocks],
        sentences_by_block=by_block,
    )