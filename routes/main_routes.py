from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, flash, redirect, render_template, request, url_for

import db
from config import ALLOWED_EXTENSIONS, PDF_DIR
from services.extractor import extract_lines

main_bp = Blueprint("main", __name__)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@main_bp.get("/")
def index():
    docs = db.fetch_all("SELECT * FROM documents ORDER BY id DESC")
    return render_template("index.html", docs=docs)


@main_bp.post("/upload")
def upload_pdf():
    file = request.files.get("pdf")
    if file is None or not file.filename:
        flash("PDFファイルを選択してください。")
        return redirect(url_for("main.index"))

    if not allowed_file(file.filename):
        flash("PDFのみアップロードできます。")
        return redirect(url_for("main.index"))

    safe_name = f"{uuid4().hex}_{Path(file.filename).name}"
    pdf_path = PDF_DIR / safe_name
    file.save(pdf_path)

    doc_id = db.execute(
        "INSERT INTO documents (filename, pdf_path, title) VALUES (?, ?, ?)",
        (file.filename, str(pdf_path), None),
    )

    lines = extract_lines(pdf_path)
    db.execute_many(
        """
        INSERT INTO lines (doc_id, page_no, line_no, text, x0, y0, x1, y1)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                doc_id,
                row["page_no"],
                row["line_no"],
                row["text"],
                row["x0"],
                row["y0"],
                row["x1"],
                row["y1"],
            )
            for row in lines
        ],
    )

    flash(f"PDFを取り込みました。抽出行数: {len(lines)}")
    return redirect(url_for("main.reader", doc_id=doc_id))


@main_bp.get("/docs/<int:doc_id>/reader")
def reader(doc_id: int):
    document = db.fetch_one("SELECT * FROM documents WHERE id = ?", (doc_id,))
    if document is None:
        flash("ドキュメントが見つかりません。")
        return redirect(url_for("main.index"))

    pages = db.fetch_all(
        "SELECT page_no, COUNT(*) AS line_count FROM lines WHERE doc_id = ? GROUP BY page_no ORDER BY page_no",
        (doc_id,),
    )
    paragraphs = db.fetch_all(
        "SELECT * FROM paragraphs WHERE doc_id = ? ORDER BY order_index",
        (doc_id,),
    )
    figures = db.fetch_all(
        "SELECT * FROM figures WHERE doc_id = ? ORDER BY page_no, id",
        (doc_id,),
    )
    return render_template(
        "reader.html",
        document=document,
        pages=pages,
        paragraphs=paragraphs,
        figures=figures,
    )
