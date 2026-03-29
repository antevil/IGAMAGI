from __future__ import annotations

from functools import lru_cache

import spacy


@lru_cache(maxsize=1)
def get_nlp():
    nlp = spacy.blank("en")
    if "sentencizer" not in nlp.pipe_names:
        nlp.add_pipe("sentencizer")
    return nlp


def split_sentences(text: str) -> list[str]:
    nlp = get_nlp()
    doc = nlp(text.strip())
    sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
    return sentences or ([text.strip()] if text.strip() else [])
