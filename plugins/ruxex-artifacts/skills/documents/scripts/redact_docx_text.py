#!/usr/bin/env python3
"""Redact text in DOCX paragraphs while retaining their w:t segmentation.

Regex rules run over concatenated paragraph text, so they can match across
multiple Word runs. By default each match is replaced with ``█`` repeated to
the same length. Optional replacement strings are repeated or truncated to
match that length. ``--no-preserve-length`` applies replacements at their
natural length and may affect layout.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
WORD_PART = re.compile(r"word/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml\Z")
sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml


@dataclass(frozen=True)
class RedactionRule:
    pattern: re.Pattern[str]
    label: str
    replacement: str | None = None


def _compile_rules(emails: bool, phones: bool, patterns: list[str], replacements: list[str], preserve_length: bool) -> list[RedactionRule]:
    specifications: list[tuple[re.Pattern[str], str]] = []
    if emails:
        specifications.append((re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I), "email"))
    if phones:
        specifications.append((re.compile(r"(?:(?:\+?\d{1,3}[\s-]?)?(?:\(\d{3}\)|\d{3})[\s-]?)\d{3}[\s-]?\d{4}"), "phone"))
    for index, value in enumerate(patterns, 1):
        if not value or len(value) > 500:
            raise ValueError("each --pattern must contain 1 to 500 characters")
        specifications.append((re.compile(value), f"custom_{index}"))
    if not specifications:
        raise ValueError("provide --emails, --phones, or at least one --pattern")
    if replacements and len(replacements) not in {1, len(specifications)}:
        raise ValueError("provide one --replacement for all rules or one for each rule")
    if preserve_length and any(value == "" for value in replacements):
        raise ValueError("length-preserving replacements must not be empty")
    if len(replacements) == 1:
        mapped = replacements * len(specifications)
    else:
        mapped = replacements
    return [
        RedactionRule(pattern, label, mapped[index] if mapped else None)
        for index, (pattern, label) in enumerate(specifications)
    ]


def _apply_rules_to_paragraph(paragraph: ET.Element, rules: list[RedactionRule], mask_char: str, preserve_length: bool) -> int:
    text_nodes = list(paragraph.iter(W + "t"))
    if not text_nodes:
        return 0
    original_segments = [node.text or "" for node in text_nodes]
    full_text = "".join(original_segments)
    if not full_text:
        return 0

    spans: list[tuple[int, int, RedactionRule]] = []
    for rule in rules:
        for match in rule.pattern.finditer(full_text):
            if match.start() != match.end():
                spans.append((match.start(), match.end(), rule))
    if not spans:
        return 0

    spans.sort(key=lambda span: (span[0], -(span[1] - span[0])))
    chosen: list[tuple[int, int, RedactionRule]] = []
    last_end = -1
    for start, end, rule in spans:
        if start < last_end:
            continue
        chosen.append((start, end, rule))
        last_end = end

    rewritten = list(full_text)
    for start, end, rule in reversed(chosen):
        length = end - start
        if rule.replacement is None:
            replacement = mask_char * length
        elif preserve_length:
            replacement = (rule.replacement * ((length // len(rule.replacement)) + 1))[:length]
        else:
            replacement = rule.replacement
        rewritten[start:end] = list(replacement)
    new_full_text = "".join(rewritten)
    if preserve_length and len(new_full_text) != len(full_text):
        raise RuntimeError("expected length-preserving redaction")

    offset = 0
    for index, (node, segment) in enumerate(zip(text_nodes, original_segments, strict=True)):
        take = len(segment) if index < len(text_nodes) - 1 else len(new_full_text) - offset
        value = new_full_text[offset:offset + take]
        node.text = value
        if value.startswith(" ") or value.endswith(" "):
            node.set(XML_SPACE, "preserve")
        offset += take
    return len(chosen)


def redact_docx(
    source_path: Path,
    destination_path: Path,
    rules: list[RedactionRule],
    mask_char: str = "█",
    preserve_length: bool = True,
    include_comments: bool = False,
) -> dict:
    source = source_path.expanduser().resolve(strict=True)
    destination = destination_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if destination.suffix.lower() != ".docx" or source == destination:
        raise ValueError("output must be a different .docx file")
    if destination.exists():
        raise FileExistsError(f"output already exists: {destination}")
    if len(mask_char) != 1:
        raise ValueError("mask character must be exactly one character")
    destination.parent.mkdir(parents=True, exist_ok=True)

    total_matches = 0
    paragraphs_touched = 0
    modified_parts: list[str] = []
    processed_parts: list[str] = []
    try:
        with zipfile.ZipFile(source) as archive:
            entries: list[tuple[zipfile.ZipInfo, bytes]] = []
            for info in archive.infolist():
                name = info.filename
                data = archive.read(name)
                selected = bool(WORD_PART.fullmatch(name)) or (include_comments and name == "word/comments.xml")
                if selected:
                    processed_parts.append(name)
                    root = parse_xml(data)
                    part_count = 0
                    part_paragraphs = 0
                    for paragraph in root.iter(W + "p"):
                        matches = _apply_rules_to_paragraph(paragraph, rules, mask_char, preserve_length)
                        if matches:
                            part_count += matches
                            part_paragraphs += 1
                    if part_count:
                        data = serialize_xml(root, data)
                        total_matches += part_count
                        paragraphs_touched += part_paragraphs
                        modified_parts.append(name)
                entries.append((info, data))
        if total_matches == 0:
            raise ValueError("no redaction patterns matched the selected DOCX text")
        with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_DEFLATED) as target:
            for info, data in entries:
                target.writestr(info, data)
    except Exception:
        if destination.exists():
            destination.unlink()
        raise
    return {
        "ok": True,
        "input": str(source),
        "output": str(destination),
        "matches": total_matches,
        "paragraphsTouched": paragraphs_touched,
        "partsProcessed": processed_parts,
        "modifiedParts": modified_parts,
        "preserveLength": preserve_length,
        "includeComments": include_comments,
        "limitations": ["images, charts, embedded files, and other non-text content are not inspected"],
    }


def redact(source: Path, destination: Path, pattern: str, replacement: str = "[REDACTED]") -> dict:
    """Backward-compatible wrapper for a single custom pattern."""
    rules = _compile_rules(False, False, [pattern], [replacement], preserve_length=True)
    return redact_docx(source, destination, rules)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--emails", action="store_true", help="Redact email addresses")
    parser.add_argument("--phones", action="store_true", help="Redact phone-like numbers")
    parser.add_argument("--pattern", action="append", default=[], help="Regex pattern to redact (repeatable)")
    parser.add_argument("--replacement", action="append", default=[], help="Replacement text, repeated/truncated per match length (repeatable)")
    parser.add_argument("--no-preserve-length", "--no_preserve_length", action="store_true", help="Use replacement text at its natural length")
    parser.add_argument("--include-comments", "--include_comments", action="store_true", help="Also process word/comments.xml")
    parser.add_argument("--mask-char", "--mask_char", default="█", help="Length-preserving mask character")
    args = parser.parse_args()
    try:
        preserve_length = not args.no_preserve_length
        rules = _compile_rules(args.emails, args.phones, args.pattern, args.replacement, preserve_length)
        result = redact_docx(args.input, args.output, rules, args.mask_char, preserve_length, args.include_comments)
    except (OSError, ValueError, re.error, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
