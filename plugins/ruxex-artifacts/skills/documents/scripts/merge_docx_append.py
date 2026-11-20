#!/usr/bin/env python3
"""Append OOXML body elements from one DOCX to another.

The base document's final ``w:sectPr`` is kept at the end. Relationships are
not imported, so relationship-backed content is always rejected. Drawings
without relationship references can be explicitly allowed as a limited case.
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
DOCUMENT_PART = "word/document.xml"
DRAWING_TAGS = {W + "drawing", "{urn:schemas-microsoft-com:vml}pict", W + "object"}


def _body(root: ET.Element, label: str) -> ET.Element:
    body = root.find(f".//{W}body")
    if body is None:
        raise ValueError(f"{label} DOCX is missing w:body")
    return body


def _has_drawings(body: ET.Element) -> bool:
    return any(element.tag in DRAWING_TAGS for element in body.iter())


def _has_relationship_dependencies(body: ET.Element) -> bool:
    return any(
        attribute.startswith(R)
        for element in body.iter()
        for attribute in element.attrib
    )


def _body_content(body: ET.Element) -> list[ET.Element]:
    children = list(body)
    section_positions = [index for index, child in enumerate(children) if child.tag == W + "sectPr"]
    if section_positions and section_positions != [len(children) - 1]:
        raise ValueError("w:sectPr must be the final direct child of w:body")
    return children[:-1] if section_positions else children


def merge(
    base_path: Path,
    append_path: Path,
    output_path: Path,
    allow_drawings: bool = False,
    after_marker: str | None = None,
) -> dict:
    base = base_path.expanduser().resolve(strict=True)
    append = append_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if any(not path.is_file() or path.suffix.lower() != ".docx" for path in (base, append)):
        raise ValueError("both inputs must be regular .docx files")
    if output.suffix.lower() != ".docx" or output in {base, append}:
        raise ValueError("output must be a separate .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    if after_marker == "":
        raise ValueError("--after-marker must not be empty")

    output.parent.mkdir(parents=True, exist_ok=True)
    output_created = False
    try:
        with zipfile.ZipFile(base, "r") as base_archive, zipfile.ZipFile(append, "r") as append_archive:
            base_xml = base_archive.read(DOCUMENT_PART)
            append_xml = append_archive.read(DOCUMENT_PART)
            base_root = parse_xml(base_xml)
            append_root = parse_xml(append_xml)
            base_body = _body(base_root, "base")
            append_body = _body(append_root, "append")

            drawing_present = _has_drawings(append_body)
            if drawing_present and not allow_drawings:
                raise ValueError("append DOCX contains drawings; pass --allow-drawings to allow only self-contained drawings")
            if _has_relationship_dependencies(append_body):
                raise ValueError("append DOCX body uses relationship-backed content; its relationships and dependencies are not imported")

            children_to_append = _body_content(append_body)
            base_children = list(base_body)
            base_has_section = bool(base_children and base_children[-1].tag == W + "sectPr")
            if after_marker is None:
                insertion_index = len(base_children) - 1 if base_has_section else len(base_children)
            else:
                insertion_index = -1
                for index, child in enumerate(base_children):
                    if child.tag != W + "p":
                        continue
                    paragraph_text = "".join(node.text or "" for node in child.iter(W + "t"))
                    if after_marker in paragraph_text:
                        insertion_index = index + 1
                        break
                if insertion_index < 0:
                    raise ValueError(f"marker was not found in a top-level base paragraph: {after_marker!r}")
            for offset, child in enumerate(children_to_append):
                base_body.insert(insertion_index + offset, copy.deepcopy(child))

            merged_xml = serialize_xml(base_root, base_xml)
            with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
                output_created = True
                for info in base_archive.infolist():
                    content = merged_xml if info.filename == DOCUMENT_PART else base_archive.read(info.filename)
                    target.writestr(info, content)
    except Exception:
        if output_created:
            output.unlink(missing_ok=True)
        raise

    return {
        "ok": True,
        "output": str(output),
        "bodyChildrenAppended": len(children_to_append),
        "drawingsAllowed": bool(allow_drawings and drawing_present),
        "afterMarker": after_marker,
        "limitations": [
            "copies body OOXML only; styles, numbering, bookmarks, and other cross-document references are not reconciled",
            "relationship-backed content is rejected because append relationships and package dependencies are not imported",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--append", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--allow-drawings", action="store_true", help="allow only drawings without relationship references")
    parser.add_argument("--after-marker", help="insert after the first top-level base paragraph containing this text")
    args = parser.parse_args()
    try:
        print(json.dumps(merge(args.base, args.append, args.output, args.allow_drawings, args.after_marker), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, KeyError, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
