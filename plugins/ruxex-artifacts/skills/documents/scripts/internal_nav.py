#!/usr/bin/env python3
"""Add deterministic internal navigation and a static TOC to a DOCX copy.

Adds Top/Bottom bookmarks, bookmarks to selected heading paragraphs, a static
TOC at the start of the document, and optional Back to TOC hyperlinks after
each heading. This patches only word/document.xml; it does not generate a Word
TOC field or update page numbers.
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

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"


def _paragraph_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.iter(W + "t")).strip()


def _paragraph_style(paragraph: ET.Element) -> str | None:
    style = paragraph.find(f"{W}pPr/{W}pStyle")
    return style.get(W + "val") if style is not None else None


def _heading_level(paragraph: ET.Element) -> int | None:
    outline = paragraph.find(f"{W}pPr/{W}outlineLvl")
    if outline is not None:
        raw = outline.get(W + "val", "")
        if raw.isdigit():
            return int(raw) + 1
    style = _paragraph_style(paragraph) or ""
    match = re.fullmatch(r"Heading\s*(\d+)", style) or re.fullmatch(r"Heading(\d+)", style)
    return int(match.group(1)) if match else None


def _bookmark_names(root: ET.Element) -> set[str]:
    return {node.get(W + "name", "") for node in root.iter(W + "bookmarkStart") if node.get(W + "name")}


def _max_bookmark_id(root: ET.Element) -> int:
    ids = []
    for tag in ("bookmarkStart", "bookmarkEnd"):
        for node in root.iter(W + tag):
            value = node.get(W + "id", "")
            if value.isdigit():
                ids.append(int(value))
    return max(ids, default=0)


def _unique_name(base: str, names: set[str]) -> str:
    folded = {name.casefold() for name in names}
    if base.casefold() not in folded:
        return base
    suffix = 2
    while f"{base}_{suffix}".casefold() in folded:
        suffix += 1
    return f"{base}_{suffix}"


def _bookmark_pair(paragraph: ET.Element, name: str, bookmark_id: int) -> None:
    start = ET.Element(W + "bookmarkStart", {W + "id": str(bookmark_id), W + "name": name})
    end = ET.Element(W + "bookmarkEnd", {W + "id": str(bookmark_id)})
    properties = paragraph.find(W + "pPr")
    content_index = 1 if properties is not None and len(paragraph) and paragraph[0] is properties else 0
    paragraph.insert(content_index, start)
    paragraph.append(end)


def _text_paragraph(text: str, style: str | None = None) -> ET.Element:
    paragraph = ET.Element(W + "p")
    if style:
        properties = ET.SubElement(paragraph, W + "pPr")
        node = ET.SubElement(properties, W + "pStyle")
        node.set(W + "val", style)
    run = ET.SubElement(paragraph, W + "r")
    node = ET.SubElement(run, W + "t")
    node.text = text
    if text.startswith(" ") or text.endswith(" "):
        node.set(XML_SPACE, "preserve")
    return paragraph


def _hyperlink(anchor: str, text: str) -> ET.Element:
    link = ET.Element(W + "hyperlink", {W + "anchor": anchor})
    run = ET.SubElement(link, W + "r")
    props = ET.SubElement(run, W + "rPr")
    style = ET.SubElement(props, W + "rStyle")
    style.set(W + "val", "Hyperlink")
    node = ET.SubElement(run, W + "t")
    node.text = text
    if text.startswith(" ") or text.endswith(" "):
        node.set(XML_SPACE, "preserve")
    return link


def _append_back_link(paragraph: ET.Element, toc_name: str) -> None:
    run = ET.SubElement(paragraph, W + "r")
    node = ET.SubElement(run, W + "t")
    node.text = " "
    node.set(XML_SPACE, "preserve")
    paragraph.append(_hyperlink(toc_name, "Back to TOC"))


def add_navigation(source: Path, destination: Path, *, levels: list[int] | None = None,
                   toc_title: str = "Table of Contents", back_to_toc: bool = True,
                   top_bottom: bool = True) -> dict:
    source = source.expanduser().resolve(strict=True)
    destination = destination.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if destination.suffix.lower() != ".docx" or destination == source:
        raise ValueError("output must be a different .docx file")
    if destination.exists():
        raise FileExistsError(f"output already exists: {destination}")
    if not toc_title.strip():
        raise ValueError("TOC title must not be empty")
    selected_levels = set(levels if levels is not None else [1, 2, 3])
    if not selected_levels or any(level < 1 or level > 9 for level in selected_levels):
        raise ValueError("heading levels must be between 1 and 9")
    if not zipfile.is_zipfile(source):
        raise ValueError("input is not a valid DOCX/ZIP file")

    with zipfile.ZipFile(source) as archive:
        names = set(archive.namelist())
        if "word/document.xml" not in names:
            raise ValueError("DOCX is missing word/document.xml")
        original = archive.read("word/document.xml")
        root = parse_xml(original)
        body = root.find(W + "body")
        if body is None:
            raise ValueError("DOCX document has no body")
        paragraphs = [node for node in list(body) if node.tag == W + "p"]
        if not paragraphs:
            raise ValueError("document body has no top-level paragraph for navigation anchors")

        bookmark_names = _bookmark_names(root)
        folded_names = {name.casefold() for name in bookmark_names}
        if "toc" in folded_names or any(_paragraph_text(p).casefold() == toc_title.strip().casefold() for p in paragraphs):
            raise ValueError("an existing TOC bookmark or same-titled paragraph was found; refusing to add a duplicate static TOC")

        next_id = _max_bookmark_id(root) + 1
        used_names = set(bookmark_names)
        top_name = _unique_name("Top", used_names) if top_bottom else None
        if top_name:
            used_names.add(top_name)
        bottom_name = _unique_name("Bottom", used_names) if top_bottom else None
        if bottom_name:
            used_names.add(bottom_name)
        toc_name = "TOC"

        headings: list[tuple[int, str, str, ET.Element]] = []
        for paragraph in paragraphs:
            level = _heading_level(paragraph)
            title = _paragraph_text(paragraph)
            if level not in selected_levels or not title:
                continue
            name = _unique_name(f"sec{len(headings) + 1:03d}", used_names)
            used_names.add(name)
            _bookmark_pair(paragraph, name, next_id)
            next_id += 1
            headings.append((level, title, name, paragraph))

        if top_bottom:
            assert top_name is not None and bottom_name is not None
            if paragraphs[0] is paragraphs[-1]:
                # A single content paragraph gets two properly nested ranges.
                starts = []
                for name, bookmark_id in ((top_name, next_id), (bottom_name, next_id + 1)):
                    start = ET.Element(W + "bookmarkStart", {W + "id": str(bookmark_id), W + "name": name})
                    starts.append(start)
                properties = paragraphs[0].find(W + "pPr")
                content_index = 1 if properties is not None and paragraphs[0][0] is properties else 0
                for offset, start in enumerate(starts):
                    paragraphs[0].insert(content_index + offset, start)
                for name, bookmark_id in ((bottom_name, next_id + 1), (top_name, next_id)):
                    paragraphs[0].append(ET.Element(W + "bookmarkEnd", {W + "id": str(bookmark_id)}))
                next_id += 2
            else:
                _bookmark_pair(paragraphs[0], top_name, next_id)
                next_id += 1
                _bookmark_pair(paragraphs[-1], bottom_name, next_id)
                next_id += 1

        # Keep the TOC bookmark ID collision-free; _insert_static_toc substitutes
        # this sentinel immediately after creating the title paragraph.
        entries = [(level, title, name) for level, title, name, _ in headings]
        toc_section = [_text_paragraph(toc_title, style="Heading1")]
        _bookmark_pair(toc_section[0], toc_name, next_id)
        next_id += 1
        for level, title, anchor in entries:
            paragraph = ET.Element(W + "p")
            indent = "  " * max(0, level - 1)
            if indent:
                run = ET.SubElement(paragraph, W + "r")
                text_node = ET.SubElement(run, W + "t")
                text_node.text = indent
                text_node.set(XML_SPACE, "preserve")
            paragraph.append(_hyperlink(anchor, title))
            toc_section.append(paragraph)
        toc_section.append(_text_paragraph(""))
        for index, paragraph in enumerate(toc_section):
            body.insert(index, paragraph)

        if back_to_toc:
            for _level, _title, _name, paragraph in headings:
                _append_back_link(paragraph, toc_name)

        updated = serialize_xml(root, original)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temp_name = None
        try:
            with tempfile.NamedTemporaryFile(prefix=".internal-nav-", suffix=".docx",
                                             dir=destination.parent, delete=False) as tmp:
                temp_name = tmp.name
            with zipfile.ZipFile(temp_name, "w", compression=zipfile.ZIP_DEFLATED) as output:
                for info in archive.infolist():
                    data = updated if info.filename == "word/document.xml" else archive.read(info.filename)
                    output.writestr(info, data)
            os.link(temp_name, destination)
            os.unlink(temp_name)
            temp_name = None
        finally:
            if temp_name and os.path.exists(temp_name):
                os.unlink(temp_name)

    return {"ok": True, "input": str(source), "output": str(destination),
            "counts": {"headingsBookmarked": len(headings), "tocEntries": len(entries),
                       "topBottomBookmarks": 2 if top_bottom else 0,
                       "backToTocLinks": len(headings) if back_to_toc else 0},
            "bookmarks": {"top": top_name,
                          "bottom": bottom_name,
                          "toc": toc_name},
            "limitations": [
                "patches only word/document.xml and top-level body paragraphs",
                "static TOC links do not include page numbers and are not a Word TOC field",
            "quick-links bars for existing figure/table caption bookmarks are not generated",
                "existing same-titled TOC or TOC bookmark is rejected to avoid duplicate navigation sections",
            ]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_docx", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--toc-title", default="Table of Contents")
    parser.add_argument("--levels", nargs="+", type=int, default=[1, 2, 3])
    parser.add_argument("--no-back-to-toc", action="store_true")
    parser.add_argument("--no-top-bottom", action="store_true")
    args = parser.parse_args()
    try:
        result = add_navigation(args.input_docx, args.out, levels=args.levels,
                               toc_title=args.toc_title,
                               back_to_toc=not args.no_back_to_toc,
                               top_bottom=not args.no_top_bottom)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
