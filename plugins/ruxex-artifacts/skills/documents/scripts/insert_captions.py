#!/usr/bin/env python3
"""Insert basic Figure/Table captions in a DOCX body.

Adds a paragraph with the built-in Caption style after each uncaptained,
top-level body table or paragraph containing a DrawingML/VML image. Captions
use complex SEQ fields (initial display value 0), optionally bookmark the
number as figN/tblN, and can be materialized with process_fields.py --operation
update. This does not create REF fields or emulate Word's full caption engine.
"""
from __future__ import annotations

import argparse
import os
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"


def _text_run(text: str) -> ET.Element:
    run = ET.Element(W + "r")
    node = ET.SubElement(run, W + "t")
    node.text = text
    if text.startswith(" ") or text.endswith(" "):
        node.set(XML_SPACE, "preserve")
    return run


def _complex_seq_field(label: str) -> list[ET.Element]:
    begin = ET.Element(W + "r")
    marker = ET.SubElement(begin, W + "fldChar")
    marker.set(W + "fldCharType", "begin")

    instruction = ET.Element(W + "r")
    code = ET.SubElement(instruction, W + "instrText")
    code.set(XML_SPACE, "preserve")
    code.text = f" SEQ {label} \\* ARABIC "

    separate = ET.Element(W + "r")
    marker = ET.SubElement(separate, W + "fldChar")
    marker.set(W + "fldCharType", "separate")

    result = _text_run("0")
    end = ET.Element(W + "r")
    marker = ET.SubElement(end, W + "fldChar")
    marker.set(W + "fldCharType", "end")
    return [begin, instruction, separate, result, end]


def _caption(label: str, text: str) -> ET.Element:
    paragraph = ET.Element(W + "p")
    properties = ET.SubElement(paragraph, W + "pPr")
    style = ET.SubElement(properties, W + "pStyle")
    style.set(W + "val", "Caption")
    paragraph.append(_text_run(label + " "))
    for run in _complex_seq_field(label):
        paragraph.append(run)
    if text:
        paragraph.append(_text_run(": " + text))
    return paragraph


def _max_bookmark_id(root: ET.Element) -> int:
    values = []
    for tag in ("bookmarkStart", "bookmarkEnd"):
        for node in root.iter(W + tag):
            value = node.get(W + "id", "")
            if value.isdigit():
                values.append(int(value))
    return max(values, default=0)


def _bookmark_names(root: ET.Element) -> set[str]:
    return {node.get(W + "name", "") for node in root.iter(W + "bookmarkStart")}


def _wrap_number_with_bookmark(paragraph: ET.Element, name: str, bookmark_id: int) -> None:
    children = list(paragraph)
    separate_index = next((i for i, run in enumerate(children)
                           if run.tag == W + "r" and (mark := run.find(W + "fldChar")) is not None
                           and mark.get(W + "fldCharType") == "separate"), None)
    if separate_index is None or separate_index + 1 >= len(children):
        raise ValueError("could not locate SEQ result run to bookmark")
    result_run = children[separate_index + 1]
    if result_run.find(W + "t") is None:
        raise ValueError("SEQ field result has no text node")
    start = ET.Element(W + "bookmarkStart")
    start.set(W + "id", str(bookmark_id))
    start.set(W + "name", name)
    end = ET.Element(W + "bookmarkEnd")
    end.set(W + "id", str(bookmark_id))
    paragraph.insert(separate_index + 1, start)
    paragraph.insert(separate_index + 3, end)


def _caption_after(paragraph: ET.Element, label: str) -> bool:
    style = paragraph.find(f"{W}pPr/{W}pStyle")
    if style is None or style.get(W + "val") != "Caption":
        return False
    visible = "".join(node.text or "" for node in paragraph.iter(W + "t")).strip()
    return visible.startswith(label + " ")


def insert_captions(source: Path, destination: Path, *, tables: bool, figures: bool,
                    caption_text: str = "", bookmarks: bool = False) -> dict:
    source = source.expanduser().resolve(strict=True)
    destination = destination.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if destination.suffix.lower() != ".docx" or destination == source:
        raise ValueError("output must be a different .docx file")
    if destination.exists():
        raise FileExistsError(f"output already exists: {destination}")
    if not (tables or figures):
        raise ValueError("select at least one of tables or figures")
    if not zipfile.is_zipfile(source):
        raise ValueError("input is not a valid DOCX/ZIP file")

    counts = {"tables": 0, "figures": 0, "bookmarks": 0}
    with zipfile.ZipFile(source) as archive:
        if "word/document.xml" not in archive.namelist():
            raise ValueError("DOCX is missing word/document.xml")
        original_xml = archive.read("word/document.xml")
        root = parse_xml(original_xml)
        body = root.find(f"{W}body")
        if body is None:
            raise ValueError("DOCX document has no body")
        children = list(body)
        used_names = _bookmark_names(root)
        next_id = _max_bookmark_id(root) + 1
        next_name_number = {"Table": 1, "Figure": 1}
        # Preserve numbering namespace while avoiding bookmark-name collisions.
        for label, prefix in (("Table", "tbl"), ("Figure", "fig")):
            while f"{prefix}{next_name_number[label]}" in used_names:
                next_name_number[label] += 1

        additions: list[tuple[ET.Element, ET.Element]] = []
        for index, element in enumerate(children):
            label = None
            if tables and element.tag == W + "tbl":
                label = "Table"
            elif figures and element.tag == W + "p" and (
                element.find(f".//{W}drawing") is not None or element.find(f".//{W}pict") is not None
            ):
                label = "Figure"
            if label is None:
                continue
            following = children[index + 1] if index + 1 < len(children) else None
            if following is not None and following.tag == W + "p" and _caption_after(following, label):
                continue

            caption = _caption(label, caption_text)
            if bookmarks:
                prefix = "tbl" if label == "Table" else "fig"
                number = next_name_number[label]
                name = f"{prefix}{number}"
                next_name_number[label] += 1
                _wrap_number_with_bookmark(caption, name, next_id)
                used_names.add(name)
                next_id += 1
                counts["bookmarks"] += 1
            additions.append((element, caption))
            counts["tables" if label == "Table" else "figures"] += 1

        if not any(counts.values()):
            # Idempotent no-op is useful, but still produce a valid output copy.
            pass
        for element, caption in additions:
            body.insert(list(body).index(element) + 1, caption)
        updated_xml = serialize_xml(root, original_xml)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(prefix=".insert-captions-", suffix=".docx",
                                             dir=destination.parent, delete=False) as tmp:
                temp_path = tmp.name
            with zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_DEFLATED) as output:
                for info in archive.infolist():
                    data = updated_xml if info.filename == "word/document.xml" else archive.read(info.filename)
                    output.writestr(info, data)
            # Hard-link publication is atomic and fails if another process
            # created the requested destination after the initial check.
            os.link(temp_path, destination)
            os.unlink(temp_path)
            temp_path = None
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
    return {"ok": True, "input": str(source), "output": str(destination), "counts": counts,
            "limitations": [
                "only top-level body tables and paragraphs with DrawingML/VML images are targeted",
                "no REF fields are inserted; bookmarks can be referenced by a separate field workflow",
                "SEQ fields are initially cached as 0; run process_fields.py --operation update to materialize numbering",
            ]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_docx", type=Path)
    parser.add_argument("output_docx", type=Path)
    parser.add_argument("--tables", action="store_true")
    parser.add_argument("--figures", action="store_true")
    parser.add_argument("--caption-text", default="")
    parser.add_argument("--bookmarks", action="store_true")
    args = parser.parse_args()
    try:
        result = insert_captions(args.input_docx, args.output_docx, tables=args.tables,
                                 figures=args.figures, caption_text=args.caption_text,
                                 bookmarks=args.bookmarks)
        print(__import__("json").dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
