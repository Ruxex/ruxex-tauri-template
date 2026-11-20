#!/usr/bin/env python3
"""Apply simple, mechanical accessibility fixes to a DOCX copy.

Supported fixes match the local Codex Documents helper's safe options:
- Fill blank DrawingML alt descriptions from the related image filename.
- Mark each table's first row as a repeating/header row.

This is not an accessibility checker. Review the resulting document: a filename
is only a placeholder description, and the first row may not be a semantic header.
"""
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
WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def _story_parts(names: set[str]) -> list[str]:
    return [name for name in sorted(names) if name == "word/document.xml" or
            (name.startswith("word/") and name.endswith(".xml") and
             (name.rsplit("/", 1)[-1].startswith("header") or
              name.rsplit("/", 1)[-1].startswith("footer")))]


def _relationship_targets(archive: zipfile.ZipFile, part: str) -> dict[str, str]:
    base = part.rsplit("/", 1)[-1]
    rels_name = f"word/_rels/{base}.rels"
    if rels_name not in archive.namelist():
        return {}
    root = ET.fromstring(archive.read(rels_name))
    return {
        relation.get("Id"): relation.get("Target")
        for relation in root.findall(f"{REL}Relationship")
        if relation.get("Id") and relation.get("Target")
        and relation.get("TargetMode") != "External"
    }


def _fix_images(root: ET.Element, rels: dict[str, str], part: str) -> int:
    changed = 0
    for drawing in root.iter(W + "drawing"):
        docprs = list(drawing.iter(WP + "docPr"))
        if not docprs:
            continue
        docpr = docprs[0]
        if (docpr.get("descr") or "").strip() or (docpr.get("title") or "").strip():
            continue
        blips = list(drawing.iter(A + "blip"))
        rid = blips[0].get(R + "embed") if blips else None
        target = rels.get(rid, "") if rid else ""
        # OOXML relationship targets are relative to the source part directory.
        target_path = posixpath.normpath(posixpath.join(posixpath.dirname(part), target)) if target else ""
        filename = posixpath.basename(target_path) if target_path and not target_path.startswith("../") else ""
        docpr.set("descr", f"Image: {filename}" if filename else "Image")
        changed += 1
    return changed


def _fix_table_headers(root: ET.Element) -> int:
    changed = 0
    for table in root.iter(W + "tbl"):
        first_row = table.find(W + "tr")
        if first_row is None:
            continue
        trpr = first_row.find(W + "trPr")
        if trpr is None:
            trpr = ET.Element(W + "trPr")
            first_row.insert(0, trpr)
        existing = trpr.find(W + "tblHeader")
        if existing is None:
            ET.SubElement(trpr, W + "tblHeader")
            changed += 1
        elif existing.get(W + "val", "1").lower() in {"0", "false", "off", "no"}:
            existing.attrib.pop(W + "val", None)
            changed += 1
    return changed


def fix_docx(source: Path, destination: Path, *, image_alt: bool, table_headers: bool) -> dict[str, int]:
    source = source.expanduser().resolve(strict=True)
    destination = destination.expanduser().resolve()
    if source == destination:
        raise ValueError("output must differ from input")
    if source.suffix.lower() != ".docx" or destination.suffix.lower() != ".docx":
        raise ValueError("input and output must use .docx extension")
    if destination.exists():
        raise FileExistsError(f"output already exists: {destination}")
    if not zipfile.is_zipfile(source):
        raise ValueError("input is not a valid DOCX/ZIP file")

    stats = {"image_alt_filled": 0, "table_headers_set": 0}
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(prefix=".a11y-fixes-", suffix=".docx", dir=destination.parent, delete=False) as tmp:
            temp_name = tmp.name
        with zipfile.ZipFile(source, "r") as zin, zipfile.ZipFile(temp_name, "w", zipfile.ZIP_DEFLATED) as zout:
            names = set(zin.namelist())
            overrides: dict[str, bytes] = {}
            for part in _story_parts(names):
                original = zin.read(part)
                root = parse_xml(original)
                if image_alt:
                    stats["image_alt_filled"] += _fix_images(root, _relationship_targets(zin, part), part)
                if table_headers:
                    stats["table_headers_set"] += _fix_table_headers(root)
                if (image_alt and stats["image_alt_filled"]) or (table_headers and stats["table_headers_set"]):
                    # Serialize only if this part changed; the counts are global, so
                    # compare this part's original transformed content before storing.
                    transformed = serialize_xml(root, original)
                    if transformed != original:
                        overrides[part] = transformed
            for info in zin.infolist():
                zout.writestr(info, overrides.get(info.filename, zin.read(info.filename)))
        os.replace(temp_name, destination)
        temp_name = None
        return stats
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("in_docx", type=Path)
    parser.add_argument("--fix_image_alt", choices=["from_filename"])
    parser.add_argument("--fix_table_headers", choices=["first_row"])
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if not (args.fix_image_alt or args.fix_table_headers):
        parser.error("select --fix_image_alt and/or --fix_table_headers")
    if args.out is None:
        parser.error("--out is required when applying fixes")
    try:
        stats = fix_docx(args.in_docx, args.out, image_alt=args.fix_image_alt == "from_filename",
                         table_headers=args.fix_table_headers == "first_row")
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    print(json.dumps({"output": str(args.out), **stats}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
