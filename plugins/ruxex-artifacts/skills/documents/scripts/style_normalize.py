#!/usr/bin/env python3
"""Clear selected direct formatting overrides in a separate DOCX copy."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
RUN_FORMATS = {
    "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike",
    "outline", "shadow", "emboss", "imprint", "color", "spacing", "w", "kern",
    "sz", "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText", "em",
}
PARAGRAPH_FORMATS = {
    "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numFmt",
    "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku",
    "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN",
    "adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents",
    "jc", "textAlignment", "textboxTightWrap",
}
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def normalize(input_path: Path, output_path: Path, clear_paragraphs: bool) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or source == output:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    counts = {"runFormattingProperties": 0, "paragraphFormattingProperties": 0}
    modified_parts = []
    try:
        with zipfile.ZipFile(source) as archive:
            entries = []
            for name in archive.namelist():
                data = archive.read(name)
                if name == "word/document.xml":
                    root = parse_xml(data)
                    part_count = 0
                    for run_properties in root.findall(f".//{W}rPr"):
                        for child in list(run_properties):
                            if child.tag.rsplit("}", 1)[-1] in RUN_FORMATS:
                                run_properties.remove(child)
                                counts["runFormattingProperties"] += 1
                                part_count += 1
                        if len(run_properties) == 0:
                            parent = next((node for node in root.iter() if run_properties in list(node)), None)
                            if parent is not None:
                                parent.remove(run_properties)
                    if clear_paragraphs:
                        for paragraph_properties in root.findall(f".//{W}pPr"):
                            for child in list(paragraph_properties):
                                if child.tag.rsplit("}", 1)[-1] in PARAGRAPH_FORMATS:
                                    paragraph_properties.remove(child)
                                    counts["paragraphFormattingProperties"] += 1
                                    part_count += 1
                    if part_count:
                        data = serialize_xml(root, data)
                        modified_parts.append(name)
                entries.append((name, data))
        if not counts["runFormattingProperties"] and not counts["paragraphFormattingProperties"]:
            raise ValueError("no selected direct formatting was found")
        with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
            with zipfile.ZipFile(source) as original:
                for name, data in entries:
                    target.writestr(original.getinfo(name), data)
    except Exception:
        if output.exists():
            output.unlink()
        raise
    return {
        "ok": True,
        "input": str(source),
        "output": str(output),
        "counts": counts,
        "modifiedParts": modified_parts,
        "limitations": ["does not copy styles from a template or normalize inherited style definitions"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--clear-paragraph-formatting", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(normalize(args.input, args.output, args.clear_paragraph_formatting), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
