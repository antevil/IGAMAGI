from __future__ import annotations

import os
import shutil
import subprocess
import sys
import threading
import requests
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, flash, jsonify, redirect, render_template, request, url_for

import db
from config import ALLOWED_EXTENSIONS, PDF_DIR, SETTINGS_ENV_PATH
from services.extractor import extract_lines, extract_pages
from update_checker import check_for_updates

main_bp = Blueprint("main", __name__)


def app_update_check():
    return jsonify(check_for_updates())


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def restart_app() -> None:
    """
    現在のアプリを再起動する。
    - python app.py で起動中: python + 現在の引数で再起動
    - PyInstaller exe 起動中: exe 自身を再起動
    """
    if getattr(sys, "frozen", False):
        subprocess.Popen([sys.executable], close_fds=True)
    else:
        subprocess.Popen([sys.executable] + sys.argv, close_fds=True)

    os._exit(0)

DEEPL_FREE_BASE_URL = "https://api-free.deepl.com"
DEEPL_PRO_BASE_URL = "https://api.deepl.com"


def detect_deepl_plan(api_key: str) -> tuple[str, str]:
    """
    APIキーをDeepLに問い合わせて、free / pro を判定する。
    戻り値: (plan, base_url)
    失敗時は ValueError を送出。
    """
    api_key = (api_key or "").strip()
    if not api_key:
        raise ValueError("APIキーを入力してください。")

    headers = {"Authorization": f"DeepL-Auth-Key {api_key}"}

    # まず Free を試す
    try:
        res = requests.get(
            f"{DEEPL_FREE_BASE_URL}/v2/usage",
            headers=headers,
            timeout=15,
        )
        if res.status_code == 200:
            return "free", DEEPL_FREE_BASE_URL
    except requests.RequestException:
        pass

    # 次に Pro を試す
    try:
        res = requests.get(
            f"{DEEPL_PRO_BASE_URL}/v2/usage",
            headers=headers,
            timeout=15,
        )
        if res.status_code == 200:
            return "pro", DEEPL_PRO_BASE_URL
    except requests.RequestException:
        pass

    raise ValueError("DeepL APIキーの確認に失敗しました。キーが正しいか確認してください。")

@main_bp.get("/settings/deepl")
def get_deepl_settings():
    key = ""
    plan = ""

    if SETTINGS_ENV_PATH.exists():
        for raw_line in SETTINGS_ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()

            if line.startswith("DEEPL_AUTH_KEY="):
                key = line.split("=", 1)[1].strip()

            elif line.startswith("DEEPL_BASE_URL="):
                base_url = line.split("=", 1)[1].strip()
                if base_url == DEEPL_PRO_BASE_URL:
                    plan = "pro"
                elif base_url == DEEPL_FREE_BASE_URL:
                    plan = "free"

    return jsonify({
        "api_key": key,
        "plan": plan,
    })

@main_bp.post("/settings/deepl")
def save_deepl_settings():
    data = request.get_json(force=True)
    api_key = (data.get("api_key") or "").strip()

    try:
        plan, base_url = detect_deepl_plan(api_key)
    except ValueError as exc:
        return jsonify({
            "ok": False,
            "message": str(exc),
        }), 400

    content = (
        f"DEEPL_AUTH_KEY={api_key}\n"
        f"DEEPL_BASE_URL={base_url}\n"
    )

    SETTINGS_ENV_PATH.write_text(content, encoding="utf-8")

    threading.Timer(0.7, restart_app).start()

    return jsonify({
        "ok": True,
        "message": f"DeepL設定を保存しました。検出プラン: {plan.upper()}。アプリを再起動します。",
    })

@main_bp.get("/")
def index():
    docs = db.fetch_all("SELECT id, filename, title FROM documents ORDER BY id DESC")
    update_info = check_for_updates()
    return render_template("index.html", docs=docs, update_info=update_info)


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

    pages = extract_pages(pdf_path)
    db.execute_many(
        """
        INSERT INTO pages (doc_id, page_no, page_width, page_height)
        VALUES (?, ?, ?, ?)
        """,
        [
            (
                doc_id,
                row["page_no"],
                row["page_width"],
                row["page_height"],
            )
            for row in pages
        ],
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

    flash(f"PDFを取り込みました。ページ数: {len(pages)} / 抽出行数: {len(lines)}")
    return redirect(url_for("main.setup", doc_id=doc_id))


@main_bp.get("/docs/<int:doc_id>/setup")
def setup(doc_id: int):
    document = db.fetch_one("SELECT * FROM documents WHERE id = ?", (doc_id,))
    if document is None:
        flash("ドキュメントが見つかりません。")
        return redirect(url_for("main.index"))

    pages = db.fetch_all(
        """
        SELECT page_no, COUNT(*) AS line_count
        FROM lines
        WHERE doc_id = ?
        GROUP BY page_no
        ORDER BY page_no
        """,
        (doc_id,),
    )
    paragraphs = db.fetch_all(
        """
        SELECT *
        FROM paragraphs
        WHERE doc_id = ?
        ORDER BY order_index, id
        """,
        (doc_id,),
    )
    figures = db.fetch_all(
        """
        SELECT *
        FROM figures
        WHERE doc_id = ?
        ORDER BY page_no, id
        """,
        (doc_id,),
    )

    return render_template(
        "setup.html",
        document=document,
        pages=pages,
        paragraphs=paragraphs,
        figures=figures,
    )


@main_bp.get("/docs/<int:doc_id>/reader")
def reader(doc_id: int):
    document = db.fetch_one("SELECT * FROM documents WHERE id = ?", (doc_id,))
    if document is None:
        flash("ドキュメントが見つかりません。")
        return redirect(url_for("main.index"))

    paragraphs = db.fetch_all(
        """
        SELECT *
        FROM paragraphs
        WHERE doc_id = ?
        ORDER BY order_index, id
        """,
        (doc_id,),
    )
    figures = db.fetch_all(
        """
        SELECT *
        FROM figures
        WHERE doc_id = ?
        ORDER BY page_no, id
        """,
        (doc_id,),
    )

    return render_template(
        "reader.html",
        document=document,
        paragraphs=paragraphs,
        figures=figures,
    )