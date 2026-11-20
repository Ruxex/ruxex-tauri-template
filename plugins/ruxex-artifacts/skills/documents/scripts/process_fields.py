#!/usr/bin/env python3
"""Inspect, update common REF/SEQ fields, or flatten cached DOCX field results."""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def bookmark_text(root: ET.Element) -> dict[str, str]:
    active: set[str] = set()
    values: dict[str, list[str]] = {}
    for node in root.iter():
        if node.tag == W + "bookmarkStart":
            identifier = node.get(W + "id", "")
            active.add(identifier)
            values.setdefault(identifier, [])
        elif node.tag == W + "bookmarkEnd":
            active.discard(node.get(W + "id", ""))
        elif node.tag == W + "t":
            for identifier in active:
                values.setdefault(identifier, []).append(node.text or "")
    names = {
        bookmark.get(W + "id", ""): bookmark.get(W + "name", "")
        for bookmark in root.findall(f".//{W}bookmarkStart")
    }
    return {names.get(identifier, ""): "".join(text) for identifier, text in values.items() if names.get(identifier)}


def field_instruction(field: ET.Element) -> str:
    return field.get(W + "instr", "").strip()


def set_cached_text(field: ET.Element, value: str) -> None:
    texts = field.findall(f".//{W}t")
    if not texts:
        run = ET.SubElement(field, W + "r")
        texts = [ET.SubElement(run, W + "t")]
    texts[0].text = value
    for node in texts[1:]:
        node.text = ""


def _set_result_nodes(texts: list[ET.Element], value: str) -> bool:
    if not texts:
        return False
    texts[0].text = value
    if value.startswith(" ") or value.endswith(" "):
        texts[0].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    for node in texts[1:]:
        node.text = ""
    return True


def update_fields(root: ET.Element) -> dict:
    sequence_numbers: dict[str, int] = {}
    counts = {"updatedRef": 0, "updatedSeq": 0, "unchangedPageFields": 0, "unchangedOtherFields": 0}

    def process_pass(pass_kind: str, bookmarks: dict[str, str]) -> None:
        complex_stack: list[dict] = []

        def update_instruction(instruction: str, result_nodes: list[ET.Element] | None = None,
                               simple_field: ET.Element | None = None) -> None:
            instruction = " ".join(instruction.split())
            match = re.match(r"^(REF|PAGEREF|SEQ)\s+([A-Za-z][A-Za-z0-9_]{0,39})\b", instruction, re.IGNORECASE)
            if not match:
                if pass_kind == "REF":
                    counts["unchangedOtherFields"] += 1
                return
            kind, target = match.group(1).upper(), match.group(2)
            if kind == "SEQ":
                if pass_kind != "SEQ":
                    return
                sequence_numbers[target] = sequence_numbers.get(target, 0) + 1
                value = str(sequence_numbers[target])
                if simple_field is not None:
                    set_cached_text(simple_field, value)
                    counts["updatedSeq"] += 1
                elif result_nodes is not None and _set_result_nodes(result_nodes, value):
                    counts["updatedSeq"] += 1
                else:
                    counts["unchangedOtherFields"] += 1
            elif kind == "REF":
                if pass_kind != "REF":
                    return
                if target in bookmarks:
                    if simple_field is not None:
                        set_cached_text(simple_field, bookmarks[target])
                    elif result_nodes is not None:
                        _set_result_nodes(result_nodes, bookmarks[target])
                    counts["updatedRef"] += 1
                else:
                    counts["unchangedOtherFields"] += 1
            elif pass_kind == "REF":
                counts["unchangedPageFields"] += 1

        # A flat document-order walk lets cached SEQ values follow mixed simple
        # and complex fields. Re-run it for REF only after SEQ results are
        # materialized so bookmarks around captions expose their current number.
        for node in root.iter():
            if node.tag == W + "fldSimple":
                update_instruction(field_instruction(node), simple_field=node)
                continue
            if node.tag == W + "fldChar":
                marker = node.get(W + "fldCharType", "")
                if marker == "begin":
                    complex_stack.append({"instruction": [], "result": [], "phase": "instruction"})
                elif marker == "separate" and complex_stack:
                    complex_stack[-1]["phase"] = "result"
                elif marker == "end" and complex_stack:
                    field = complex_stack.pop()
                    update_instruction("".join(field["instruction"]), result_nodes=field["result"])
                continue
            if node.tag == W + "instrText" and complex_stack:
                if complex_stack[-1]["phase"] == "instruction":
                    complex_stack[-1]["instruction"].append(node.text or "")
            elif node.tag == W + "t" and complex_stack:
                for field in complex_stack:
                    if field["phase"] == "result":
                        field["result"].append(node)

    process_pass("SEQ", {})
    process_pass("REF", bookmark_text(root))
    return counts


def flatten_fields(root: ET.Element) -> dict:
    counts = {"simpleFieldsFlattened": 0, "complexFieldMarkersRemoved": 0, "instructionsRemoved": 0}
    for field in list(root.iter(W + "fldSimple")):
        parent = next((node for node in root.iter() if field in list(node)), None)
        if parent is None:
            continue
        index = list(parent).index(field)
        children = list(field)
        parent.remove(field)
        for offset, child in enumerate(children):
            parent.insert(index + offset, child)
        counts["simpleFieldsFlattened"] += 1
    for tag, count_key in (("fldChar", "complexFieldMarkersRemoved"), ("instrText", "instructionsRemoved")):
        for element in list(root.iter(W + tag)):
            parent = next((node for node in root.iter() if element in list(node)), None)
            if parent is not None:
                parent.remove(element)
                counts[count_key] += 1
    return counts


def story_parts(names: set[str]) -> list[str]:
    parts = ["word/document.xml"] if "word/document.xml" in names else []
    parts.extend(sorted(name for name in names if re.fullmatch(r"word/header\d+\.xml", name)))
    parts.extend(sorted(name for name in names if re.fullmatch(r"word/footer\d+\.xml", name)))
    return parts


def inspect_fields(root: ET.Element, part_name: str) -> list[dict]:
    fields = [
        {
            "part": part_name,
            "kind": "simple",
            "instruction": field_instruction(field),
            "result": "".join(node.text or "" for node in field.findall(f".//{W}t")),
        }
        for field in root.findall(f".//{W}fldSimple")
    ]
    fields.extend(
        {"part": part_name, "kind": "complex", "instruction": node.text or "", "result": None}
        for node in root.findall(f".//{W}instrText")
    )
    return fields


def process(input_path: Path, output_path: Path | None, operation: str) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if operation not in {"inspect", "update", "flatten"}:
        raise ValueError("operation must be inspect, update, or flatten")
    if operation != "inspect":
        if output_path is None:
            raise ValueError("an output path is required for update or flatten")
        output = output_path.expanduser().resolve()
        if output.suffix.lower() != ".docx" or output == source:
            raise ValueError("output must be a different .docx file")
        if output.exists():
            raise FileExistsError(f"output already exists: {output}")

    with zipfile.ZipFile(source) as archive:
        names = set(archive.namelist())
        parts = story_parts(names)
        if operation == "inspect":
            fields = []
            for part_name in parts:
                fields.extend(inspect_fields(parse_xml(archive.read(part_name)), part_name))
            return {"ok": True, "operation": operation, "input": str(source), "fields": fields}

        if output_path is None:
            raise ValueError("an output path is required for update or flatten")
        output = output_path.expanduser().resolve()
        aggregate = (
            {"updatedRef": 0, "updatedSeq": 0, "unchangedPageFields": 0, "unchangedOtherFields": 0}
            if operation == "update"
            else {"simpleFieldsFlattened": 0, "complexFieldMarkersRemoved": 0, "instructionsRemoved": 0}
        )
        per_part = []
        overrides: dict[str, bytes] = {}
        any_fields = False
        for part_name in parts:
            original = archive.read(part_name)
            root = parse_xml(original)
            counts = update_fields(root) if operation == "update" else flatten_fields(root)
            for key, value in counts.items():
                aggregate[key] += value
            per_part.append({"part": part_name, **counts})
            if any(counts.values()):
                any_fields = True
            if operation == "update":
                mutated = counts["updatedRef"] > 0 or counts["updatedSeq"] > 0
            else:
                mutated = counts["simpleFieldsFlattened"] > 0 or counts["complexFieldMarkersRemoved"] > 0 or counts["instructionsRemoved"] > 0
            if mutated:
                overrides[part_name] = serialize_xml(root, original)
        if not any_fields:
            raise ValueError("no supported fields were found")
        output.parent.mkdir(parents=True, exist_ok=True)
        try:
            with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
                for info in archive.infolist():
                    target.writestr(info, overrides.get(info.filename, archive.read(info.filename)))
        except Exception:
            if output.exists():
                output.unlink()
            raise
    limitations = []
    if operation == "update" and aggregate.get("unchangedPageFields", 0):
        limitations.append("PAGEREF page values require a pagination-aware Word-compatible renderer")
    return {
        "ok": True,
        "operation": operation,
        "input": str(source),
        "output": str(output),
        "counts": aggregate,
        "partCounts": per_part,
        "modifiedParts": list(overrides),
        "limitations": limitations,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--operation", required=True, choices=("inspect", "update", "flatten"))
    args = parser.parse_args()
    if args.operation != "inspect" and args.output is None:
        parser.error("--output is required for update and flatten")
    try:
        result = process(args.input, args.output, args.operation)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
