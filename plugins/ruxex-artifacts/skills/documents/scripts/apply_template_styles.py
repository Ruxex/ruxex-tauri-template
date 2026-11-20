#!/usr/bin/env python3
"""Apply style definitions and theme assets from a DOCX/DOTX template."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
STYLE_PART = "word/styles.xml"
THEME_PARTS = ("word/theme/theme1.xml", "word/fontTable.xml")
OPTIONAL_PART_METADATA = {
    "word/theme/theme1.xml": (
        "application/vnd.openxmlformats-officedocument.theme+xml",
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
        "theme/theme1.xml",
    ),
    "word/fontTable.xml": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml",
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable",
        "fontTable.xml",
    ),
}
NUMBERING_PART = "word/numbering.xml"
CONTENT_TYPES_PART = "[Content_Types].xml"
DOCUMENT_RELS_PART = "word/_rels/document.xml.rels"
REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"
CT_NS = "{http://schemas.openxmlformats.org/package/2006/content-types}"
NUMBERING_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering"
NUMBERING_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def _numbering_merge(template_bytes: bytes, target_bytes: bytes) -> tuple[bytes, dict[str, str]]:
    """Merge common numbering definitions, remapping document-local IDs."""
    template_root = parse_xml(template_bytes)
    target_root = parse_xml(target_bytes)
    if template_root.findall(W + "numPicBullet"):
        raise ValueError("template numbering uses picture bullets, which require related media parts")
    if target_root.findall(W + "numPicBullet"):
        raise ValueError("target numbering uses picture bullets; refusing an unsafe numbering merge")

    def next_id(tag: str) -> int:
        values = []
        for node in target_root.findall(W + tag):
            raw = node.get(W + ("numId" if tag == "num" else "abstractNumId"))
            if raw and raw.isdigit():
                values.append(int(raw))
        return max(values, default=-1) + 1

    abstract_next = next_id("abstractNum")
    abstract_map: dict[str, str] = {}
    for abstract in template_root.findall(W + "abstractNum"):
        old = abstract.get(W + "abstractNumId")
        if old is None:
            continue
        abstract_map[old] = str(abstract_next)
        abstract.set(W + "abstractNumId", str(abstract_next))
        abstract_next += 1

    num_next = next_id("num")
    num_map: dict[str, str] = {}
    for number in template_root.findall(W + "num"):
        old = number.get(W + "numId")
        if old is None:
            continue
        num_map[old] = str(num_next)
        number.set(W + "numId", str(num_next))
        abstract_ref = number.find(W + "abstractNumId")
        if abstract_ref is not None:
            ref = abstract_ref.get(W + "val")
            if ref in abstract_map:
                abstract_ref.set(W + "val", abstract_map[ref])
        num_next += 1

    for node in template_root.findall(W + "numPicBullet"):
        # Kept as a defensive guard if parsing behavior changes.
        if node.get(W + "numPicBulletId"):
            raise ValueError("template numbering uses picture bullets, which require related media parts")

    for child in list(template_root):
        if child.tag in {W + "abstractNum", W + "num"}:
            target_root.append(child)
    return serialize_xml(target_root, target_bytes), num_map


def _remap_style_numbering(style: ET.Element, num_map: dict[str, str]) -> None:
    for number_id in style.iter(W + "numId"):
        old = number_id.get(W + "val")
        if old in num_map:
            number_id.set(W + "val", num_map[old])


def apply_styles(template_path: Path, input_path: Path, output_path: Path) -> dict:
    template = template_path.expanduser().resolve(strict=True)
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not template.is_file() or template.suffix.lower() not in {".docx", ".dotx"}:
        raise ValueError("template must be a regular .docx or .dotx file")
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or output in {template, source}:
        raise ValueError("output must be a separate .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")

    try:
        with zipfile.ZipFile(template) as template_zip, zipfile.ZipFile(source) as source_zip:
            if STYLE_PART not in template_zip.namelist() or STYLE_PART not in source_zip.namelist():
                raise ValueError("both files must contain word/styles.xml")
            template_root = parse_xml(template_zip.read(STYLE_PART))
            target_root = parse_xml(source_zip.read(STYLE_PART))
            target_styles = {
                style.get(W + "styleId"): style
                for style in target_root.findall(W + "style")
                if style.get(W + "styleId")
            }
            copied = []
            copied_style_elements = []
            target_defaults = target_root.find(W + "docDefaults")
            template_defaults = template_root.find(W + "docDefaults")
            if template_defaults is not None:
                if target_defaults is not None:
                    target_root.remove(target_defaults)
                target_root.insert(0, template_defaults)
            for style in template_root.findall(W + "style"):
                style_id = style.get(W + "styleId")
                if not style_id:
                    continue
                existing = target_styles.get(style_id)
                if existing is not None:
                    target_root.remove(existing)
                target_root.append(style)
                copied.append(style_id)
                copied_style_elements.append(style)
            replacements = {STYLE_PART: serialize_xml(target_root, source_zip.read(STYLE_PART))}
            source_entries = source_zip.namelist()
            source_names = set(source_entries)
            copied_theme_parts = []
            for part in THEME_PARTS:
                if part in template_zip.namelist():
                    replacements[part] = template_zip.read(part)
                    copied_theme_parts.append(part)
            added_theme_parts = [part for part in copied_theme_parts if part not in source_names]
            if added_theme_parts:
                if DOCUMENT_RELS_PART not in source_names:
                    raise ValueError("target has no document relationships part; cannot safely add template assets")
                rels_raw = replacements.get(DOCUMENT_RELS_PART, source_zip.read(DOCUMENT_RELS_PART))
                document_rels = parse_xml(rels_raw)
                used_ids = {relation.get("Id") for relation in document_rels.findall(REL_NS + "Relationship")}
                next_relationship_id = 1
                relationships_changed = False
                for part in added_theme_parts:
                    _content_type, rel_type, target = OPTIONAL_PART_METADATA[part]
                    matches = [relation for relation in document_rels.findall(REL_NS + "Relationship")
                               if relation.get("Type") == rel_type]
                    if len(matches) > 1:
                        raise ValueError(f"target has duplicate relationships for {part}")
                    if matches:
                        relation_target = (matches[0].get("Target") or "").replace("\\", "/")
                        if matches[0].get("TargetMode") == "External" or relation_target != target:
                            raise ValueError(f"target has a conflicting relationship for {part}")
                        continue
                    while f"rId{next_relationship_id}" in used_ids:
                        next_relationship_id += 1
                    relationship = ET.SubElement(document_rels, REL_NS + "Relationship")
                    relationship.set("Id", f"rId{next_relationship_id}")
                    relationship.set("Type", rel_type)
                    relationship.set("Target", target)
                    used_ids.add(f"rId{next_relationship_id}")
                    next_relationship_id += 1
                    relationships_changed = True
                if relationships_changed:
                    replacements[DOCUMENT_RELS_PART] = serialize_xml(document_rels, rels_raw)

                types_raw = replacements.get(CONTENT_TYPES_PART, source_zip.read(CONTENT_TYPES_PART))
                content_types = parse_xml(types_raw)
                types_changed = False
                for part in added_theme_parts:
                    content_type, _rel_type, _target = OPTIONAL_PART_METADATA[part]
                    part_name = "/" + part
                    matches = [item for item in content_types.findall(CT_NS + "Override")
                               if item.get("PartName") == part_name]
                    if len(matches) > 1:
                        raise ValueError(f"target has duplicate content type overrides for {part}")
                    if matches:
                        if matches[0].get("ContentType") != content_type:
                            raise ValueError(f"target has a conflicting content type override for {part}")
                    else:
                        item = ET.SubElement(content_types, CT_NS + "Override")
                        item.set("PartName", part_name)
                        item.set("ContentType", content_type)
                        types_changed = True
                if types_changed:
                    replacements[CONTENT_TYPES_PART] = serialize_xml(content_types, types_raw)

            # Numbering IDs are document-local. Merge definitions with fresh
            # IDs and rewrite references in imported styles. Picture bullets
            # are refused because they may require relationship/media merging.
            numbering_copied = False
            numbering_id_map: dict[str, str] = {}
            if NUMBERING_PART in template_zip.namelist():
                template_numbering = template_zip.read(NUMBERING_PART)
                if NUMBERING_PART in source_names:
                    merged_numbering, numbering_id_map = _numbering_merge(
                        template_numbering,
                        source_zip.read(NUMBERING_PART),
                    )
                else:
                    merged_numbering = template_numbering
                    numbering_id_map = {
                        node.get(W + "numId"): node.get(W + "numId")
                        for node in parse_xml(template_numbering).findall(W + "num")
                        if node.get(W + "numId") is not None
                    }
                for style in copied_style_elements:
                    _remap_style_numbering(style, numbering_id_map)
                # Style serialization happened above; rewrite it after any
                # imported numbering references have been remapped.
                replacements[STYLE_PART] = serialize_xml(target_root, source_zip.read(STYLE_PART))

                content_types_raw = replacements.get(CONTENT_TYPES_PART, source_zip.read(CONTENT_TYPES_PART))
                content_types = parse_xml(content_types_raw)
                override = next(
                    (item for item in content_types.findall(CT_NS + "Override")
                     if item.get("PartName") == "/word/numbering.xml"),
                    None,
                )
                if override is None:
                    override = ET.SubElement(content_types, CT_NS + "Override")
                    override.set("PartName", "/word/numbering.xml")
                override.set("ContentType", NUMBERING_CONTENT_TYPE)
                replacements[CONTENT_TYPES_PART] = serialize_xml(
                    content_types, content_types_raw
                )
                if DOCUMENT_RELS_PART not in source_names:
                    raise ValueError("target has no document relationships part; cannot safely add numbering")
                document_rels_raw = replacements.get(DOCUMENT_RELS_PART, source_zip.read(DOCUMENT_RELS_PART))
                document_rels = parse_xml(document_rels_raw)
                has_numbering_rel = any(
                    relation.get("Type") == NUMBERING_REL
                    for relation in document_rels.findall(REL_NS + "Relationship")
                )
                if not has_numbering_rel:
                    used_ids = {
                        relation.get("Id")
                        for relation in document_rels.findall(REL_NS + "Relationship")
                    }
                    number = 1
                    while f"rId{number}" in used_ids:
                        number += 1
                    relation = ET.SubElement(document_rels, REL_NS + "Relationship")
                    relation.set("Id", f"rId{number}")
                    relation.set("Type", NUMBERING_REL)
                    relation.set("Target", "numbering.xml")
                    replacements[DOCUMENT_RELS_PART] = serialize_xml(document_rels, document_rels_raw)

                replacements[NUMBERING_PART] = merged_numbering
                numbering_copied = True

            entries = [(name, replacements.get(name, source_zip.read(name))) for name in source_entries]
            new_parts = [part for part in copied_theme_parts if part not in source_names]
            if numbering_copied and NUMBERING_PART not in source_names:
                new_parts.append(NUMBERING_PART)
            entries.extend((part, replacements[part]) for part in new_parts)
        output.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target_zip:
            with zipfile.ZipFile(source) as original:
                original_names = set(original.namelist())
                for name, data in entries:
                    if name in original_names:
                        target_zip.writestr(original.getinfo(name), data)
                    else:
                        target_zip.writestr(name, data)
    except Exception:
        if output.exists():
            output.unlink()
        raise
    return {
        "ok": True,
        "template": str(template),
        "input": str(source),
        "output": str(output),
        "stylesCopied": copied,
        "themePartsCopied": copied_theme_parts,
        "numberingPartCopied": numbering_copied,
        "limitations": [
            "merges common numbering definitions with remapped IDs; templates using picture bullets are refused because related media is not imported",
            "does not rewrite content-specific paragraph or character style references",
            "replaces matching style IDs and docDefaults; review the rendered output",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--template", required=True, type=Path)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(apply_styles(args.template, args.input, args.output), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
