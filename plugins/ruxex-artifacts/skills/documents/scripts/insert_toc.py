#!/usr/bin/env python3
"""Replace a [[TOC]] paragraph with a Word TOC field in a DOCX copy.

The field includes a cached placeholder for headless previews. Word or a
Word-compatible editor must update fields to generate the actual TOC and page
numbers. The helper patches only the document placeholder and settings part.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml

W_URI = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
REL_URI = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_URI = "http://schemas.openxmlformats.org/package/2006/content-types"
OFFICE_REL_URI = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
W = "{" + W_URI + "}"
REL = "{" + REL_URI + "}"
CT = "{" + CT_URI + "}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
SETTINGS_REL_TYPE = OFFICE_REL_URI + "settings"
SETTINGS_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"


def _paragraph_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.iter(W + "t")).strip()


def _field_runs(levels: str) -> list[ET.Element]:
    begin = ET.Element(W + "r")
    marker = ET.SubElement(begin, W + "fldChar")
    marker.set(W + "fldCharType", "begin")

    instruction_run = ET.Element(W + "r")
    instruction = ET.SubElement(instruction_run, W + "instrText")
    instruction.set(XML_SPACE, "preserve")
    instruction.text = f' TOC \\o "{levels}" \\h \\z \\u '

    separate = ET.Element(W + "r")
    marker = ET.SubElement(separate, W + "fldChar")
    marker.set(W + "fldCharType", "separate")

    cached_run = ET.Element(W + "r")
    cached = ET.SubElement(cached_run, W + "t")
    cached.text = "(TOC will populate after updating fields)"

    end = ET.Element(W + "r")
    marker = ET.SubElement(end, W + "fldChar")
    marker.set(W + "fldCharType", "end")
    return [begin, instruction_run, separate, cached_run, end]


def _replace_placeholder(document: ET.Element, placeholder: str, levels: str) -> int:
    body = document.find(W + "body")
    if body is None:
        raise ValueError("word/document.xml is missing w:body")
    matches = [paragraph for paragraph in body.findall(W + "p")
               if _paragraph_text(paragraph) == placeholder]
    if len(matches) != 1:
        raise ValueError(f"expected exactly one paragraph containing {placeholder!r}; found {len(matches)}")
    paragraph = matches[0]
    properties = paragraph.find(W + "pPr")
    for child in list(paragraph):
        if child is not properties:
            paragraph.remove(child)
    for run in _field_runs(levels):
        paragraph.append(run)
    return 1


def _ensure_settings(settings_bytes: bytes | None) -> tuple[bytes, bool]:
    ET.register_namespace("w", W_URI)
    if settings_bytes is None:
        root = ET.Element(W + "settings")
        original = b""
        changed = True
    else:
        root = parse_xml(settings_bytes)
        if root.tag != W + "settings":
            raise ValueError("word/settings.xml has an unexpected root element")
        original = settings_bytes
        changed = False
    update_field_nodes = root.findall(W + "updateFields")
    if len(update_field_nodes) > 1:
        raise ValueError("word/settings.xml contains duplicate w:updateFields elements")
    update_fields = update_field_nodes[0] if update_field_nodes else None
    if update_fields is None:
        update_fields = ET.Element(W + "updateFields")
        # Match the broadly accepted Word convention used by the Codex helper.
        root.insert(0, update_fields)
        changed = True
    if update_fields.get(W + "val", "") not in {"true", "1", "on"}:
        update_fields.set(W + "val", "true")
        changed = True
    if not changed:
        return settings_bytes or b"", False
    if original:
        return serialize_xml(root, original), True
    return ET.tostring(root, encoding="utf-8", xml_declaration=True), True


def _ensure_settings_relationship(rels_bytes: bytes | None) -> tuple[bytes, bool]:
    ET.register_namespace("", REL_URI)
    if rels_bytes is None:
        root = ET.Element(REL + "Relationships")
        original = b""
        changed = True
    else:
        root = parse_xml(rels_bytes)
        if root.tag != REL + "Relationships":
            raise ValueError("word/_rels/document.xml.rels has an unexpected root element")
        original = rels_bytes
        changed = False
    settings_rels = [rel for rel in root.findall(REL + "Relationship")
                     if rel.get("Type") == SETTINGS_REL_TYPE]
    if len(settings_rels) > 1:
        raise ValueError("document relationships contain multiple settings relationships")
    if settings_rels:
        rel = settings_rels[0]
        if rel.get("TargetMode") == "External" or rel.get("Target") != "settings.xml":
            raise ValueError("existing settings relationship does not target word/settings.xml")
    else:
        used_ids = {rel.get("Id", "") for rel in root.findall(REL + "Relationship")}
        index = 1
        while f"rId{index}" in used_ids:
            index += 1
        ET.SubElement(root, REL + "Relationship", {
            "Id": f"rId{index}", "Type": SETTINGS_REL_TYPE, "Target": "settings.xml"
        })
        changed = True
    if not changed:
        return rels_bytes or b"", False
    if original:
        return serialize_xml(root, original), True
    return ET.tostring(root, encoding="utf-8", xml_declaration=True), True


def _ensure_settings_content_type(content_types_bytes: bytes) -> tuple[bytes, bool]:
    root = parse_xml(content_types_bytes)
    if root.tag != CT + "Types":
        raise ValueError("[Content_Types].xml has an unexpected root element")
    matches = [item for item in root.findall(CT + "Override")
               if item.get("PartName") == "/word/settings.xml"]
    if len(matches) > 1:
        raise ValueError("[Content_Types].xml contains duplicate settings overrides")
    if matches:
        if matches[0].get("ContentType") != SETTINGS_CONTENT_TYPE:
            raise ValueError("settings content type override has an unexpected value")
        return content_types_bytes, False
    ET.SubElement(root, CT + "Override", {
        "PartName": "/word/settings.xml", "ContentType": SETTINGS_CONTENT_TYPE
    })
    return serialize_xml(root, content_types_bytes), True


def _validate_levels(levels: str) -> str:
    match = re.fullmatch(r"\s*([1-9])\s*-\s*([1-9])\s*", levels)
    if not match:
        raise ValueError("levels must use the form N-M, for example 1-3")
    first, last = (int(value) for value in match.groups())
    if first > last:
        raise ValueError("levels range start must not exceed its end")
    return f"{first}-{last}"


def insert_toc(source: Path, destination: Path, *, levels: str = "1-3",
               placeholder: str = "[[TOC]]") -> dict:
    source = source.expanduser().resolve(strict=True)
    destination = destination.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if destination.suffix.lower() != ".docx" or destination == source:
        raise ValueError("output must be a different .docx file")
    if destination.exists():
        raise FileExistsError(f"output already exists: {destination}")
    if not placeholder:
        raise ValueError("placeholder must not be empty")
    levels = _validate_levels(levels)
    if not zipfile.is_zipfile(source):
        raise ValueError("input is not a valid DOCX/ZIP file")

    with zipfile.ZipFile(source) as archive:
        names = set(archive.namelist())
        required = {"word/document.xml", "[Content_Types].xml"}
        missing = required - names
        if missing:
            raise ValueError(f"DOCX is missing required package part(s): {', '.join(sorted(missing))}")
        original_document = archive.read("word/document.xml")
        document = parse_xml(original_document)
        _replace_placeholder(document, placeholder, levels)
        updated_document = serialize_xml(document, original_document)

        settings_name = "word/settings.xml"
        settings_bytes, settings_changed = _ensure_settings(
            archive.read(settings_name) if settings_name in names else None
        )
        rels_name = "word/_rels/document.xml.rels"
        rels_bytes, rels_changed = _ensure_settings_relationship(
            archive.read(rels_name) if rels_name in names else None
        )
        content_types, _ = _ensure_settings_content_type(archive.read("[Content_Types].xml"))

        replacements = {"word/document.xml": updated_document,
                        "word/settings.xml": settings_bytes,
                        "word/_rels/document.xml.rels": rels_bytes,
                        "[Content_Types].xml": content_types}
        added = {name for name, changed in ((settings_name, settings_changed),
                                             (rels_name, rels_changed))
                 if changed and name not in names}
        destination.parent.mkdir(parents=True, exist_ok=True)
        temp_name = None
        try:
            with tempfile.NamedTemporaryFile(prefix=".insert-toc-", suffix=".docx",
                                             dir=destination.parent, delete=False) as tmp:
                temp_name = tmp.name
            with zipfile.ZipFile(temp_name, "w", compression=zipfile.ZIP_DEFLATED) as output:
                for info in archive.infolist():
                    output.writestr(info, replacements.get(info.filename, archive.read(info.filename)))
                for name in sorted(added):
                    output.writestr(name, replacements[name])
            os.link(temp_name, destination)
            os.unlink(temp_name)
            temp_name = None
        finally:
            if temp_name and os.path.exists(temp_name):
                os.unlink(temp_name)

    return {"ok": True, "input": str(source), "output": str(destination),
            "placeholder": placeholder, "levels": levels,
            "settingsUpdated": True,
            "limitations": [
                "Word or a Word-compatible editor must update fields to populate the TOC and calculate page numbers",
                "the cached text is a preview placeholder, not generated TOC content",
            ]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_docx", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--placeholder", default="[[TOC]]")
    parser.add_argument("--levels", default="1-3", help='Heading range such as "1-3"')
    args = parser.parse_args()
    try:
        result = insert_toc(args.input_docx, args.out, levels=args.levels,
                            placeholder=args.placeholder)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
