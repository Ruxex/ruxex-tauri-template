#!/usr/bin/env python3
"""Report direct paragraph/run formatting and fonts used in a DOCX package."""

from __future__ import annotations

import argparse
import json
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def lint(path: Path) -> dict:
    source = path.expanduser().resolve(strict=True)
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    with zipfile.ZipFile(source) as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    paragraphs = root.findall(f".//{W}p")
    directly_formatted = 0
    formatted_runs = 0
    heading_like = []
    fonts: Counter[str] = Counter()
    for index, paragraph in enumerate(paragraphs):
        ppr = paragraph.find(W + "pPr")
        paragraph_direct = bool(ppr is not None and any(child.tag != W + "pStyle" for child in ppr))
        runs = paragraph.findall(f"{W}r")
        run_direct = False
        text = "".join(node.text or "" for node in paragraph.findall(f".//{W}t"))
        for run in runs:
            rpr = run.find(W + "rPr")
            if rpr is None:
                continue
            direct_children = [child for child in rpr if child.tag != W + "rStyle"]
            run_direct |= bool(direct_children)
            for rfonts in rpr.findall(W + "rFonts"):
                for attribute in ("ascii", "hAnsi", "eastAsia", "cs"):
                    font = rfonts.get(W + attribute)
                    if font:
                        fonts[font] += 1
        if paragraph_direct or run_direct:
            directly_formatted += 1
        if run_direct:
            formatted_runs += 1
        style = ppr.find(W + "pStyle") if ppr is not None else None
        style_name = style.get(W + "val", "") if style is not None else ""
        if text.strip() and style_name.lower().startswith("heading"):
            heading_like.append({"index": index, "style": style_name, "text": text[:160]})
    return {
        "ok": True,
        "format": "docx",
        "input": str(source),
        "summary": {
            "paragraphs": len(paragraphs),
            "paragraphsWithDirectFormatting": directly_formatted,
            "paragraphsWithRunOverrides": formatted_runs,
            "headingParagraphs": len(heading_like),
        },
        "fonts": dict(sorted(fonts.items())),
        "headingParagraphs": heading_like,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(lint(args.input), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
