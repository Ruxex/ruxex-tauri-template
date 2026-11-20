#!/usr/bin/env python3
"""Extract classic DOCX comments and best-effort paragraph anchors as JSON.

The anchor report identifies paragraphs containing comment range markers in
the main document, headers, and footers. It does not reconstruct exact
character spans and does not inspect comments inside shapes/textboxes.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml


def paragraph_text(paragraph: ET.Element) -> str:
    parts: list[str] = []
    for element in paragraph.iter():
        if element.tag == W + "t":
            parts.append(element.text or "")
        elif element.tag == W + "tab":
            parts.append("\t")
        elif element.tag in {W + "br", W + "cr"}:
            parts.append("\n")
    return "".join(parts).strip()


def comment_text(comment: ET.Element) -> str:
    paragraphs = [paragraph_text(p) for p in comment.findall(W + "p")]
    paragraphs = [text for text in paragraphs if text]
    if paragraphs:
        return "\n".join(paragraphs)
    return "".join(item.text or "" for item in comment.iter(W + "t")).strip()


def numeric_sort_key(value: str) -> tuple[int, int | str]:
    return (0, int(value)) if value.isdigit() else (1, value)


def extract_comments(input_path: Path) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")

    with zipfile.ZipFile(source) as archive:
        names = set(archive.namelist())
        comments: dict[str, dict] = {}
        if "word/comments.xml" in names:
            root = parse_xml(archive.read("word/comments.xml"))
            for item in root.iter(W + "comment"):
                comment_id = item.get(W + "id")
                if comment_id is None:
                    continue
                comments[comment_id] = {
                    "id": comment_id,
                    "author": item.get(W + "author"),
                    "date": item.get(W + "date"),
                    "initials": item.get(W + "initials"),
                    "resolved": item.get(W + "done") == "1",
                    "text": comment_text(item),
                    "anchors": [],
                }

        parts = ["word/document.xml"]
        parts.extend(
            name
            for name in sorted(names)
            if re.fullmatch(r"word/(?:header|footer)\d+\.xml", name)
        )
        for part in parts:
            if part not in names:
                continue
            story = parse_xml(archive.read(part))
            for paragraph in story.iter(W + "p"):
                text = paragraph_text(paragraph)
                anchors: dict[str, list[str]] = {}
                for marker in paragraph.iter():
                    if marker.tag not in {W + "commentRangeStart", W + "commentRangeEnd"}:
                        continue
                    comment_id = marker.get(W + "id")
                    if comment_id is not None:
                        anchors.setdefault(comment_id, []).append(
                            "start" if marker.tag == W + "commentRangeStart" else "end"
                        )
                for comment_id, positions in anchors.items():
                    if comment_id in comments:
                        comments[comment_id]["anchors"].append({
                            "part": part,
                            "markers": positions,
                            "paragraph": text[:200],
                        })

    return {
        "file": str(source),
        "comment_count": len(comments),
        "comments": [comments[key] for key in sorted(comments, key=numeric_sort_key)],
        "limitations": [
            "classic comments only; modern threaded comment parts are not handled",
            "anchors report containing paragraphs, not exact character spans",
            "comments in shapes and textboxes are not handled",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = extract_comments(args.input)
        destination = args.out.expanduser().resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError, KeyError) as error:
        parser.error(str(error))
    print(f"[OK] wrote {destination} ({result['comment_count']} comments)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
