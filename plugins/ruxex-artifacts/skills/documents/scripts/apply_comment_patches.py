#!/usr/bin/env python3
"""Apply JSON lifecycle edits to classic comments in a DOCX copy.

Patch format: ``{"ops":[{"id":0,"append":"Follow-up"},
{"id":1,"replace":"Updated"},{"id":1,"resolved":true}]}``.
Replace runs before append within one operation. Newlines create comment
paragraphs; blank lines are skipped. Only classic ``word/comments.xml`` is
handled; modern threaded comments are not supported.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def split_lines(value: object) -> list[str]:
    return [line.strip() for line in str(value).splitlines() if line.strip()]


def append_paragraph(comment: ET.Element, text: str) -> None:
    paragraph = ET.SubElement(comment, W + "p")
    run = ET.SubElement(paragraph, W + "r")
    node = ET.SubElement(run, W + "t")
    node.text = text
    if text[:1].isspace() or text[-1:].isspace():
        node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def replace_text(comment: ET.Element, text: str) -> None:
    for child in list(comment):
        if child.tag == W + "p":
            comment.remove(child)
    lines = split_lines(text)
    for line in lines or [""]:
        append_paragraph(comment, line)


def apply_patches(input_path: Path, patch_path: Path, output_path: Path) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    patch_file = patch_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or output == source:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    patch = json.loads(patch_file.read_text(encoding="utf-8"))
    ops = patch.get("ops", []) if isinstance(patch, dict) else None
    if not isinstance(ops, list):
        raise ValueError("patch JSON must contain an 'ops' array")
    output.parent.mkdir(parents=True, exist_ok=True)

    changes = 0
    touched_ids: set[str] = set()
    warnings: list[str] = []
    try:
        with zipfile.ZipFile(source) as archive:
            names = set(archive.namelist())
            if "word/comments.xml" not in names:
                raise ValueError("word/comments.xml not found")
            original_comments = archive.read("word/comments.xml")
            root = parse_xml(original_comments)
            by_id = {
                item.get(W + "id"): item
                for item in root.findall(W + "comment")
                if item.get(W + "id") is not None
            }

            for index, op in enumerate(ops):
                if not isinstance(op, dict) or op.get("id") is None:
                    warnings.append(f"operation {index}: missing comment id")
                    continue
                comment_id = str(op["id"])
                comment = by_id.get(comment_id)
                if comment is None:
                    warnings.append(f"comment id {comment_id} not found")
                    continue
                changed = False
                if op.get("replace") is not None:
                    replace_text(comment, str(op["replace"]))
                    changed = True
                if op.get("append") is not None:
                    for line in split_lines(op["append"]):
                        append_paragraph(comment, line)
                    changed = True
                if op.get("resolved") is True:
                    comment.set(W + "done", "1")
                    comment.set(W + "date", dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"))
                    changed = True
                elif op.get("resolved") is False and W + "done" in comment.attrib:
                    comment.attrib.pop(W + "done", None)
                    comment.set(W + "date", dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"))
                    changed = True
                if changed:
                    changes += 1
                    touched_ids.add(comment_id)

            if not touched_ids:
                raise ValueError("no matching comments were changed")
            replacement = serialize_xml(root, original_comments)
            with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
                for name in archive.namelist():
                    target.writestr(archive.getinfo(name), replacement if name == "word/comments.xml" else archive.read(name))
    except Exception:
        if output.exists():
            output.unlink()
        raise

    return {
        "ok": True,
        "input": str(source),
        "output": str(output),
        "comments_touched": len(touched_ids),
        "ops_applied": changes,
        "warnings": warnings,
        "limitations": ["classic comments only; modern threaded comment parts are not handled"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("patch_json", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = apply_patches(args.input, args.patch_json, args.out)
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError, KeyError, json.JSONDecodeError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
