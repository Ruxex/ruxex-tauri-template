#!/usr/bin/env python3
"""Set or clear Word's non-password document editing restrictions."""

from __future__ import annotations

import argparse
import json
import os
import posixpath
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"
CT = "{http://schemas.openxmlformats.org/package/2006/content-types}"
SETTINGS_PART = "word/settings.xml"
CONTENT_TYPES_PART = "[Content_Types].xml"
DOCUMENT_RELS_PART = "word/_rels/document.xml.rels"
SETTINGS_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings"
SETTINGS_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"
MODE_MAP = {
    "off": "off",
    "readonly": "readOnly",
    "read_only": "readOnly",
    "comments": "comments",
    "trackedchanges": "trackedChanges",
    "tracked_changes": "trackedChanges",
    "forms": "forms",
}


def _canonical_mode(mode: str) -> str:
    key = "_".join(mode.strip().replace("-", "_").split()).lower()
    try:
        return MODE_MAP[key]
    except KeyError as error:
        raise ValueError("mode must be off, readOnly, comments, trackedChanges, or forms") from error


def _new_settings() -> tuple[ET.Element, bytes]:
    original = f'<w:settings xmlns:w="{W[1:-1]}"/>'.encode()
    return parse_xml(original), original


def _ensure_settings_override(root: ET.Element) -> bool:
    matches = [item for item in root.findall(CT + "Override") if item.get("PartName") == "/word/settings.xml"]
    if len(matches) > 1:
        raise ValueError("[Content_Types].xml contains duplicate settings overrides")
    if matches:
        if matches[0].get("ContentType") == SETTINGS_CONTENT_TYPE:
            return False
        matches[0].set("ContentType", SETTINGS_CONTENT_TYPE)
        return True
    item = ET.SubElement(root, CT + "Override")
    item.set("PartName", "/word/settings.xml")
    item.set("ContentType", SETTINGS_CONTENT_TYPE)
    return True


def _ensure_settings_relationship(raw: bytes | None) -> tuple[bytes, bool]:
    if raw is None:
        original = f'<Relationships xmlns="{REL[1:-1]}"/>'.encode()
        root = parse_xml(original)
    else:
        original = raw
        root = parse_xml(raw)
    matches = [item for item in root.findall(REL + "Relationship") if item.get("Type") == SETTINGS_REL_TYPE]
    if len(matches) > 1:
        raise ValueError("document relationships contain duplicate settings relationships")
    if matches:
        target = (matches[0].get("Target") or "").replace("\\", "/")
        resolved_target = posixpath.normpath(
            target.lstrip("/") if target.startswith("/") else posixpath.join("word", target)
        )
        if resolved_target != "word/settings.xml":
            raise ValueError("existing settings relationship does not target word/settings.xml")
        return (raw if raw is not None else serialize_xml(root, original)), False

    used = {item.get("Id") for item in root.findall(REL + "Relationship")}
    number = 1
    while f"rId{number}" in used:
        number += 1
    relationship = ET.SubElement(root, REL + "Relationship")
    relationship.set("Id", f"rId{number}")
    relationship.set("Type", SETTINGS_REL_TYPE)
    relationship.set("Target", "settings.xml")
    return serialize_xml(root, original), True


def _set_mode(settings: ET.Element, mode: str) -> bool:
    changed = False
    for element in list(settings.findall(".//" + W + "documentProtection")):
        parent = settings
        # documentProtection normally lives directly under settings; locate the
        # actual parent as well so malformed nested occurrences are removed.
        for candidate in settings.iter():
            if element in list(candidate):
                parent = candidate
                break
        parent.remove(element)
        changed = True
    if mode == "off":
        return changed
    protection = ET.Element(W + "documentProtection")
    protection.set(W + "edit", mode)
    protection.set(W + "enforcement", "1")
    protection.set(W + "formatting", "0")
    settings.insert(0, protection)
    return True


def set_protection(input_path: Path, output_path: Path, mode: str) -> dict:
    canonical_mode = _canonical_mode(mode)
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or output == source:
        raise ValueError("output must be a separate .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)

    staged_path: Path | None = None
    output_created = False
    try:
        with zipfile.ZipFile(source, "r") as original:
            names = set(original.namelist())
            if CONTENT_TYPES_PART not in names:
                raise ValueError("DOCX is missing [Content_Types].xml")
            settings_raw = original.read(SETTINGS_PART) if SETTINGS_PART in names else None
            settings, settings_original = _new_settings() if settings_raw is None else (parse_xml(settings_raw), settings_raw)
            changed_settings = _set_mode(settings, canonical_mode)
            settings_bytes = serialize_xml(settings, settings_original) if changed_settings or settings_raw is None else settings_raw

            content_types_raw = original.read(CONTENT_TYPES_PART)
            content_types = parse_xml(content_types_raw)
            changed_content_types = _ensure_settings_override(content_types)
            content_types_bytes = (
                serialize_xml(content_types, content_types_raw) if changed_content_types else content_types_raw
            )

            rels_raw = original.read(DOCUMENT_RELS_PART) if DOCUMENT_RELS_PART in names else None
            rels_bytes, rels_changed = _ensure_settings_relationship(rels_raw)

            replacements = {
                CONTENT_TYPES_PART: content_types_bytes,
                SETTINGS_PART: settings_bytes,
                DOCUMENT_RELS_PART: rels_bytes,
            }
            descriptor, temp_name = tempfile.mkstemp(prefix=f".{output.name}.", suffix=".tmp", dir=output.parent)
            os.close(descriptor)
            staged_path = Path(temp_name)
            with zipfile.ZipFile(staged_path, "w", compression=zipfile.ZIP_DEFLATED) as rewritten:
                for info in original.infolist():
                    rewritten.writestr(info, replacements.get(info.filename, original.read(info.filename)))
                for part in (SETTINGS_PART, DOCUMENT_RELS_PART):
                    if part not in names:
                        rewritten.writestr(part, replacements[part])

        with zipfile.ZipFile(staged_path, "r") as check:
            corrupt = check.testzip()
            if corrupt is not None:
                raise zipfile.BadZipFile(f"staged DOCX has a corrupt ZIP member: {corrupt}")
            parse_xml(check.read(SETTINGS_PART))
            parse_xml(check.read(CONTENT_TYPES_PART))
            parse_xml(check.read(DOCUMENT_RELS_PART))

        # A hard link publishes the completed package atomically and fails if
        # another process created the destination after the initial check.
        os.link(staged_path, output)
        output_created = True
        staged_path.unlink()
        staged_path = None
    except Exception:
        if output_created:
            output.unlink(missing_ok=True)
        raise
    finally:
        if staged_path is not None:
            staged_path.unlink(missing_ok=True)

    return {
        "ok": True,
        "input": str(source),
        "output": str(output),
        "mode": canonical_mode,
        "passwordProtected": False,
        "settingsPartCreated": SETTINGS_PART not in names,
        "settingsRelationshipAdded": rels_changed,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--mode", required=True, help="off | readOnly | comments | trackedChanges | forms")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(set_protection(args.input, args.output, args.mode), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, KeyError, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
