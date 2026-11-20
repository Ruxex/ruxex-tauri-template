#!/usr/bin/env python3
"""Create tracked text replacements in a DOCX using OOXML.

Each ``OLD=NEW`` request changes the first matching ``w:t`` node to a
``w:del`` plus ``w:ins`` pair and enables ``w:trackRevisions``. A replacement
must fit inside one simple run containing one text node; matches spanning
multiple runs and runs with additional inline content are left unchanged.
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
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
EMPTY_SETTINGS = (
    b'<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'
)
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def next_change_id(document: ET.Element) -> int:
    ids = []
    for node in document.iter():
        raw = node.get(W + "id")
        if raw is not None and raw.isdigit():
            ids.append(int(raw))
    return max(ids, default=0) + 1


def revision_text(tag: str, value: str) -> ET.Element:
    node = ET.Element(W + tag)
    run = ET.SubElement(node, W + "r")
    text_tag = "delText" if tag == "del" else "t"
    text = ET.SubElement(run, W + text_tag)
    text.text = value
    if value[:1].isspace() or value[-1:].isspace():
        text.set(XML_SPACE, "preserve")
    return node


def replace_first_in_node(text_node: ET.Element, parents: dict[ET.Element, ET.Element], old: str, new: str, change_id: int, author: str, timestamp: str) -> bool:
    value = text_node.text or ""
    if old not in value:
        return False
    run = parents.get(text_node)
    if run is None or run.tag != W + "r":
        return False
    parent = parents.get(run)
    if parent is None:
        return False
    # Avoid dropping tabs, drawings, field content, or additional text nodes.
    content_children = [child for child in list(run) if child.tag != W + "rPr"]
    if content_children != [text_node]:
        return False

    before, after = value.split(old, 1)
    replacement_nodes: list[ET.Element] = []
    if before:
        leading = ET.Element(W + "r")
        properties = run.find(W + "rPr")
        if properties is not None:
            leading.append(ET.fromstring(ET.tostring(properties, encoding="utf-8")))
        leading_text = ET.SubElement(leading, W + "t")
        leading_text.text = before
        if before[:1].isspace() or before[-1:].isspace():
            leading_text.set(XML_SPACE, "preserve")
        replacement_nodes.append(leading)

    deleted = revision_text("del", old)
    deleted.set(W + "id", str(change_id))
    deleted.set(W + "author", author)
    deleted.set(W + "date", timestamp)
    inserted = revision_text("ins", new)
    inserted.set(W + "id", str(change_id + 1))
    inserted.set(W + "author", author)
    inserted.set(W + "date", timestamp)
    replacement_nodes.extend((deleted, inserted))

    if after:
        trailing = ET.Element(W + "r")
        properties = run.find(W + "rPr")
        if properties is not None:
            trailing.append(ET.fromstring(ET.tostring(properties, encoding="utf-8")))
        trailing_text = ET.SubElement(trailing, W + "t")
        trailing_text.text = after
        if after[:1].isspace() or after[-1:].isspace():
            trailing_text.set(XML_SPACE, "preserve")
        replacement_nodes.append(trailing)

    index = list(parent).index(run)
    for offset, node in enumerate(replacement_nodes):
        parent.insert(index + offset, node)
    parent.remove(run)
    return True


def add_replacements(input_path: Path, output_path: Path, replacements: list[tuple[str, str]], author: str) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or output == source:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    if not author.strip() or not replacements or any(old == "" for old, _ in replacements):
        raise ValueError("author and at least one non-empty OLD replacement are required")
    output.parent.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(source) as archive:
            names = set(archive.namelist())
            original_document = archive.read("word/document.xml")
            document = parse_xml(original_document)
            settings_name = "word/settings.xml"
            original_settings = archive.read(settings_name) if settings_name in names else EMPTY_SETTINGS
            settings = parse_xml(original_settings)
            tracking_enabled = settings.find(W + "trackRevisions") is not None
            if not tracking_enabled:
                settings.insert(0, ET.Element(W + "trackRevisions"))

            change_id = next_change_id(document)
            timestamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            applied: list[dict[str, str]] = []
            unmatched: list[str] = []
            for old, new in replacements:
                changed = False
                parents = {child: node for node in document.iter() for child in node}
                for text_node in list(document.iter(W + "t")):
                    if replace_first_in_node(text_node, parents, old, new, change_id, author, timestamp):
                        applied.append({"old": old, "new": new})
                        change_id += 2
                        changed = True
                        break
                if not changed:
                    unmatched.append(old)

            overrides = {
                "word/document.xml": serialize_xml(document, original_document),
                settings_name: serialize_xml(settings, original_settings),
            }
            with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
                for name in archive.namelist():
                    target.writestr(archive.getinfo(name), overrides.get(name, archive.read(name)))
                if settings_name not in names:
                    target.writestr(settings_name, overrides[settings_name])
    except Exception:
        if output.exists():
            output.unlink()
        raise

    return {
        "ok": True,
        "input": str(source),
        "output": str(output),
        "author": author,
        "replacements": len(applied),
        "unmatched": unmatched,
        "trackingEnabled": True,
        "limitations": [
            "replacements are limited to one simple w:t text node",
            "matches spanning multiple runs or runs with additional inline content are not changed",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--author", default="Ruxex")
    parser.add_argument("--replace", action="append", default=[], metavar="OLD=NEW", help="Tracked replacement (repeatable)")
    args = parser.parse_args()
    replacements = []
    for value in args.replace:
        if "=" not in value:
            parser.error("--replace must be formatted as OLD=NEW")
        replacements.append(tuple(value.split("=", 1)))
    if not replacements:
        parser.error("provide at least one --replace")
    try:
        result = add_replacements(args.input, args.out, replacements, args.author)
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError, KeyError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
