"""Small XML helpers that preserve root namespace declarations on rewrite."""

from __future__ import annotations

import io
from xml.sax.saxutils import quoteattr
from xml.etree import ElementTree as ET


def parse_xml(data: bytes) -> ET.Element:
    for _, (prefix, uri) in ET.iterparse(io.BytesIO(data), events=("start-ns",)):
        if prefix not in {"xml", "xmlns"}:
            ET.register_namespace(prefix, uri)
    parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True, insert_pis=True))
    return ET.fromstring(data, parser=parser)


def serialize_xml(root: ET.Element, original: bytes) -> bytes:
    declarations = []
    pending = []
    for event, value in ET.iterparse(io.BytesIO(original), events=("start-ns", "start")):
        if event == "start-ns":
            pending.append(value)
        else:
            declarations = pending
            break
    data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    declaration_end = data.find(b"?>")
    root_start = data.find(b"<", declaration_end + 2 if declaration_end >= 0 else 0)
    root_end = data.find(b">", root_start)
    opening = data[root_start:root_end]
    additions = []
    for prefix, uri in declarations:
        attribute = "xmlns" if not prefix else f"xmlns:{prefix}"
        if (attribute + "=").encode() not in opening:
            additions.append(f" {attribute}={quoteattr(uri)}")
    if additions:
        data = data[:root_end] + "".join(additions).encode("utf-8") + data[root_end:]
    return data
