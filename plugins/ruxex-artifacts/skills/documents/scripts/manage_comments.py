#!/usr/bin/env python3
"""Update, mark resolved, or remove classic Word comments in a DOCX copy."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
COMMENT_MARKERS = {W + "commentRangeStart", W + "commentRangeEnd", W + "commentReference"}
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def replace_comment_text(comment: ET.Element, value: str) -> None:
    for child in list(comment):
        if child.tag != W + "p":
            comment.remove(child)
    paragraph = comment.find(W + "p")
    if paragraph is None:
        paragraph = ET.SubElement(comment, W + "p")
    else:
        for child in list(paragraph):
            paragraph.remove(child)
    run = ET.SubElement(paragraph, W + "r")
    text = ET.SubElement(run, W + "t")
    text.text = value
    if value[:1].isspace() or value[-1:].isspace():
        text.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def transform(source_path: Path, output_path: Path, operation: str, comment_id: str | None, text: str | None, resolved: bool | None) -> dict:
    source = source_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or source == output:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    changes = 0
    try:
        with zipfile.ZipFile(source) as archive:
            entries = []
            for name in archive.namelist():
                data = archive.read(name)
                if name.startswith("word/") and name.endswith(".xml") and not name.startswith("word/theme/"):
                    root = parse_xml(data)
                    part_changes = 0
                    if operation == "strip":
                        for element in list(root.iter()):
                            if element.tag not in COMMENT_MARKERS:
                                continue
                            parent = next((node for node in root.iter() if element in list(node)), None)
                            if parent is not None:
                                parent.remove(element)
                                part_changes += 1
                    if name == "word/comments.xml":
                        comments = root.findall(W + "comment")
                        target = next((item for item in comments if item.get(W + "id") == comment_id), None)
                        if operation == "strip":
                            for item in comments:
                                root.remove(item)
                                part_changes += 1
                        elif target is not None and operation == "update":
                            replace_comment_text(target, text or "")
                            part_changes += 1
                        elif target is not None and operation == "resolve":
                            if resolved:
                                target.set(W + "done", "1")
                            else:
                                target.attrib.pop(W + "done", None)
                            part_changes += 1
                    if part_changes:
                        data = serialize_xml(root, data)
                        changes += part_changes
                entries.append((name, data))
        if changes == 0:
            raise ValueError("no matching classic comment markup was found")
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
        "operation": operation,
        "input": str(source),
        "output": str(output),
        "changes": changes,
        "limitations": ["classic comments only; modern threaded comment parts and interoperability are not fully handled"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--operation", required=True, choices=("update", "resolve", "strip"))
    parser.add_argument("--id", help="comment ID for update/resolve")
    parser.add_argument("--text", help="replacement text for update")
    parser.add_argument("--resolved", choices=("true", "false"), default="true")
    args = parser.parse_args()
    if args.operation in {"update", "resolve"} and args.id is None:
        parser.error("--id is required for update and resolve")
    if args.operation == "update" and args.text is None:
        parser.error("--text is required for update")
    try:
        result = transform(
            args.input,
            args.output,
            args.operation,
            args.id,
            args.text,
            args.resolved == "true",
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
