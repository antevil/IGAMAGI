from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from flask import Flask, render_template, request, redirect, url_for, flash, abort

from config import (
    SECRET_KEY,
    PDF_DIR,
    TEI_DIR,
    IMAGE_DIR,
    GROBID_URL,
    DEEPL_AUTH_KEY,
    DEEPL_BASE_URL,
)
from services.db import init_db, get_conn
from services.grobid_client import run_grobid
from services.tei_parser import parse_tei
from services.translator import DeepLTranslator
from services.pdf_images import extract_images_from_pdf
from services.text_utils import split_sentences


app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY

init_db()


@app.get("/")
def index():
    conn = get_conn()
    try:
        docs = conn.execute(
            """
            SELECT
              d.id,
              d.filename,
              d.title,
              d.created_at,
              (SELECT COUNT(*) FROM paragraphs p WHERE p.doc_id = d.id) AS num_paragraphs,
              (SELECT COUNT(*) FROM figures f WHERE f.doc_id = d.id) AS num_figures
            FROM documents d
            ORDER BY d.id DESC
            LIMIT 20
            """
        ).fetchall()
    finally:
        conn.close()

    return render_template("index.html", docs=docs)


@app.post("/upload")
def upload():
    file = request.files.get("pdf")
    if not file or not file.filename.lower().endswith(".pdf"):
        flash("PDFファイルを選択してください。")
        return redirect(url_for("index"))

    safe_name = f"{uuid4().hex}_{file.filename}"
    pdf_path = PDF_DIR / safe_name
    file.save(pdf_path)

    try:
        tei_xml = run_grobid(pdf_path, GROBID_URL)
    except Exception as e:
        flash(f"GROBID抽出に失敗しました: {e}")
        return redirect(url_for("index"))

    tei_path = TEI_DIR / f"{pdf_path.stem}.tei.xml"
    tei_path.write_text(tei_xml, encoding="utf-8")

    parsed = parse_tei(tei_xml)

    translator = DeepLTranslator(DEEPL_AUTH_KEY, DEEPL_BASE_URL)
    translated_paragraphs = translator.translate_paragraphs(parsed["paragraphs"])

    image_output_dir = IMAGE_DIR / pdf_path.stem
    extracted_images = extract_images_from_pdf(pdf_path, image_output_dir)

    conn = get_conn()
    try:
        cur = conn.execute(
            """
            INSERT INTO documents (filename, title, authors, pdf_path, tei_path)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                file.filename,
                parsed["title"],
                ", ".join(parsed["authors"]),
                str(pdf_path),
                str(tei_path),
            ),
        )
        doc_id = cur.lastrowid

        for i, en in enumerate(parsed["paragraphs"], start=1):
            ja = translated_paragraphs[i - 1] if i - 1 < len(translated_paragraphs) else ""
            conn.execute(
                """
                INSERT INTO paragraphs (doc_id, ord, text_en, text_ja)
                VALUES (?, ?, ?, ?)
                """,
                (doc_id, i, en, ja),
            )

        figure_captions = parsed["figures"]
        max_len = max(len(extracted_images), len(figure_captions))

        for i in range(max_len):
            img = extracted_images[i] if i < len(extracted_images) else {}
            fig = figure_captions[i] if i < len(figure_captions) else {}

            conn.execute(
                """
                INSERT INTO figures (doc_id, ord, page_no, image_path, caption)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    doc_id,
                    i + 1,
                    img.get("page_no"),
                    img.get("image_path"),
                    fig.get("caption", ""),
                ),
            )

        for i, ref in enumerate(parsed["references"], start=1):
            conn.execute(
                """
                INSERT INTO references_items (doc_id, ord, raw_text)
                VALUES (?, ?, ?)
                """,
                (doc_id, i, ref),
            )

        conn.commit()
    finally:
        conn.close()

    return redirect(url_for("viewer", doc_id=doc_id))


@app.get("/doc/<int:doc_id>")
def viewer(doc_id: int):
    conn = get_conn()
    try:
        doc = conn.execute(
            "SELECT * FROM documents WHERE id = ?",
            (doc_id,),
        ).fetchone()
        if not doc:
            abort(404)

        paragraphs = conn.execute(
            """
            SELECT * FROM paragraphs
            WHERE doc_id = ?
            ORDER BY ord
            """,
            (doc_id,),
        ).fetchall()

        figures = conn.execute(
            """
            SELECT * FROM figures
            WHERE doc_id = ?
            ORDER BY ord
            """,
            (doc_id,),
        ).fetchall()

        references = conn.execute(
            """
            SELECT * FROM references_items
            WHERE doc_id = ?
            ORDER BY ord
            """,
            (doc_id,),
        ).fetchall()
    finally:
        conn.close()

    paragraph_view = []
    for p in paragraphs:
        en_sents = split_sentences(p["text_en"])
        ja_sents = split_sentences(p["text_ja"]) if p["text_ja"] else []

        pairs = []
        max_len = max(len(en_sents), len(ja_sents))
        for i in range(max_len):
            pairs.append({
                "en": en_sents[i] if i < len(en_sents) else "",
                "ja": ja_sents[i] if i < len(ja_sents) else "",
            })

        paragraph_view.append({
            "ord": p["ord"],
            "pairs": pairs,
            "fallback_en": p["text_en"],
            "fallback_ja": p["text_ja"] or "",
        })

    figure_view = []
    for f in figures:
        rel_image = ""
        if f["image_path"]:
            rel_image = Path(f["image_path"]).relative_to(Path(__file__).resolve().parent).as_posix()

        figure_view.append({
            "ord": f["ord"],
            "page_no": f["page_no"],
            "image_url": f"/{rel_image}" if rel_image else "",
            "caption": f["caption"] or "",
        })

    return render_template(
        "viewer.html",
        doc=doc,
        paragraphs=paragraph_view,
        figures=figure_view,
        references=references,
    )


if __name__ == "__main__":
    app.run(debug=True)