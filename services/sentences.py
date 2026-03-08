from __future__ import annotations

import re
from dataclasses import dataclass

# -----------------------------------------------------------------------------
# 文分割（sentence splitting）
# -----------------------------------------------------------------------------

# MVP: ピリオド等 + 空白 + 大文字 で区切る
_SENT_END_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z])")

# 余分な空白を正規化
_WS_RE = re.compile(r"\s+")

# -----------------------------------------------------------------------------
# marker 復元用（DeepLが <> を改変する問題に耐性を持たせる）
# 例:
#   <<<SENT_0001>>>
#   <<<SENT_0001>>
#   <<<<SENT_0001>>
# などを許容
# -----------------------------------------------------------------------------

_MARKER_FUZZY_RE = re.compile(r"(<{3,})(SENT_\d{4})(>{1,})")


# -----------------------------------------------------------------------------
# データ構造
# -----------------------------------------------------------------------------

@dataclass
class SentenceUnit:
    idx: int
    marker: str      # canonical: <<<SENT_0001>>>
    text_en: str


# -----------------------------------------------------------------------------
# 基本ユーティリティ
# -----------------------------------------------------------------------------

def normalize_space(text: str) -> str:
    return _WS_RE.sub(" ", text).strip()


def split_sentences(text: str) -> list[str]:
    t = normalize_space(text)
    if not t:
        return []
    parts = _SENT_END_RE.split(t)
    return [p.strip() for p in parts if p.strip()]


def make_marker(i: int) -> str:
    # canonical marker（内部では必ずこれを使う）
    return f"<<<SENT_{i:04d}>>>"


# -----------------------------------------------------------------------------
# 文単位生成
# -----------------------------------------------------------------------------

def build_sentence_units(block_text: str) -> list[SentenceUnit]:
    sents = split_sentences(block_text)
    units: list[SentenceUnit] = []
    for i, s in enumerate(sents, start=1):
        units.append(
            SentenceUnit(
                idx=i - 1,
                marker=make_marker(i),
                text_en=s
            )
        )
    return units


# -----------------------------------------------------------------------------
# DeepL送信用文字列生成
# -----------------------------------------------------------------------------

def compose_for_translation(units: list[SentenceUnit]) -> str:
    """
    DeepLへ送る文字列：
    markerを行頭に置き、marker + 半角スペース + 英文
    """
    lines = [f"{u.marker} {u.text_en}" for u in units]
    return "\n".join(lines)


# -----------------------------------------------------------------------------
# marker 正規化
# -----------------------------------------------------------------------------

def _canonicalize_marker(raw: str) -> str | None:
    """
    DeepLが改変した marker を canonical に戻す。
    """
    m = _MARKER_FUZZY_RE.fullmatch(raw)
    if not m:
        return None
    name = m.group(2)  # SENT_0001
    return f"<<<{name}>>>"


# -----------------------------------------------------------------------------
# DeepL後のテキストを marker ごとに分解
# -----------------------------------------------------------------------------

def split_translated_by_marker(translated_text: str) -> dict[str, str]:
    """
    DeepL返却テキストから marker ごとに文を復元する。
    戻り値: { canonical_marker: translated_sentence }
    """

    tokens = _MARKER_FUZZY_RE.split(translated_text)

    # splitの形:
    # [prefix,
    #  "<{3,}", "SENT_0001", ">{1,}", chunk,
    #  "<{3,}", "SENT_0002", ">{1,}", chunk,
    #  ...]
    out: dict[str, str] = {}
    i = 0

    while i < len(tokens):
        if (
            i + 3 < len(tokens)
            and tokens[i].startswith("<")
            and tokens[i+1].startswith("SENT_")
            and tokens[i+2].startswith(">")
        ):
            raw_marker = tokens[i] + tokens[i+1] + tokens[i+2]
            canon = _canonicalize_marker(raw_marker)
            chunk = tokens[i+3]

            if canon:
                out[canon] = normalize_space(
                    chunk.lstrip(":：-— ").strip()
                )

            i += 4
        else:
            i += 1

    return out