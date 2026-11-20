#!/usr/bin/env python3
"""List, create and fill plain-text Word content controls in local DOCX files."""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from copy import deepcopy
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
PLACEHOLDER = re.compile(r"(?<!\{)\{\{([A-Za-z0-9_-]+)\}\}(?!\})")
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def word_xml_parts(archive: zipfile.ZipFile) -> list[str]:
    return [
        name for name in archive.namelist()
        if name.startswith("word/") and name.endswith(".xml")
        and not name.startswith("word/theme/")
    ]


def control_record(part: str, control: ET.Element) -> dict:
    properties = control.find(W + "sdtPr")
    tag = properties.find(W + "tag") if properties is not None else None
    alias = properties.find(W + "alias") if properties is not None else None
    content = control.find(W + "sdtContent")
    control_type = "plainText" if properties is not None and properties.find(W + "text") is not None else "other"
    return {
        "part": part,
        "tag": tag.get(W + "val", "") if tag is not None else "",
        "alias": alias.get(W + "val", "") if alias is not None else "",
        "type": control_type,
        "text": "".join(node.text or "" for node in content.findall(f".//{W}t")) if content is not None else "",
    }


def list_controls(input_path: Path) -> list[dict]:
    source = input_path.expanduser().resolve(strict=True)
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    with zipfile.ZipFile(source) as archive:
        controls = []
        for part in word_xml_parts(archive):
            root = parse_xml(archive.read(part))
            controls.extend(control_record(part, control) for control in root.findall(f".//{W}sdt"))
    return controls


def set_control_text(control: ET.Element, value: str) -> None:
    content = control.find(W + "sdtContent")
    if content is None:
        content = ET.SubElement(control, W + "sdtContent")
    paragraph = content.find(W + "p")
    if paragraph is None and content.find(W + "r") is None:
        paragraph = ET.SubElement(content, W + "p")
    container = paragraph if paragraph is not None else content
    run = container.find(W + "r")
    if run is None:
        run = ET.SubElement(container, W + "r")
    text_nodes = run.findall(W + "t")
    if text_nodes:
        first = text_nodes[0]
    else:
        first = ET.SubElement(run, W + "t")
    first.text = value
    if value[:1].isspace() or value[-1:].isspace():
        first.set(XML_SPACE, "preserve")
    else:
        first.attrib.pop(XML_SPACE, None)
    for text_node in text_nodes[1:]:
        text_node.text = ""
    for text_node in content.findall(f".//{W}t"):
        if text_node is not first:
            text_node.text = ""


def wrap_placeholders(input_path: Path, output_path: Path) -> dict:
    """Create inline SDTs only in direct main-body paragraphs, after preflight."""
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or source == output:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")

    with zipfile.ZipFile(source) as archive:
        tags, ids = set(), set()
        for part in word_xml_parts(archive):
            root = parse_xml(archive.read(part))
            for control in root.iter(W + "sdt"):
                tags.add(control_record(part, control)["tag"])
                identifier = control.find(f"{W}sdtPr/{W}id")
                if identifier is not None:
                    try:
                        ids.add(int(identifier.get(W + "val", "")))
                    except ValueError:
                        raise ValueError("existing content-control ID must be an integer") from None
        original = archive.read("word/document.xml")
        root = parse_xml(original)
        plans = []
        for paragraph in root.findall(f"{W}body/{W}p"):
            # Existing SDTs are opaque: never nest a new control inside one.
            children = [child for child in paragraph if child.tag != W + "sdt"]
            full = "".join(t.text or "" for child in children for t in child.iter(W + "t"))
            matches = list(PLACEHOLDER.finditer(full))
            remainder = PLACEHOLDER.sub("", full)
            if "{{" in remainder or "}}" in remainder:
                raise ValueError("malformed or unsupported {{TAG}} marker in main-body paragraph")
            found = 0
            for child in children:
                text = "".join(t.text or "" for t in child.iter(W + "t"))
                tokens = list(PLACEHOLDER.finditer(text))
                if not tokens:
                    continue
                if child.tag != W + "r" or any(node.tag not in {W + "rPr", W + "t"} for node in child):
                    raise ValueError("markers require a direct paragraph run containing only text and run properties")
                for token in tokens:
                    tag = token.group(1)
                    if tag in tags:
                        raise ValueError(f"duplicate or existing content-control tag: {tag!r}")
                    tags.add(tag)
                found += len(tokens)
                plans.append((paragraph, child, text, tokens))
            if found != len(matches):
                raise ValueError("markers split across runs or unsupported containers must be retyped in a single text run")
        if not plans:
            raise ValueError("no {{TAG}} placeholders found in supported main-body paragraphs")

        next_id = 1
        created = []
        for paragraph, run, text, tokens in plans:
            run_properties = run.find(W + "rPr")

            def text_run(value: str) -> ET.Element:
                node = ET.Element(W + "r", run.attrib)
                if run_properties is not None:
                    node.append(deepcopy(run_properties))
                text_node = ET.SubElement(node, W + "t")
                text_node.text = value
                if value[:1].isspace() or value[-1:].isspace():
                    text_node.set(XML_SPACE, "preserve")
                return node

            replacements = []
            position = 0
            for token in tokens:
                if token.start() > position:
                    replacements.append(text_run(text[position:token.start()]))
                tag = token.group(1)
                while next_id in ids:
                    next_id += 1
                control = ET.Element(W + "sdt")
                properties = ET.SubElement(control, W + "sdtPr")
                for name, value in (("tag", tag), ("alias", tag), ("id", str(next_id))):
                    ET.SubElement(properties, W + name, {W + "val": value})
                ET.SubElement(properties, W + "text")
                ET.SubElement(control, W + "sdtContent").append(text_run(token.group()))
                replacements.append(control)
                created.append(tag)
                ids.add(next_id)
                next_id += 1
                position = token.end()
            if position < len(text):
                replacements.append(text_run(text[position:]))
            replacements[-1].tail = run.tail
            index = list(paragraph).index(run)
            paragraph.remove(run)
            for offset, replacement in enumerate(replacements):
                paragraph.insert(index + offset, replacement)

        data = serialize_xml(root, original)
        output.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output, "x") as target:
            for info in archive.infolist():
                target.writestr(info, data if info.filename == "word/document.xml" else archive.read(info))
    return {"ok": True, "output": str(output), "matches": len(created), "tags": created, "parts": ["word/document.xml"]}


def fill_control(input_path: Path, output_path: Path, tag: str, value: str) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or source == output:
        raise ValueError("output must be a different .docx file")
    if not tag:
        raise ValueError("tag must be non-empty")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)

    modified = []
    try:
        with zipfile.ZipFile(source) as archive:
            entries = []
            for name in archive.namelist():
                data = archive.read(name)
                if name.startswith("word/") and name.endswith(".xml") and not name.startswith("word/theme/"):
                    root = parse_xml(data)
                    part_matches = []
                    for control in root.findall(f".//{W}sdt"):
                        record = control_record(name, control)
                        if record["tag"] != tag:
                            continue
                        if record["type"] != "plainText":
                            raise ValueError(f"tag {tag!r} is not a plain-text content control")
                        set_control_text(control, value)
                        part_matches.append(control)
                    if part_matches:
                        data = serialize_xml(root, data)
                        modified.extend([name] * len(part_matches))
                entries.append((name, data))
        if not modified:
            raise ValueError(f"no plain-text content control found with tag {tag!r}")
        with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
            with zipfile.ZipFile(source) as original:
                for name, data in entries:
                    info = original.getinfo(name)
                    target.writestr(info, data)
    except Exception:
        if output.exists():
            output.unlink()
        raise
    return {"ok": True, "output": str(output), "tag": tag, "value": value, "matches": len(modified), "parts": modified}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    listing = commands.add_parser("list", help="list tagged content controls")
    listing.add_argument("--input", required=True, type=Path)
    wrapping = commands.add_parser("wrap_placeholders", help="wrap exact {{TAG}} markers in main-body paragraphs")
    wrapping.add_argument("--input", required=True, type=Path)
    wrapping.add_argument("--output", required=True, type=Path)
    filling = commands.add_parser("fill", help="fill a tagged plain-text control")
    filling.add_argument("--input", required=True, type=Path)
    filling.add_argument("--output", required=True, type=Path)
    filling.add_argument("--tag", required=True)
    filling.add_argument("--value", required=True)
    args = parser.parse_args()
    try:
        if args.command == "list":
            print(json.dumps({"ok": True, "controls": list_controls(args.input)}, ensure_ascii=False, indent=2))
        elif args.command == "wrap_placeholders":
            print(json.dumps(wrap_placeholders(args.input, args.output), ensure_ascii=False, indent=2))
        else:
            print(json.dumps(fill_control(args.input, args.output, args.tag, args.value), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
