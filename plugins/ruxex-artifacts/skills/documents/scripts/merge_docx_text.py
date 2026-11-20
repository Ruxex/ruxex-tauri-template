#!/usr/bin/env python3
"""Append simple text paragraphs from one DOCX to another."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
BUILTIN_STYLES = {"Normal", "Title", "Subtitle", "Caption", "Quote", "IntenseQuote"} | {
    f"Heading{level}" for level in range(1, 10)
}
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def appendable_paragraphs(xml: bytes) -> tuple[ET.Element, list[ET.Element]]:
    root = parse_xml(xml)
    body = root.find(f".//{W}body")
    if body is None:
        raise ValueError("DOCX body is missing")
    for node in root.iter():
        local_name = node.tag.rsplit("}", 1)[-1]
        if local_name in {
            "tbl", "sdt", "drawing", "pict", "object", "fldChar", "instrText",
            "ins", "del", "commentRangeStart", "commentRangeEnd", "commentReference",
            "footnoteReference", "endnoteReference", "bookmarkStart", "bookmarkEnd", "hyperlink",
        }:
            raise ValueError(f"source contains unsupported merge content: {local_name}")
        if any(name.startswith("{" + R + "}") for name in node.attrib):
            raise ValueError("source contains relationship-backed content such as links or images")
        if node.tag == W + "pStyle":
            style = node.get(W + "val", "")
            if style and style not in BUILTIN_STYLES:
                raise ValueError(f"source uses a custom paragraph style: {style}")
        if node.tag == W + "numPr":
            raise ValueError("source contains numbering whose definitions may not match")
    paragraphs = [child for child in list(body) if child.tag == W + "p"]
    if any(child.tag not in {W + "p", W + "sectPr"} for child in list(body)):
        raise ValueError("source body contains non-paragraph content")
    return body, paragraphs


def merge(base_path: Path, append_path: Path, output_path: Path) -> dict:
    base = base_path.expanduser().resolve(strict=True)
    append = append_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if any(not path.is_file() or path.suffix.lower() != ".docx" for path in (base, append)):
        raise ValueError("both inputs must be regular .docx files")
    if output.suffix.lower() != ".docx" or output in {base, append}:
        raise ValueError("output must be a separate .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(base) as base_archive, zipfile.ZipFile(append) as append_archive:
            base_xml = base_archive.read("word/document.xml")
            append_xml = append_archive.read("word/document.xml")
            merged_root = parse_xml(base_xml)
            base_body = merged_root.find(f".//{W}body")
            if base_body is None:
                raise ValueError("base DOCX body is missing")
            _, new_paragraphs = appendable_paragraphs(append_xml)
            sect_pr = base_body.find(W + "sectPr")
            insert_at = list(base_body).index(sect_pr) if sect_pr is not None else len(base_body)
            for offset, paragraph in enumerate(new_paragraphs):
                base_body.insert(insert_at + offset, paragraph)
            merged_xml = serialize_xml(merged_root, base_xml)
            entries = [(name, merged_xml if name == "word/document.xml" else base_archive.read(name))
                       for name in base_archive.namelist()]
        with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
            with zipfile.ZipFile(base) as original:
                for name, data in entries:
                    target.writestr(original.getinfo(name), data)
    except Exception:
        if output.exists():
            output.unlink()
        raise
    return {
        "ok": True,
        "output": str(output),
        "appendedParagraphs": len(new_paragraphs),
        "limitations": ["appends plain paragraphs only; retains base section properties and package parts"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--append", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(merge(args.base, args.append, args.output), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
