# api_routes.py

from __future__ import annotations

import os
from flask import Blueprint, jsonify, request

api_bp = Blueprint("api", __name__, url_prefix="/api")

@api_bp.get("/translate_mock")
def translate_mock():
    """
    Mock translation endpoint.
    Required: index (int)
    Optional: text (str)  # 後で本物の翻訳に置き換える時に便利
    """
    raw_index = request.args.get("index", "").strip()
    if raw_index == "":
        return jsonify({"error": "missing index"}), 400

    try:
        index = int(raw_index)
    except ValueError:
        return jsonify({"error": "invalid index"}), 400

    text = (request.args.get("text") or "").strip()

    # --- mockの翻訳ロジック（適当でOK） ---
    if text:
        # 例: mockっぽく整形（長すぎる場合のガード）
        safe = text[:400]
        translation = f"【MOCK翻訳】({index}) {safe}"
    else:
        translation = f"【MOCK翻訳】({index}) (no text provided)"

    return jsonify(
        {
            "ok": True,
            "index": index,
            "translation": translation,
        }
    )