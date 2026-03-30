from __future__ import annotations
import re
from functools import lru_cache

import spacy

@lru_cache(maxsize=1)
def get_nlp():
    nlp = spacy.blank("en")
    if "sentencizer" not in nlp.pipe_names:
        nlp.add_pipe("sentencizer")
    return nlp


def _post_split_sentence(sentence: str) -> list[str]:
    sentence = (sentence or "").strip()
    if not sentence:
        return []

    # 例:
    # "disease.105,106 Hopefully" -> "disease.105,106|||Hopefully"
    # "disease.105-107 Hopefully" -> "disease.105-107|||Hopefully"
    # "disease.105, 106 Hopefully" -> "disease.105, 106|||Hopefully"
    #
    # 数字や , - – を含む引用番号群を前の文に残し、
    # その直後が大文字ならそこで再分割する
    temp = re.sub(
        r"\.(\d+(?:\s*[-–,]\s*\d+)*)\s+([A-Z])",
        r".\1||| \2",
        sentence,
    )

    parts = temp.split("|||")
    return [p.strip() for p in parts if p.strip()]


def split_sentences(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []

    nlp = get_nlp()
    doc = nlp(text)

    result: list[str] = []
    for sent in doc.sents:
        chunk = sent.text.strip()
        if not chunk:
            continue
        result.extend(_post_split_sentence(chunk))

    return result or [text]