from __future__ import annotations

import requests


class DeepLTranslator:
    def __init__(self, auth_key: str, base_url: str) -> None:
        self.auth_key = auth_key
        self.base_url = base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.auth_key)

    def translate_text(self, text: str, target_lang: str = "JA") -> str:
        if not self.enabled:
            return ""

        url = f"{self.base_url}/v2/translate"
        response = requests.post(
            url,
            headers={"Authorization": f"DeepL-Auth-Key {self.auth_key}"},
            data={
                "text": text,
                "target_lang": target_lang,
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        return data["translations"][0]["text"]

    def translate_paragraphs(self, paragraphs: list[str]) -> list[str]:
        results = []
        for p in paragraphs:
            try:
                results.append(self.translate_text(p))
            except Exception:
                results.append("")
        return results