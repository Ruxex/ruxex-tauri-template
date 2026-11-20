#!/usr/bin/env python3
"""Remove classic VML text watermarks or Word editing protection from a DOCX copy."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
V = "{urn:schemas-microsoft-com:vml}"
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def remove_controls(input_path: Path, output_path: Path, kind: str, watermark_text: str | None) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or source == output:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    changed_parts = []
    try:
        with zipfile.ZipFile(source) as archive:
            entries = []
            for name in archive.namelist():
                data = archive.read(name)
                part_count = 0
                if kind == "watermark" and name.startswith("word/") and name.endswith(".xml") and not name.startswith("word/theme/"):
                    root = parse_xml(data)
                    for pict in list(root.iter(W + "pict")):
                        watermark_nodes = pict.findall(f".//{V}textpath")
                        matched = [node for node in watermark_nodes if node.get("string", "")]
                        if watermark_text is not None:
                            matched = [node for node in matched if node.get("string", "") == watermark_text]
                        if not matched:
                            continue
                        parent = next((node for node in root.iter() if pict in list(node)), None)
                        if parent is not None:
                            parent.remove(pict)
                            part_count += 1
                    if part_count:
                        data = serialize_xml(root, data)
                elif kind == "protection" and name == "word/settings.xml":
                    root = parse_xml(data)
                    protection = root.find(W + "documentProtection")
                    if protection is not None:
                        root.remove(protection)
                        part_count = 1
                        data = serialize_xml(root, data)
                if part_count:
                    count += part_count
                    changed_parts.append(name)
                entries.append((name, data))
        if count == 0:
            raise ValueError(f"no matching {kind} control was found")
        with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
            with zipfile.ZipFile(source) as original:
                for name, data in entries:
                    target.writestr(original.getinfo(name), data)
    except Exception:
        if output.exists():
            output.unlink()
        raise
    return {"ok": True, "kind": kind, "input": str(source), "output": str(output), "removed": count, "modifiedParts": changed_parts}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--kind", required=True, choices=("watermark", "protection"))
    parser.add_argument("--text", help="remove only a matching watermark label")
    args = parser.parse_args()
    if args.kind == "protection" and args.text is not None:
        parser.error("--text applies only when --kind=watermark")
    try:
        print(json.dumps(remove_controls(args.input, args.output, args.kind, args.text), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
