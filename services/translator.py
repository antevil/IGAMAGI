from __future__ import annotations

from typing import Iterable

import requests

from config import DEEPL_AUTH_KEY, DEEPL_BASE_URL, DEEPL_TARGET_LANG


class TranslatorError(RuntimeError):
    pass


class DeepLTranslator:
    def __init__(self, auth_key: str, base_url: str, target_lang: str) -> None:
        self.auth_key = auth_key
        self.base_url = base_url.rstrip("/")
        self.target_lang = target_lang

    @property
    def enabled(self) -> bool:
        return bool(self.auth_key)

    def translate_texts(self, texts: list[str]) -> list[str]:
        if not texts:
            return []
        if not self.enabled:
            return ["" for _ in texts]

        url = f"{self.base_url}/v2/translate"
        data: list[tuple[str, str]] = [("target_lang", self.target_lang)]
        for text in texts:
            data.append(("text", text))

        response = requests.post(
            url,
            headers={"Authorization": f"DeepL-Auth-Key {self.auth_key}"},
            data=data,
            timeout=60,
        )
        if response.status_code >= 400:
            raise TranslatorError(f"DeepL error: {response.status_code} {response.text}")
        payload = response.json()
        return [item.get("text", "") for item in payload.get("translations", [])]


translator = DeepLTranslator(DEEPL_AUTH_KEY, DEEPL_BASE_URL, DEEPL_TARGET_LANG)
