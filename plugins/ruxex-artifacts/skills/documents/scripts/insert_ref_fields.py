#!/usr/bin/env python3
"""Replace ``[[REF:bookmark]]`` markers with complex Word REF fields.

The complete marker must occur within one ``w:t`` node. Bookmark names must
start with an ASCII letter and contain at most 40 ASCII letters, digits, or
underscores. Fields are inserted in the body, headers, and footers. The
cached field result starts as ``0``; run ``process_fields.py --operation
update`` to populate body field results from matching bookmarks.
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
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
DEFAULT_PATTERN = r"\[\[REF:(?P<bookmark>[^\]\s]+)\]\]"
BOOKMARK_NAME = re.compile(r"[A-Za-z][A-Za-z0-9_]{0,39}\Z")
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def clone_run_properties(run: ET.Element) -> ET.Element | None:
    properties = run.find(W + "rPr")
    if properties is None:
        return None
    return ET.fromstring(ET.tostring(properties, encoding="utf-8"))


def make_text_run(text: str, properties: ET.Element | None) -> ET.Element:
    run = ET.Element(W + "r")
    if properties is not None:
        run.append(ET.fromstring(ET.tostring(properties, encoding="utf-8")))
    node = ET.SubElement(run, W + "t")
    node.text = text
    if text[:1].isspace() or text[-1:].isspace():
        node.set(XML_SPACE, "preserve")
    return run


def make_field_run(child_tag: str, properties: ET.Element | None, **attrs: str) -> ET.Element:
    run = ET.Element(W + "r")
    if properties is not None:
        run.append(ET.fromstring(ET.tostring(properties, encoding="utf-8")))
    child = ET.SubElement(run, W + child_tag)
    for key, value in attrs.items():
        child.set(W + key, value)
    return run


def ref_field_runs(bookmark: str, properties: ET.Element | None) -> list[ET.Element]:
    begin = make_field_run("fldChar", properties, fldCharType="begin")
    instruction = make_field_run("instrText", properties)
    instruction_node = instruction.find(W + "instrText")
    instruction_node.set(XML_SPACE, "preserve")
    instruction_node.text = f" REF {bookmark} \\h "
    separate = make_field_run("fldChar", properties, fldCharType="separate")
    result = make_text_run("0", properties)
    end = make_field_run("fldChar", properties, fldCharType="end")
    return [begin, instruction, separate, result, end]


def replace_markers(root: ET.Element, marker_pattern: re.Pattern[str], prefix: str) -> tuple[int, list[str], list[str]]:
    parents = {child: node for node in root.iter() for child in node}
    replaced = 0
    invalid: list[str] = []
    skipped: list[str] = []
    for text_node in list(root.iter(W + "t")):
        value = text_node.text or ""
        matches = list(marker_pattern.finditer(value))
        if not matches:
            continue
        run = parents.get(text_node)
        parent = parents.get(run) if run is not None else None
        if run is None or run.tag != W + "r" or parent is None:
            skipped.extend(match.group(0) for match in matches)
            continue
        content_children = [child for child in list(run) if child.tag != W + "rPr"]
        if content_children != [text_node]:
            skipped.extend(match.group(0) for match in matches)
            continue
        for match in matches:
            bookmark = match.group("bookmark")
            if BOOKMARK_NAME.fullmatch(bookmark) is None:
                invalid.append(bookmark)
        if invalid:
            continue

        properties = clone_run_properties(run)
        replacement_runs: list[ET.Element] = []
        cursor = 0
        for match in matches:
            before = value[cursor:match.start()]
            if before:
                replacement_runs.append(make_text_run(before, properties))
            if prefix:
                replacement_runs.append(make_text_run(prefix, properties))
            replacement_runs.extend(ref_field_runs(match.group("bookmark"), properties))
            cursor = match.end()
        after = value[cursor:]
        if after:
            replacement_runs.append(make_text_run(after, properties))
        index = list(parent).index(run)
        for offset, node in enumerate(replacement_runs):
            parent.insert(index + offset, node)
        parent.remove(run)
        replaced += len(matches)

    return replaced, invalid, skipped


def is_story_part(name: str) -> bool:
    return name == "word/document.xml" or bool(re.fullmatch(r"word/(?:header|footer)[^/]*\.xml", name))


def insert_ref_fields(input_path: Path, output_path: Path, pattern: str = DEFAULT_PATTERN, prefix: str = "") -> dict:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or output == source:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    marker_pattern = re.compile(pattern)
    if "bookmark" not in marker_pattern.groupindex:
        raise ValueError("marker pattern must define a named 'bookmark' group")
    output.parent.mkdir(parents=True, exist_ok=True)
    replaced_total = 0
    changed_parts: list[str] = []
    skipped: list[str] = []
    try:
        with zipfile.ZipFile(source) as archive:
            entries: list[tuple[zipfile.ZipInfo, bytes]] = []
            for info in archive.infolist():
                name = info.filename
                data = archive.read(name)
                if is_story_part(name):
                    root = parse_xml(data)
                    count, invalid, part_skipped = replace_markers(root, marker_pattern, prefix)
                    if invalid:
                        raise ValueError(f"invalid bookmark name(s): {', '.join(invalid)}")
                    if count:
                        data = serialize_xml(root, data)
                        changed_parts.append(name)
                        replaced_total += count
                    skipped.extend(part_skipped)
                entries.append((info, data))
        with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
            for info, data in entries:
                target.writestr(info, data)
    except Exception:
        if output.exists():
            output.unlink()
        raise
    return {
        "ok": True,
        "input": str(source),
        "output": str(output),
        "markersReplaced": replaced_total,
        "modifiedParts": changed_parts,
        "skippedMarkers": skipped,
        "limitations": [
            "the complete marker must be inside one w:t text node",
            "fields are inserted in the main document, headers, and footers",
            "cached field result starts at 0; pagination-aware REF result updates may require Word-compatible rendering",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_docx", type=Path)
    parser.add_argument("output_docx", type=Path)
    parser.add_argument("--pattern", default=DEFAULT_PATTERN, help="Regex with a named bookmark group")
    parser.add_argument("--prefix", default="", help="Optional text before each REF field")
    args = parser.parse_args()
    try:
        result = insert_ref_fields(args.input_docx, args.output_docx, args.pattern, args.prefix)
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError, KeyError, re.error) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
