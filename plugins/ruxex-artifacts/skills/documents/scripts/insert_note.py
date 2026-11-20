#!/usr/bin/env python3
"""Insert a footnote or endnote in a DOCX copy.

The first marker occurrence in the main document body is replaced by the note
reference. If the marker is absent, a reference paragraph is appended at the
end of the body (before section properties). Existing notes are retained and
new IDs follow the highest existing note/reference ID of the same kind.
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
REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"
CT = "{http://schemas.openxmlformats.org/package/2006/content-types}"
REL_TYPES = {
    "footnote": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes",
    "endnote": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes",
}
CONTENT_TYPES = {
    "footnote": "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml",
    "endnote": "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml",
}
EMPTY_RELS = b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
EMPTY_NOTES = {
    "footnote": b'<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
    "endnote": b'<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
}
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def note_part_name(kind: str) -> str:
    return f"word/{'footnotes' if kind == 'footnote' else 'endnotes'}.xml"


def append_separator(notes: ET.Element, kind: str, note_id: str, separator_tag: str) -> None:
    note = ET.Element(W + kind, {W + "id": note_id, W + "type": "separator" if note_id == "-1" else "continuationSeparator"})
    paragraph = ET.SubElement(note, W + "p")
    run = ET.SubElement(paragraph, W + "r")
    ET.SubElement(run, W + separator_tag)
    if note_id == "-1":
        notes.insert(0, note)
    else:
        separator_index = next((index for index, item in enumerate(notes) if item.get(W + "type") == "separator"), -1)
        notes.insert(separator_index + 1, note)


def ensure_separators(notes: ET.Element, kind: str) -> bool:
    changed = False
    required = (("-1", "separator", "separator"), ("0", "continuationSeparator", "continuationSeparator"))
    for note_id, note_type, child_tag in required:
        exists = any(
            item.get(W + "id") == note_id and item.get(W + "type") == note_type
            for item in notes.findall(W + kind)
        )
        if not exists:
            append_separator(notes, kind, note_id, child_tag)
            changed = True
    return changed


def max_note_id(notes: ET.Element, document: ET.Element, kind: str) -> int:
    note_tag = W + kind
    reference_tag = W + ("footnoteReference" if kind == "footnote" else "endnoteReference")
    values = []
    for node in list(notes.findall(note_tag)) + list(document.iter(reference_tag)):
        raw = node.get(W + "id", "")
        if raw.isdigit():
            values.append(int(raw))
    return max(values, default=0)


def clone_text_piece(source: ET.Element, text: str) -> ET.Element:
    clone = ET.Element(W + "t", dict(source.attrib))
    clone.text = text
    if text[:1].isspace() or text[-1:].isspace():
        clone.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    return clone


def insert_reference_run(parent: ET.Element, index: int, kind: str, note_id: int) -> None:
    run = ET.Element(W + "r")
    reference = ET.SubElement(run, W + ("footnoteReference" if kind == "footnote" else "endnoteReference"))
    reference.set(W + "id", str(note_id))
    parent.insert(index, run)


def replace_first_marker(body: ET.Element, kind: str, marker: str, note_id: int) -> bool:
    parents = {child: node for node in body.iter() for child in node}
    for text_node in body.iter(W + "t"):
        text = text_node.text or ""
        position = text.find(marker)
        if position < 0:
            continue
        run = parents.get(text_node)
        parent = parents.get(run) if run is not None else None
        if run is None or run.tag != W + "r" or parent is None:
            raise ValueError("note marker was found outside a run that can hold a reference")
        before_text = text[:position]
        after_text = text[position + len(marker):]
        properties = run.find(W + "rPr")
        before_run = ET.Element(W + "r")
        after_run = ET.Element(W + "r")
        if properties is not None:
            before_run.append(ET.fromstring(ET.tostring(properties, encoding="utf-8")))
            after_run.append(ET.fromstring(ET.tostring(properties, encoding="utf-8")))
        text_index = list(run).index(text_node)
        for child in list(run):
            if child.tag == W + "rPr":
                continue
            if child is text_node:
                if before_text:
                    before_run.append(clone_text_piece(text_node, before_text))
                if after_text:
                    after_run.append(clone_text_piece(text_node, after_text))
                continue
            original_index = list(run).index(child)
            if original_index < text_index:
                before_run.append(ET.fromstring(ET.tostring(child, encoding="utf-8")))
            else:
                after_run.append(ET.fromstring(ET.tostring(child, encoding="utf-8")))

        replacements: list[ET.Element] = []
        if len(before_run) > (1 if properties is not None else 0):
            replacements.append(before_run)
        reference_index = len(replacements)
        reference_holder = ET.Element(W + "placeholder")
        replacements.append(reference_holder)
        if len(after_run) > (1 if properties is not None else 0):
            replacements.append(after_run)
        original_index = list(parent).index(run)
        parent.remove(run)
        for offset, child in enumerate(replacements):
            if child is reference_holder:
                insert_reference_run(parent, original_index + offset, kind, note_id)
            else:
                parent.insert(original_index + offset, child)
        return True
    return False


def append_body_reference(document: ET.Element, kind: str, note_id: int) -> None:
    body = document.find(W + "body")
    if body is None:
        raise ValueError("word/document.xml has no w:body")
    paragraph = ET.Element(W + "p")
    run = ET.SubElement(paragraph, W + "r")
    reference = ET.SubElement(run, W + ("footnoteReference" if kind == "footnote" else "endnoteReference"))
    reference.set(W + "id", str(note_id))
    section_properties = body.find(W + "sectPr")
    if section_properties is None:
        body.append(paragraph)
    else:
        body.insert(list(body).index(section_properties), paragraph)


def append_note(notes: ET.Element, kind: str, note_id: int, text: str) -> None:
    note = ET.SubElement(notes, W + kind, {W + "id": str(note_id)})
    paragraph = ET.SubElement(note, W + "p")
    reference_run = ET.SubElement(paragraph, W + "r")
    ET.SubElement(reference_run, W + ("footnoteRef" if kind == "footnote" else "endnoteRef"))
    text_run = ET.SubElement(paragraph, W + "r")
    text_node = ET.SubElement(text_run, W + "t")
    text_node.text = " " + text
    text_node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def ensure_relationship(relationships: ET.Element, kind: str) -> bool:
    relationship_type = REL_TYPES[kind]
    if any(item.get("Type") == relationship_type for item in relationships.findall(REL + "Relationship")):
        return False
    used = []
    for item in relationships.findall(REL + "Relationship"):
        match = re.fullmatch(r"rId(\d+)", item.get("Id", ""))
        if match:
            used.append(int(match.group(1)))
    ET.SubElement(relationships, REL + "Relationship", {
        "Id": f"rId{max(used, default=0) + 1}",
        "Type": relationship_type,
        "Target": note_part_name(kind).removeprefix("word/"),
    })
    return True


def ensure_content_type(content_types: ET.Element, kind: str) -> bool:
    part_name = "/" + note_part_name(kind)
    content_type = CONTENT_TYPES[kind]
    for override in content_types.findall(CT + "Override"):
        if override.get("PartName") == part_name:
            if override.get("ContentType") != content_type:
                override.set("ContentType", content_type)
                return True
            return False
    ET.SubElement(content_types, CT + "Override", {"PartName": part_name, "ContentType": content_type})
    return True


def insert_note(input_path: Path, output_path: Path, kind: str, marker: str, text: str) -> dict:
    if kind not in {"footnote", "endnote"}:
        raise ValueError("kind must be footnote or endnote")
    if not marker:
        raise ValueError("marker must not be empty")
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or output == source:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)

    changed_parts: list[str] = []
    try:
        with zipfile.ZipFile(source) as archive:
            names = set(archive.namelist())
            document_bytes = archive.read("word/document.xml")
            document = parse_xml(document_bytes)
            body = document.find(W + "body")
            if body is None:
                raise ValueError("word/document.xml has no w:body")
            part_name = note_part_name(kind)
            original_notes = archive.read(part_name) if part_name in names else EMPTY_NOTES[kind]
            notes = parse_xml(original_notes)
            if notes.tag != W + ("footnotes" if kind == "footnote" else "endnotes"):
                raise ValueError(f"{part_name} has an unexpected root element")
            notes_changed = ensure_separators(notes, kind)
            note_id = max_note_id(notes, document, kind) + 1
            append_note(notes, kind, note_id, text)
            found = replace_first_marker(body, kind, marker, note_id)
            if not found:
                append_body_reference(document, kind, note_id)
            changed_parts.append("word/document.xml")
            changed_parts.append(part_name)

            rels_name = "word/_rels/document.xml.rels"
            original_rels = archive.read(rels_name) if rels_name in names else EMPTY_RELS
            relationships = parse_xml(original_rels)
            rels_changed = ensure_relationship(relationships, kind)
            original_types = archive.read("[Content_Types].xml")
            content_types = parse_xml(original_types)
            types_changed = ensure_content_type(content_types, kind)

            overrides = {
                "word/document.xml": serialize_xml(document, document_bytes),
                part_name: serialize_xml(notes, original_notes),
            }
            if rels_changed or rels_name not in names:
                overrides[rels_name] = serialize_xml(relationships, original_rels)
                changed_parts.append(rels_name)
            if types_changed:
                overrides["[Content_Types].xml"] = serialize_xml(content_types, original_types)
                changed_parts.append("[Content_Types].xml")
            with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
                for info in archive.infolist():
                    target.writestr(info, overrides.get(info.filename, archive.read(info.filename)))
                for name, data in overrides.items():
                    if name not in names:
                        target.writestr(name, data)
    except Exception:
        if output.exists():
            output.unlink()
        raise

    return {
        "ok": True,
        "input": str(source),
        "output": str(output),
        "kind": kind,
        "noteId": note_id,
        "anchor": "marker" if found else "appended at end of body because marker was not found",
        "markerFound": found,
        "separatorsEnsured": notes_changed,
        "modifiedParts": changed_parts,
        "limitations": ["classic footnotes/endnotes only; marker search is limited to word/document.xml body"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--kind", choices=("footnote", "endnote"), required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--marker", default="[[NOTE]]")
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = insert_note(args.input, args.out, args.kind, args.marker, args.text)
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError, KeyError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
