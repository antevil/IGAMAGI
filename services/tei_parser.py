from __future__ import annotations

from lxml import etree

NS = {"tei": "http://www.tei-c.org/ns/1.0"}


def _text(el) -> str:
    if el is None:
        return ""
    return " ".join(" ".join(el.itertext()).split())


def parse_tei(tei_xml: str) -> dict:
    root = etree.fromstring(tei_xml.encode("utf-8"))

    title = _text(root.find(".//tei:titleStmt/tei:title", namespaces=NS))

    authors = []
    for a in root.findall(".//tei:sourceDesc//tei:author", namespaces=NS):
        name = _text(a)
        if name:
            authors.append(name)

    paragraphs = []
    for p in root.findall(".//tei:text//tei:body//tei:p", namespaces=NS):
        txt = _text(p)
        if txt:
            paragraphs.append(txt)

    figures = []
    for i, fig in enumerate(root.findall(".//tei:text//tei:figure", namespaces=NS), start=1):
        caption_parts = []
        head = fig.find("./tei:head", namespaces=NS)
        desc = fig.find("./tei:figDesc", namespaces=NS)

        if head is not None:
            t = _text(head)
            if t:
                caption_parts.append(t)

        if desc is not None:
            t = _text(desc)
            if t:
                caption_parts.append(t)

        caption = " ".join(caption_parts).strip()
        figures.append({
            "ord": i,
            "caption": caption,
        })

    references = []
    for i, bibl in enumerate(root.findall(".//tei:listBibl/tei:biblStruct", namespaces=NS), start=1):
        txt = _text(bibl)
        if txt:
            references.append(txt)

    return {
        "title": title,
        "authors": authors,
        "paragraphs": paragraphs,
        "figures": figures,
        "references": references,
    }