from __future__ import annotations

from typing import Iterable

import requests

from config import DEEPL_AUTH_KEY, DEEPL_BASE_URL, DEEPL_TARGET_LANG

import html
import xml.etree.ElementTree as ET

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
    
    def _build_sentence_xml(self, texts: list[str]) -> str:
        parts = ["<p>"]
        for idx, text in enumerate(texts):
            escaped = html.escape(text or "")
            parts.append(f'<s i="{idx}">{escaped}</s>')
        parts.append("</p>")
        return "".join(parts)

    def _parse_sentence_xml(self, xml_text: str, expected_count: int) -> list[str]:
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as exc:
            raise TranslatorError(f"DeepL XML parse error: {exc}") from exc

        result: list[str] = []
        for node in root.findall(".//s"):
            result.append("".join(node.itertext()).strip())

        if len(result) != expected_count:
            raise TranslatorError(
                f"DeepL XML sentence count mismatch: expected={expected_count}, got={len(result)}"
            )

        return result

    def translate_sentences_as_paragraph(self, texts: list[str]) -> list[str]:
        if not texts:
            return []
        if not self.enabled:
            return ["" for _ in texts]

        xml_text = self._build_sentence_xml(texts)

        url = f"{self.base_url}/v2/translate"
        data: list[tuple[str, str]] = [
            ("target_lang", self.target_lang),
            ("text", xml_text),
            ("tag_handling", "xml"),
            ("split_sentences", "nonewlines"),
        ]

        # 新しいタグ処理を使うなら付ける
        data.append(("tag_handling_version", "v2"))

        response = requests.post(
            url,
            headers={"Authorization": f"DeepL-Auth-Key {self.auth_key}"},
            data=data,
            timeout=60,
        )
        if response.status_code >= 400:
            raise TranslatorError(f"DeepL error: {response.status_code} {response.text}")

        payload = response.json()
        translations = payload.get("translations", [])
        translated_xml = translations[0].get("text", "") if translations else ""

        return self._parse_sentence_xml(translated_xml, len(texts))

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
