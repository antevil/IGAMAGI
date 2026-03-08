from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import requests


@dataclass
class DeepLConfig:
    auth_key: str
    base_url: str  # https://api-free.deepl.com or https://api.deepl.com
    source_lang: str = "EN"
    target_lang: str = "JA"


class DeepLTranslator:
    def __init__(self, cfg: DeepLConfig):
        self.cfg = cfg

    def translate_text(self, text: str) -> str:
        url = self.cfg.base_url.rstrip("/") + "/v2/translate"

        headers = {
            "Authorization": f"DeepL-Auth-Key {self.cfg.auth_key}",
        }

        data = {
            "text": text,
            "source_lang": self.cfg.source_lang,
            "target_lang": self.cfg.target_lang,
        }

        resp = requests.post(url, headers=headers, data=data, timeout=30)
        resp.raise_for_status()
        j = resp.json()
        return j["translations"][0]["text"]


def load_translator() -> Optional[DeepLTranslator]:
    key = os.environ.get("DEEPL_AUTH_KEY", "").strip()
    if not key:
        return None

    base_url = os.environ.get("DEEPL_BASE_URL", "").strip()
    if not base_url:
        base_url = "https://api-free.deepl.com"

    return DeepLTranslator(DeepLConfig(auth_key=key, base_url=base_url))