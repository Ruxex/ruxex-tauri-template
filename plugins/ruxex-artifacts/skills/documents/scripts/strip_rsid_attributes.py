#!/usr/bin/env python3
"""Remove Word revision-session IDs from DOCX story parts.

This complements the native privacy-scrub command, which removes personal
core properties. It removes only attributes in the WordprocessingML namespace
whose local names start with ``rsid``; it does not redact text or other
metadata.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
STORY_PART = re.compile(r"^word/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$")


def strip_rsid_attributes(input_path: Path, output_path: Path) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or output == source:
        raise ValueError("output must be a separate .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")

    removed = 0
    parts_changed = []
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(source, "r") as original:
            with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as rewritten:
                for info in original.infolist():
                    name = info.filename
                    data = original.read(name)
                    if STORY_PART.fullmatch(name):
                        root = parse_xml(data)
                        count = 0
                        for element in root.iter():
                            for attribute in list(element.attrib):
                                if attribute.startswith(W + "rsid"):
                                    del element.attrib[attribute]
                                    count += 1
                        if count:
                            data = serialize_xml(root, data)
                            removed += count
                            parts_changed.append(name)
                    rewritten.writestr(info, data)
    except Exception:
        output.unlink(missing_ok=True)
        raise

    return {
        "ok": True,
        "input": str(source),
        "output": str(output),
        "rsidAttributesRemoved": removed,
        "partsChanged": parts_changed,
        "limitations": [
            "removes rsid attributes from document, header, footer, footnote, and endnote parts only",
            "does not redact in-document personal information or remove custom properties",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(strip_rsid_attributes(args.input, args.output), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
