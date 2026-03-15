from __future__ import annotations

import json

from flask import Blueprint, abort, jsonify, request, send_file

import db
from config import PREVIEW_DPI
from services.figures import bbox_json, save_figure_crop
from services.paragraphs import build_paragraph_text, normalize_paragraph_text
from services.preview import render_page_png_bytes
from services.sentences import split_sentences
from services.translator import TranslatorError, translator

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/docs/<int:doc_id>")
def get_document(doc_id: int):
    doc = db.fetch_one("SELECT * FROM documents WHERE id = ?", (doc_id,))
    if doc is None:
        abort(404)
    return jsonify(doc)


@api_bp.get("/docs/<int:doc_id>/pages")
def get_pages(doc_id: int):
    rows = db.fetch_all(
        "SELECT page_no, COUNT(*) AS line_count FROM lines WHERE doc_id = ? GROUP BY page_no ORDER BY page_no",
        (doc_id,),
    )
    return jsonify(rows)


@api_bp.get("/docs/<int:doc_id>/pages/<int:page_no>/lines")
def get_page_lines(doc_id: int, page_no: int):
    page_row = db.fetch_one(
        """
        SELECT page_width, page_height
        FROM pages
        WHERE doc_id = ? AND page_no = ?
        """,
        (doc_id, page_no),
    )
    if page_row is None:
        abort(404)

    lines = db.fetch_all(
        """
        SELECT id, doc_id, page_no, line_no, text, x0, y0, x1, y1
        FROM lines
        WHERE doc_id = ? AND page_no = ?
        ORDER BY line_no
        """,
        (doc_id, page_no),
    )

    return jsonify(
        {
            "page_width": page_row["page_width"],
            "page_height": page_row["page_height"],
            "lines": [dict(row) for row in lines],
        }
    )


@api_bp.get("/docs/<int:doc_id>/pages/<int:page_no>/preview")
def get_page_preview(doc_id: int, page_no: int):
    doc = db.fetch_one("SELECT * FROM documents WHERE id = ?", (doc_id,))
    if doc is None:
        abort(404)
    png_bytes = render_page_png_bytes(doc["pdf_path"], page_no, PREVIEW_DPI)
    return send_file(
        __import__("io").BytesIO(png_bytes),
        mimetype="image/png",
        download_name=f"doc_{doc_id}_page_{page_no}.png",
    )


@api_bp.post("/docs/<int:doc_id>/title")
def save_title(doc_id: int):
    payload = request.get_json(force=True)
    title = (payload.get("title") or "").strip()
    db.execute("UPDATE documents SET title = ? WHERE id = ?", (title, doc_id))
    return jsonify({"ok": True, "title": title})


@api_bp.post("/docs/<int:doc_id>/paragraphs")
def create_paragraph(doc_id: int):
    payload = request.get_json(force=True)
    start_line_id = int(payload["start_line_id"])
    end_line_id = int(payload["end_line_id"])
    order_index = int(payload["order_index"])
    unit_type = (payload.get("unit_type") or "body").strip() or "body"
    heading_text = (payload.get("heading_text") or "").strip() or None

    start_line = db.fetch_one("SELECT * FROM lines WHERE id = ? AND doc_id = ?", (start_line_id, doc_id))
    end_line = db.fetch_one("SELECT * FROM lines WHERE id = ? AND doc_id = ?", (end_line_id, doc_id))
    if start_line is None or end_line is None:
        abort(400, "invalid line ids")

    lines = db.fetch_all(
        """
        SELECT * FROM lines
        WHERE doc_id = ?
          AND (
            page_no > ? OR (page_no = ? AND line_no >= ?)
          )
          AND (
            page_no < ? OR (page_no = ? AND line_no <= ?)
          )
        ORDER BY page_no, line_no
        """,
        (
            doc_id,
            start_line["page_no"],
            start_line["page_no"],
            start_line["line_no"],
            end_line["page_no"],
            end_line["page_no"],
            end_line["line_no"],
        ),
    )
    raw_text = build_paragraph_text(lines)
    normalized_text = normalize_paragraph_text(raw_text)
    paragraph_id = db.execute(
        """
        INSERT INTO paragraphs
        (doc_id, order_index, unit_type, page_no, end_page_no, start_line_id, end_line_id, heading_text, raw_text, normalized_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            doc_id,
            order_index,
            unit_type,
            start_line["page_no"],
            end_line["page_no"],
            start_line_id,
            end_line_id,
            heading_text,
            raw_text,
            normalized_text,
        ),
    )
    return jsonify({"ok": True, "paragraph_id": paragraph_id})


@api_bp.get("/docs/<int:doc_id>/paragraphs")
def list_paragraphs(doc_id: int):
    paragraphs = db.fetch_all(
        "SELECT * FROM paragraphs WHERE doc_id = ? ORDER BY order_index",
        (doc_id,),
    )
    for paragraph in paragraphs:
        paragraph["sentences"] = db.fetch_all(
            "SELECT * FROM sentences WHERE paragraph_id = ? ORDER BY sentence_index",
            (paragraph["id"],),
        )
    return jsonify(paragraphs)


@api_bp.post("/paragraphs/<int:paragraph_id>/split_sentences")
def split_paragraph_sentences(paragraph_id: int):
    paragraph = db.fetch_one("SELECT * FROM paragraphs WHERE id = ?", (paragraph_id,))
    if paragraph is None:
        abort(404)

    db.execute("DELETE FROM sentences WHERE paragraph_id = ?", (paragraph_id,))
    sentences = split_sentences(paragraph["normalized_text"])
    db.execute_many(
        "INSERT INTO sentences (paragraph_id, sentence_index, source_text, translated_text) VALUES (?, ?, ?, ?)",
        [(paragraph_id, idx, text, None) for idx, text in enumerate(sentences)],
    )
    return jsonify({"ok": True, "count": len(sentences)})


@api_bp.post("/paragraphs/<int:paragraph_id>/translate")
def translate_paragraph(paragraph_id: int):
    sentence_rows = db.fetch_all(
        "SELECT * FROM sentences WHERE paragraph_id = ? ORDER BY sentence_index",
        (paragraph_id,),
    )
    texts = [row["source_text"] for row in sentence_rows]
    try:
        translated = translator.translate_texts(texts)
    except TranslatorError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    conn = db.get_db()
    for row, translated_text in zip(sentence_rows, translated):
        conn.execute(
            "UPDATE sentences SET translated_text = ? WHERE id = ?",
            (translated_text, row["id"]),
        )
    conn.commit()
    return jsonify({"ok": True, "count": len(translated), "deepl_enabled": translator.enabled})


@api_bp.post("/docs/<int:doc_id>/figures")
def create_figure(doc_id: int):
    payload = request.get_json(force=True)
    fig_no = str(payload.get("fig_no") or "").strip() or "FIG"
    page_no = int(payload["page_no"])
    image_bbox_payload = payload.get("image_bbox") or {}
    caption_bbox_payload = payload.get("caption_bbox") or None
    caption_text = (payload.get("caption_text") or "").strip() or None

    image_bbox = bbox_json(
        float(image_bbox_payload["x0"]),
        float(image_bbox_payload["y0"]),
        float(image_bbox_payload["x1"]),
        float(image_bbox_payload["y1"]),
    )
    caption_bbox = None
    if caption_bbox_payload:
        caption_bbox = bbox_json(
            float(caption_bbox_payload["x0"]),
            float(caption_bbox_payload["y0"]),
            float(caption_bbox_payload["x1"]),
            float(caption_bbox_payload["y1"]),
        )

    figure_id = db.execute(
        """
        INSERT INTO figures (doc_id, fig_no, page_no, image_bbox, caption_bbox, caption_text, image_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (doc_id, fig_no, page_no, image_bbox, caption_bbox, caption_text, None),
    )

    doc = db.fetch_one("SELECT * FROM documents WHERE id = ?", (doc_id,))
    image_path = save_figure_crop(doc_id, figure_id, doc["pdf_path"], page_no, image_bbox)
    db.execute("UPDATE figures SET image_path = ? WHERE id = ?", (image_path, figure_id))
    return jsonify({"ok": True, "figure_id": figure_id, "image_path": image_path})


@api_bp.get("/docs/<int:doc_id>/figures")
def list_figures(doc_id: int):
    figures = db.fetch_all("SELECT * FROM figures WHERE doc_id = ? ORDER BY page_no, id", (doc_id,))
    return jsonify(figures)


@api_bp.post("/sentences/<int:sentence_id>/figure_refs")
def create_sentence_figure_ref(sentence_id: int):
    payload = request.get_json(force=True)
    figure_id = int(payload["figure_id"])
    ref_label = (payload.get("ref_label") or "").strip() or None
    ref_text = (payload.get("ref_text") or "").strip() or None
    order_index = int(payload.get("order_index") or 0)

    ref_id = db.execute(
        """
        INSERT INTO sentence_figure_refs (sentence_id, figure_id, ref_label, ref_text, order_index)
        VALUES (?, ?, ?, ?, ?)
        """,
        (sentence_id, figure_id, ref_label, ref_text, order_index),
    )
    return jsonify({"ok": True, "id": ref_id})
