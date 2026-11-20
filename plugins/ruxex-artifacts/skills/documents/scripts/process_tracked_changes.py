#!/usr/bin/env python3
"""Accept or reject simple insertion, deletion, and move revision wrappers."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
KEEP = {
    "accept": {"ins", "moveTo"},
    "reject": {"del", "moveFrom"},
}
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def resolve_part(root: ET.Element, operation: str) -> int:
    changed = 0
    for kind in ("ins", "del", "moveFrom", "moveTo"):
        wrappers = list(root.iter(W + kind))
        for wrapper in reversed(wrappers):
            parent = next((node for node in root.iter() if wrapper in list(node)), None)
            if parent is None:
                continue
            changed += 1
            if kind in KEEP[operation]:
                index = list(parent).index(wrapper)
                children = list(wrapper)
                parent.remove(wrapper)
                for offset, child in enumerate(children):
                    parent.insert(index + offset, child)
                if operation == "reject" and kind in {"del", "moveFrom"}:
                    for deleted_text in parent.iter(W + "delText"):
                        deleted_text.tag = W + "t"
                        if (deleted_text.text or "").startswith(" ") or (deleted_text.text or "").endswith(" "):
                            deleted_text.set(XML_SPACE, "preserve")
            else:
                parent.remove(wrapper)
    for marker in ("moveFromRangeStart", "moveFromRangeEnd", "moveToRangeStart", "moveToRangeEnd"):
        for element in list(root.iter(W + marker)):
            parent = next((node for node in root.iter() if element in list(node)), None)
            if parent is not None:
                parent.remove(element)
                changed += 1
    return changed


def disable_tracking(root: ET.Element) -> bool:
    changed = False
    for element in list(root.iter(W + "trackRevisions")):
        parent = next((node for node in root.iter() if element in list(node)), None)
        if parent is not None:
            parent.remove(element)
            changed = True
    return changed


def process(input_path: Path, output_path: Path, operation: str, keep_tracking_on: bool = False) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or source == output:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    if not isinstance(keep_tracking_on, bool):
        raise ValueError("keep_tracking_on must be a boolean")
    output.parent.mkdir(parents=True, exist_ok=True)
    modified_parts = []
    count = 0
    tracking_disabled = False
    try:
        with zipfile.ZipFile(source) as archive:
            entries = []
            for name in archive.namelist():
                data = archive.read(name)
                if name.startswith("word/") and name.endswith(".xml") and not name.startswith("word/theme/"):
                    root = parse_xml(data)
                    changes = resolve_part(root, operation)
                    settings_changed = name == "word/settings.xml" and not keep_tracking_on and disable_tracking(root)
                    if changes or settings_changed:
                        data = serialize_xml(root, data)
                        if name not in modified_parts:
                            modified_parts.append(name)
                        count += changes
                        tracking_disabled = tracking_disabled or settings_changed
                entries.append((name, data))
        if count == 0:
            raise ValueError("no supported tracked-change markup was found")
        with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
            with zipfile.ZipFile(source) as original:
                for name, data in entries:
                    target.writestr(original.getinfo(name), data)
    except Exception:
        if output.exists():
            output.unlink()
        raise
    return {
        "ok": True,
        "operation": operation,
        "input": str(source),
        "output": str(output),
        "processedMarkers": count,
        "modifiedParts": modified_parts,
        "trackingDisabled": tracking_disabled,
        "keepTrackingOn": keep_tracking_on,
        "limitations": ["handles ins, del, moveFrom, and moveTo wrappers; not every Word revision construct"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--operation", required=True, choices=("accept", "reject"))
    parser.add_argument("--keep-tracking-on", action="store_true", help="preserve w:trackRevisions in word/settings.xml")
    args = parser.parse_args()
    try:
        print(json.dumps(process(args.input, args.output, args.operation, args.keep_tracking_on), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
