#!/usr/bin/env python3
"""Replace DOCX text in the main document, headers, and footers.

Each ``--replace OLD=NEW`` is applied to the first eligible paragraph match
by default. ``--all`` replaces every non-overlapping match. Matches can span
multiple text runs in one paragraph; replacement text inherits the first
matching run's formatting. Paragraphs with fields, comments, revisions,
bookmarks, drawings, tabs, breaks, or other structural boundaries are skipped
when they contain a requested match, with the reason reported.
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
STORY_PART = re.compile(r"word/(?:document|header[^/]*|footer[^/]*)\.xml\Z")
STRUCTURAL_BOUNDARIES = {
    "fldChar", "fldSimple", "instrText", "delInstrText", "commentRangeStart",
    "commentRangeEnd", "commentReference", "ins", "del", "moveFrom", "moveTo",
    "moveFromRangeStart", "moveFromRangeEnd", "moveToRangeStart", "moveToRangeEnd",
    "customXmlDelRangeStart", "customXmlDelRangeEnd", "customXmlInsRangeStart",
    "customXmlInsRangeEnd", "bookmarkStart", "bookmarkEnd", "drawing", "pict",
    "object", "tab", "ptab", "br", "cr", "lastRenderedPageBreak", "footnoteReference",
    "endnoteReference", "hyperlink", "sdt", "sdtContent", "proofErr", "permStart",
    "permEnd", "altChunk", "sym",
}
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def parse_replacement(value: str) -> tuple[str, str]:
    if "=" not in value:
        raise ValueError("--replace must be formatted as OLD=NEW")
    old, new = value.split("=", 1)
    if not old:
        raise ValueError("OLD text must not be empty")
    return old, new


def paragraph_boundaries(paragraph: ET.Element) -> list[str]:
    found = []
    for node in paragraph.iter():
        if node.tag.startswith(W):
            local_name = node.tag[len(W):]
            if local_name in STRUCTURAL_BOUNDARIES:
                found.append(f"w:{local_name}")
    return list(dict.fromkeys(found))


def set_text_preserving_space(node: ET.Element, value: str) -> None:
    node.text = value
    if value[:1].isspace() or value[-1:].isspace():
        node.set(XML_SPACE, "preserve")
    else:
        node.attrib.pop(XML_SPACE, None)


def replace_span(text_nodes: list[ET.Element], start: int, end: int, replacement: str) -> None:
    offset = 0
    for node in text_nodes:
        original = node.text or ""
        node_start, node_end = offset, offset + len(original)
        offset = node_end
        if node_end <= start or node_start >= end:
            continue
        local_start = max(0, start - node_start)
        local_end = min(len(original), end - node_start)
        inserted = replacement if node_start <= start < node_end else ""
        updated = original[:local_start] + inserted + original[local_end:]
        set_text_preserving_space(node, updated)


def replace_in_root(root: ET.Element, part_name: str, replacements: list[tuple[str, str]], replace_all: bool, first_done: list[bool]) -> tuple[int, list[dict]]:
    paragraphs = list(root.iter(W + "p"))
    count = 0
    skipped: list[dict] = []
    for replacement_index, (old, new) in enumerate(replacements):
        if not replace_all and first_done[replacement_index]:
            continue
        found_first = False
        for paragraph_index, paragraph in enumerate(paragraphs):
            boundaries = paragraph_boundaries(paragraph)
            text_nodes = list(paragraph.iter(W + "t"))
            paragraph_text = "".join(node.text or "" for node in text_nodes)
            search_from = 0
            while True:
                start = paragraph_text.find(old, search_from)
                if start < 0:
                    break
                if boundaries:
                    skipped.append({
                        "part": part_name,
                        "paragraphIndex": paragraph_index,
                        "old": old,
                        "reason": "paragraph contains structural boundary: " + ", ".join(boundaries),
                    })
                    break
                end = start + len(old)
                replace_span(text_nodes, start, end, new)
                count += 1
                found_first = True
                first_done[replacement_index] = True
                if not replace_all:
                    break
                paragraph_text = "".join(node.text or "" for node in text_nodes)
                search_from = start + len(new)
            if found_first and not replace_all:
                break
    return count, skipped


def replace_docx_text(input_path: Path, output_path: Path, replacements: list[tuple[str, str]], replace_all: bool = False) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or output == source:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    if not replacements:
        raise ValueError("provide at least one --replace")
    output.parent.mkdir(parents=True, exist_ok=True)

    total = 0
    modified_parts: list[str] = []
    skipped: list[dict] = []
    first_done = [False] * len(replacements)
    try:
        with zipfile.ZipFile(source) as archive:
            entries: list[tuple[zipfile.ZipInfo, bytes]] = []
            for info in archive.infolist():
                name = info.filename
                data = archive.read(name)
                if STORY_PART.fullmatch(name):
                    root = parse_xml(data)
                    changed, part_skipped = replace_in_root(root, name, replacements, replace_all, first_done)
                    skipped.extend(part_skipped)
                    if changed:
                        data = serialize_xml(root, data)
                        total += changed
                        modified_parts.append(name)
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
        "replacementsApplied": total,
        "modifiedParts": modified_parts,
        "mode": "all" if replace_all else "first per requested value",
        "skippedMatches": skipped,
        "limitations": ["text matches cannot cross paragraph boundaries", "paragraphs with structural OOXML boundaries are skipped when they contain a requested match"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--replace", action="append", default=[], metavar="OLD=NEW", help="Replacement value (repeatable)")
    parser.add_argument("--all", action="store_true", help="Replace all non-overlapping eligible matches")
    args = parser.parse_args()
    try:
        replacements = [parse_replacement(item) for item in args.replace]
        result = replace_docx_text(args.input, args.out, replacements, args.all)
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError, KeyError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
