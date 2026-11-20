#!/usr/bin/env python3
"""Add classic Word comments to body paragraphs in a DOCX copy.

Use ``--paragraph-index`` with ``--text`` for index-based targeting, or repeat
``--add contains=comment text`` to target paragraphs by substring. Pattern
matching anchors the whole paragraph, as does index mode.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"
CT = "{http://schemas.openxmlformats.org/package/2006/content-types}"
COMMENTS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments"
COMMENTS_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


def write_comments(input_path: Path, output_path: Path, targets: list[tuple[int, str]], author: str, initials: str) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if output.suffix.lower() != ".docx" or output == source:
        raise ValueError("output must be a different .docx file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    if not targets or not author.strip():
        raise ValueError("at least one comment target and a non-empty author are required")
    if any(index < 0 or not text.strip() for index, text in targets):
        raise ValueError("paragraph indexes must be non-negative and comment text must be non-empty")
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(source) as archive:
            entries = {name: archive.read(name) for name in archive.namelist()}
        document = parse_xml(entries["word/document.xml"])
        paragraphs = document.findall(f".//{W}body//{W}p")
        for paragraph_index, _ in targets:
            if paragraph_index >= len(paragraphs):
                raise ValueError(f"paragraph index {paragraph_index} is outside the document body")

        if "word/comments.xml" in entries:
            comments_root = parse_xml(entries["word/comments.xml"])
        else:
            comments_root = ET.Element(W + "comments")
        comment_ids = [int(item.get(W + "id", "-1")) for item in comments_root.findall(W + "comment") if item.get(W + "id", "").isdigit()]
        next_id = max(comment_ids, default=-1) + 1
        new_ids: list[int] = []
        for paragraph_index, text in targets:
            paragraph = paragraphs[paragraph_index]
            comment_id = next_id
            next_id += 1
            new_ids.append(comment_id)
            comment = ET.SubElement(comments_root, W + "comment", {
                W + "id": str(comment_id),
                W + "author": author,
                W + "initials": initials,
                W + "date": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            })
            comment_p = ET.SubElement(comment, W + "p")
            comment_p_pr = ET.SubElement(comment_p, W + "pPr")
            ET.SubElement(comment_p_pr, W + "pStyle", {W + "val": "CommentText"})
            comment_r = ET.SubElement(comment_p, W + "r")
            ET.SubElement(comment_r, W + "t").text = text

            properties = paragraph.find(W + "pPr")
            start_at = 1 if properties is not None and len(paragraph) > 0 and paragraph[0] is properties else 0
            paragraph.insert(start_at, ET.Element(W + "commentRangeStart", {W + "id": str(comment_id)}))
            paragraph.append(ET.Element(W + "commentRangeEnd", {W + "id": str(comment_id)}))
            reference_run = ET.Element(W + "r")
            reference_properties = ET.SubElement(reference_run, W + "rPr")
            ET.SubElement(reference_properties, W + "rStyle", {W + "val": "CommentReference"})
            ET.SubElement(reference_run, W + "commentReference", {W + "id": str(comment_id)})
            paragraph.append(reference_run)
        entries["word/document.xml"] = serialize_xml(document, entries["word/document.xml"])
        entries["word/comments.xml"] = serialize_xml(comments_root, entries.get("word/comments.xml", b"<w:comments xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"/>"))

        rels_name = "word/_rels/document.xml.rels"
        if rels_name in entries:
            relationships = parse_xml(entries[rels_name])
        else:
            relationships = ET.Element(REL + "Relationships")
        if not any(rel.get("Type") == COMMENTS_REL for rel in relationships.findall(REL + "Relationship")):
            used_ids = [int(match.group(1)) for rel in relationships.findall(REL + "Relationship")
                        if (match := re.fullmatch(r"rId(\d+)", rel.get("Id", "")))]
            relationship_id = f"rId{max(used_ids, default=0) + 1}"
            ET.SubElement(relationships, REL + "Relationship", {
                "Id": relationship_id,
                "Type": COMMENTS_REL,
                "Target": "comments.xml",
            })
        entries[rels_name] = serialize_xml(relationships, entries.get(rels_name, b"<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"/>"))

        types = parse_xml(entries["[Content_Types].xml"])
        if not any(item.get("PartName") == "/word/comments.xml" for item in types.findall(CT + "Override")):
            ET.SubElement(types, CT + "Override", {
                "PartName": "/word/comments.xml",
                "ContentType": COMMENTS_TYPE,
            })
        entries["[Content_Types].xml"] = serialize_xml(types, entries["[Content_Types].xml"])

        with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as target:
            with zipfile.ZipFile(source) as original:
                original_names = set(original.namelist())
                for name, data in entries.items():
                    if name in original_names:
                        target.writestr(original.getinfo(name), data)
                    else:
                        target.writestr(name, data)
    except Exception:
        if output.exists():
            output.unlink()
        raise
    return {"ok": True, "output": str(output), "commentIds": new_ids, "paragraphIndexes": [index for index, _ in targets], "addedComments": len(new_ids), "limitations": ["anchors to an entire body paragraph; classic comments only"]}


def add_comment(input_path: Path, output_path: Path, paragraph_index: int, text: str, author: str, initials: str) -> dict:
    """Backward-compatible paragraph-index helper."""
    return write_comments(input_path, output_path, [(paragraph_index, text)], author, initials)


def add_comments_by_pattern(input_path: Path, output_path: Path, additions: list[tuple[str, str]], author: str, initials: str, ignore_case: bool = False, require_all: bool = False) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    with zipfile.ZipFile(source) as archive:
        document = parse_xml(archive.read("word/document.xml"))
    paragraphs = document.findall(f".//{W}body//{W}p")
    targets: list[tuple[int, str]] = []
    missing: list[str] = []
    for needle, comment_text in additions:
        if not needle:
            raise ValueError("comment match patterns must not be empty")
        comparable_needle = needle.casefold() if ignore_case else needle
        hit = None
        for index, paragraph in enumerate(paragraphs):
            visible = "".join(node.text or "" for node in paragraph.iter() if node.tag in {W + "t", W + "delText"})
            comparable_text = visible.casefold() if ignore_case else visible
            if comparable_needle in comparable_text:
                hit = index
                break
        if hit is None:
            missing.append(needle)
        else:
            targets.append((hit, comment_text))
    if require_all and missing:
        raise ValueError(f"{len(missing)} patterns were not matched: {missing}")
    if not targets:
        raise ValueError(f"no paragraphs matched the requested patterns: {missing}")
    result = write_comments(source, output_path, targets, author, initials)
    result["unmatchedPatterns"] = missing
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--paragraph-index", type=int)
    target.add_argument("--add", action="append", help="Add a comment using contains=comment text (repeatable)")
    parser.add_argument("--text", help="Comment body for --paragraph-index")
    parser.add_argument("--author", default="Ruxex")
    parser.add_argument("--initials")
    parser.add_argument("--ignore-case", action="store_true", help="Case-insensitive --add matching")
    parser.add_argument("--require-all", action="store_true", help="Fail if any --add pattern is not matched")
    args = parser.parse_args()
    try:
        initials = args.initials or args.author[:2].upper()
        if args.paragraph_index is not None:
            if args.text is None:
                parser.error("--text is required with --paragraph-index")
            result = add_comment(args.input, args.output, args.paragraph_index, args.text, args.author, initials)
        else:
            additions = []
            for item in args.add or []:
                if "=" not in item:
                    parser.error("--add must be formatted as contains=comment text")
                additions.append(tuple(item.split("=", 1)))
            if not additions:
                parser.error("provide at least one --add")
            result = add_comments_by_pattern(args.input, args.output, additions, args.author, initials, args.ignore_case, args.require_all)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError, KeyError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
