#!/usr/bin/env python3
"""Extract classic Word comments or tracked revision wrappers from DOCX."""

from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def parse_xml(data: bytes) -> ET.Element:
    return ET.fromstring(data)


def extract_comments(archive: zipfile.ZipFile) -> list[dict]:
    try:
        comments_root = parse_xml(archive.read("word/comments.xml"))
    except KeyError:
        return []
    try:
        document_root = parse_xml(archive.read("word/document.xml"))
    except KeyError:
        document_root = ET.Element(W + "document")
    anchors: dict[str, dict[str, int]] = {}
    for tag, field in (("commentRangeStart", "rangeStarts"), ("commentRangeEnd", "rangeEnds"), ("commentReference", "references")):
        for element in document_root.findall(f".//{W}{tag}"):
            comment_id = element.get(W + "id", "")
            anchors.setdefault(comment_id, {"rangeStarts": 0, "rangeEnds": 0, "references": 0})[field] += 1
    results = []
    for comment in comments_root.findall(W + "comment"):
        comment_id = comment.get(W + "id", "")
        results.append({
            "id": comment_id,
            "author": comment.get(W + "author", ""),
            "initials": comment.get(W + "initials", ""),
            "date": comment.get(W + "date", ""),
            "text": "".join(node.text or "" for node in comment.findall(f".//{W}t")),
            "anchors": anchors.get(comment_id, {"rangeStarts": 0, "rangeEnds": 0, "references": 0}),
        })
    return results


def extract_revisions(archive: zipfile.ZipFile) -> list[dict]:
    results = []
    revision_tags = ("ins", "del", "moveFrom", "moveTo")
    for part in archive.namelist():
        if not part.startswith("word/") or not part.endswith(".xml"):
            continue
        try:
            root = parse_xml(archive.read(part))
        except ET.ParseError:
            continue
        for tag in revision_tags:
            for revision in root.findall(f".//{W}{tag}"):
                text = "".join(
                    node.text or ""
                    for node in revision.iter()
                    if node.tag in {W + "t", W + "delText"}
                )
                results.append({
                    "part": part,
                    "kind": tag,
                    "id": revision.get(W + "id", ""),
                    "author": revision.get(W + "author", ""),
                    "date": revision.get(W + "date", ""),
                    "text": text,
                })
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--kind", required=True, choices=("comments", "revisions"))
    args = parser.parse_args()
    source = args.input.expanduser().resolve(strict=True)
    if not source.is_file() or source.suffix.lower() != ".docx":
        parser.error("input must be a regular .docx file")
    try:
        with zipfile.ZipFile(source) as archive:
            records = extract_comments(archive) if args.kind == "comments" else extract_revisions(archive)
    except (OSError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    print(json.dumps({"ok": True, "kind": args.kind, "input": str(source), "records": records}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
