#!/usr/bin/env python3
"""Add a classic VML text watermark to one existing, referenced DOCX header.

Requires a usable existing header: no header/relationship creation or section
rewriting. Multiple referenced headers require --header-part. Only the chosen
header XML is rewritten; other package part payloads and ZIP metadata are kept.
Rendering and header coverage vary by Word section and renderer; inspect pages.
"""

from __future__ import annotations

import argparse
import json
import posixpath
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
P = "{http://schemas.openxmlformats.org/package/2006/relationships}"
V = "{urn:schemas-microsoft-com:vml}"


def _header_target(archive: zipfile.ZipFile, header_part: str | None) -> str:
    names = archive.namelist()
    if len(names) != len(set(names)):
        raise ValueError("duplicate ZIP part names make the header target ambiguous")
    if "word/document.xml" not in names or "word/_rels/document.xml.rels" not in names:
        raise ValueError("no usable referenced header: document or relationships part is missing")
    document = parse_xml(archive.read("word/document.xml"))
    relationships = parse_xml(archive.read("word/_rels/document.xml.rels"))
    by_id = {}
    for relationship in relationships.findall(P + "Relationship"):
        identifier = relationship.get("Id")
        if identifier in by_id:
            raise ValueError("duplicate relationship IDs make the header target ambiguous")
        by_id[identifier] = relationship
    headers = set()
    for reference in document.iter(W + "headerReference"):
        relationship = by_id.get(reference.get(R + "id"))
        if relationship is None:
            raise ValueError("header reference has no matching relationship")
        if relationship.get("Type") != R[1:-1] + "/header" or relationship.get("TargetMode", "Internal") != "Internal":
            raise ValueError("header reference must point to an internal header relationship")
        target = relationship.get("Target", "")
        part = posixpath.normpath(target.lstrip("/")) if target.startswith("/") else posixpath.normpath(posixpath.join("word", target))
        if not part.startswith("word/") or not part.endswith(".xml") or part not in names:
            raise ValueError("referenced header part is missing or outside word/*.xml")
        headers.add(part)
    if header_part is not None:
        if header_part not in headers:
            raise ValueError("--header-part must name an existing referenced header part")
        return header_part
    if not headers:
        raise ValueError("no usable referenced header; this helper does not create headers")
    if len(headers) != 1:
        raise ValueError("multiple referenced headers; select one with --header-part")
    return next(iter(headers))


def add_watermark(input_path: Path, output_path: Path, text: str, header_part: str | None = None) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or output == source:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    if not text.strip() or any(not (ord(c) in (9, 10, 13) or 0x20 <= ord(c) <= 0xD7FF or 0xE000 <= ord(c) <= 0xFFFD or 0x10000 <= ord(c) <= 0x10FFFF) for c in text):
        raise ValueError("watermark text must be non-empty valid XML text")
    output_created = False
    try:
        with zipfile.ZipFile(source) as archive:
            part = _header_target(archive, header_part)
            original = archive.read(part)
            root = parse_xml(original)
            if root.tag != W + "hdr":
                raise ValueError("selected header must have a w:hdr root")
            ET.register_namespace("v", V[1:-1])
            used_ids = {node.get("id") for node in root.iter()}
            number = 1
            while f"RuxexWatermark{number}" in used_ids or f"RuxexWatermarkType{number}" in used_ids:
                number += 1
            paragraph = ET.SubElement(root, W + "p")
            pict = ET.SubElement(ET.SubElement(paragraph, W + "r"), W + "pict")
            shape_type = ET.SubElement(pict, V + "shapetype", {
                "id": f"RuxexWatermarkType{number}", "coordsize": "21600,21600",
                "path": "m0,0l21600,0m0,21600l21600,21600e",
            })
            ET.SubElement(shape_type, V + "path", {"textpathok": "t"})
            ET.SubElement(shape_type, V + "textpath", {"on": "t", "fitshape": "t"})
            shape = ET.SubElement(pict, V + "shape", {
                "id": f"RuxexWatermark{number}", "type": f"#RuxexWatermarkType{number}",
                "style": "position:absolute;margin-left:0;margin-top:0;width:468pt;height:117pt;rotation:315;z-index:-251654144;mso-position-horizontal:center;mso-position-horizontal-relative:page;mso-position-vertical:center;mso-position-vertical-relative:page",
                "fillcolor": "#C0C0C0", "stroked": "f",
            })
            ET.SubElement(shape, V + "fill", {"opacity": "0.15"})
            ET.SubElement(shape, V + "textpath", {"on": "t", "style": 'font-family:"Calibri";font-size:1pt', "string": text})
            patched = serialize_xml(root, original)
            output.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(output, "x") as target:
                output_created = True
                target.comment = archive.comment
                for info in archive.infolist():
                    target.writestr(info, patched if info.filename == part else archive.read(info))
    except Exception:
        if output_created:
            output.unlink(missing_ok=True)
        raise
    return {
        "ok": True, "input": str(source), "output": str(output), "modifiedParts": [part],
        "limitations": ["adds to one existing referenced header only; other section/first-page/even-page headers are unchanged", "classic VML text only; renderer appearance varies; render and inspect every page"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--text", required=True, help="non-empty watermark label")
    parser.add_argument("--header-part", help="referenced header ZIP path, e.g. word/header1.xml; required if multiple headers")
    args = parser.parse_args()
    try:
        print(json.dumps(add_watermark(args.input, args.output, args.text, args.header_part), ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
