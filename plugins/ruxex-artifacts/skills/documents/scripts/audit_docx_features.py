#!/usr/bin/env python3
"""Inspect common DOCX sections, images, fields, review parts, watermarks, and protection."""

from __future__ import annotations

import argparse
import json
import re
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
V = "{urn:schemas-microsoft-com:vml}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
NONDESCRIPTIVE_LINK_TEXT = {"click here", "here", "link", "this link"}
RAW_URL = re.compile(r"https?://\S+", re.IGNORECASE)


def _int_attr(element: ET.Element | None, attribute: str) -> int | None:
    if element is None:
        return None
    value = element.get(W + attribute)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _on_off(element: ET.Element | None, default: bool = False) -> bool:
    if element is None:
        return default
    value = element.get(W + "val", "1").strip().lower()
    return value not in {"0", "false", "off", "no"}


def _table_geometry(table: ET.Element) -> dict:
    grid = table.find(W + "tblGrid")
    grid_widths = [_int_attr(column, "w") for column in grid.findall(W + "gridCol")] if grid is not None else []
    grid_present = grid is not None
    cells = table.findall(f"{W}tr/{W}tc")
    start_margins: list[int | None] = []
    for cell in cells:
        margin = cell.find(f"{W}tcPr/{W}tcMar/{W}start")
        start_margins.append(_int_attr(margin, "w"))
    present_margins = [value for value in start_margins if value is not None]

    properties = table.find(W + "tblPr")
    indent = properties.find(W + "tblInd") if properties is not None else None
    indent_value = _int_attr(indent, "w")
    indent_type = indent.get(W + "type") if indent is not None else None
    table_width = properties.find(W + "tblW") if properties is not None else None
    table_width_value = _int_attr(table_width, "w")

    rows = []
    for row_index, row in enumerate(table.findall(W + "tr")):
        cell_widths = []
        for cell in row.findall(W + "tc"):
            tcw = cell.find(f"{W}tcPr/{W}tcW")
            cell_widths.append({"valueTwips": _int_attr(tcw, "w"),
                                "type": tcw.get(W + "type") if tcw is not None else None})
        comparable = grid_present and all(width is not None for width in grid_widths) and all(
            cell["valueTwips"] is not None and cell["type"] in {None, "dxa"} for cell in cell_widths
        )
        rows.append({
            "index": row_index,
            "cellWidths": cell_widths,
            "gridComparison": {
                "comparable": comparable,
                "matchesGridWidths": ([cell["valueTwips"] for cell in cell_widths] == grid_widths)
                if comparable else None,
                "gridWidthsTwips": grid_widths,
            },
        })
    return {
        "gridWidthsTwips": grid_widths,
        "rowCellWidths": rows,
        "startMarginsTwips": start_margins,
        "startMarginCellCount": len(cells),
        "missingStartMarginCount": len(start_margins) - len(present_margins),
        "startMarginsConsistent": (len(present_margins) == len(cells) and len(set(present_margins)) <= 1)
        if cells else None,
        "indentMatchesStartMargin": (indent_value == start_margins[0]
                                     if indent_value is not None and indent_type in {None, "dxa"}
                                     and start_margins and start_margins[0] is not None else None),
        "indentComparison": {"valueTwips": indent_value, "type": indent_type,
                             "comparedAgainstStartMarginTwips": start_margins[0]
                             if start_margins and start_margins[0] is not None else None},
        "tableWidthMatchesGridSum": (table_width_value == sum(grid_widths)
                                     if table_width_value is not None and grid_widths
                                     and all(value is not None for value in grid_widths) else None),
    }


def _note_details(document: ET.Element, archive: zipfile.ZipFile, names: set[str],
                  part: str, kind: str) -> dict:
    reference_tag = W + f"{kind}Reference"
    note_tag = W + kind
    references = [node.get(W + "id", "") for node in document.iter(reference_tag)]
    counts = Counter(references)
    part_present = part in names
    definitions: list[tuple[str, str]] = []
    if part_present:
        notes_root = ET.fromstring(archive.read(part))
        for note in notes_root.iter(note_tag):
            identifier = note.get(W + "id", "")
            if note.get(W + "type") in {"separator", "continuationSeparator"} or identifier in {"-1", "0"}:
                continue
            text = "".join(node.text or "" for node in note.iter(W + "t")).strip()
            definitions.append((identifier, text))
    definition_ids = [identifier for identifier, _ in definitions]
    definition_counts = Counter(definition_ids)
    defined = set(definition_ids)
    referenced = set(references)
    return {
        "part": part,
        "partPresent": part_present,
        "referenceCount": len(references),
        "referenceIds": references,
        "referenceCounts": dict(counts),
        "definedCount": len(definitions),
        "definedIds": definition_ids,
        "missingDefinitionIds": sorted(referenced - defined),
        "unusedDefinitionIds": sorted(defined - referenced),
        "duplicateReferenceIds": sorted(identifier for identifier, count in counts.items() if count > 1),
        "duplicateDefinitionIds": sorted(identifier for identifier, count in definition_counts.items() if count > 1),
        "firstNotes": [{"id": identifier, "text": text[:120]} for identifier, text in definitions[:5]],
    }


def _heading_level(paragraph: ET.Element) -> int | None:
    outline = paragraph.find(f"{W}pPr/{W}outlineLvl")
    if outline is not None:
        raw = outline.get(W + "val", "")
        if raw.isdigit():
            return int(raw) + 1
    style = paragraph.find(f"{W}pPr/{W}pStyle")
    value = style.get(W + "val", "") if style is not None else ""
    match = re.fullmatch(r"Heading\s*(\d+)", value) or re.fullmatch(r"Heading(\d+)", value)
    return int(match.group(1)) if match else None


def _visible_text(element: ET.Element) -> str:
    return "".join(node.text or "" for node in element.iter(W + "t")).strip()


def _accessibility_audit(story_roots: list[tuple[str, ET.Element]], skipped_parts: list[str]) -> tuple[list[dict], dict]:
    findings: list[dict] = []
    for part, root in story_roots:
        last_heading_level = None
        for paragraph_index, paragraph in enumerate(root.findall(f".//{W}p")):
            level = _heading_level(paragraph)
            if level is None:
                continue
            if last_heading_level is not None and level > last_heading_level + 1:
                findings.append({
                    "part": part, "index": paragraph_index, "kind": "heading_skip", "severity": "medium",
                    "message": f"Heading level jumped from {last_heading_level} to {level}",
                    "text": _visible_text(paragraph)[:120],
                })
            last_heading_level = level

        for image_index, image in enumerate(root.findall(f".//{WP}docPr")):
            description = (image.get("descr") or "").strip()
            title = (image.get("title") or "").strip()
            if not description and not title:
                findings.append({
                    "part": part, "index": image_index, "kind": "image_missing_alt", "severity": "high",
                    "message": "Image missing alternative text (descr/title are empty)",
                })

        for table_index, table in enumerate(root.findall(f".//{W}tbl")):
            rows = table.findall(W + "tr")
            if not rows:
                continue
            row_properties = rows[0].find(W + "trPr")
            header = row_properties.find(W + "tblHeader") if row_properties is not None else None
            if not _on_off(header):
                findings.append({
                    "part": part, "index": table_index, "kind": "table_no_header_row", "severity": "medium",
                    "message": "Table first row is not marked as a header row (w:tblHeader is missing or disabled)",
                })

        for link_index, hyperlink in enumerate(root.findall(f".//{W}hyperlink")):
            text = _visible_text(hyperlink)
            if not text:
                continue
            if text.casefold() in NONDESCRIPTIVE_LINK_TEXT:
                findings.append({
                    "part": part, "index": link_index, "kind": "hyperlink_nondescriptive", "severity": "medium",
                    "message": f"Hyperlink label is generic: {text!r}", "text": text[:120],
                })
            if RAW_URL.fullmatch(text):
                findings.append({
                    "part": part, "index": link_index, "kind": "hyperlink_raw_url", "severity": "low",
                    "message": "Hyperlink label is a raw URL", "text": text[:120],
                })

    summary = {
        "totalFindings": len(findings),
        "bySeverity": {severity: sum(1 for finding in findings if finding["severity"] == severity)
                        for severity in ("high", "medium", "low")},
        "byKind": dict(Counter(finding["kind"] for finding in findings)),
        "partsScanned": [part for part, _root in story_roots],
        "partsSkippedParseError": skipped_parts,
    }
    return findings, summary


def audit(input_path: Path) -> dict:
    source = input_path.expanduser().resolve(strict=True)
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    with zipfile.ZipFile(source) as archive:
        names = set(archive.namelist())
        document = ET.fromstring(archive.read("word/document.xml"))
        settings = ET.fromstring(archive.read("word/settings.xml")) if "word/settings.xml" in names else None
        comments_root = ET.fromstring(archive.read("word/comments.xml")) if "word/comments.xml" in names else None
        footnotes_root = ET.fromstring(archive.read("word/footnotes.xml")) if "word/footnotes.xml" in names else None
        endnotes_root = ET.fromstring(archive.read("word/endnotes.xml")) if "word/endnotes.xml" in names else None
        even_odd_element = settings.find(W + "evenAndOddHeaders") if settings is not None else None
        even_odd_enabled = _on_off(even_odd_element) if settings is not None else None

        sections = []
        for index, section in enumerate(document.findall(f".//{W}sectPr")):
            size = section.find(W + "pgSz")
            margins = section.find(W + "pgMar")
            start_type = section.find(W + "type")
            title_page = section.find(W + "titlePg")
            header_refs = section.findall(W + "headerReference")
            footer_refs = section.findall(W + "footerReference")
            header_types = [ref.get(W + "type", "default") for ref in header_refs]
            footer_types = [ref.get(W + "type", "default") for ref in footer_refs]
            sections.append({
                "index": index,
                "startType": start_type.get(W + "val", "nextPage") if start_type is not None else "nextPage",
                "startTypeExplicit": start_type is not None,
                "orientation": size.get(W + "orient", "portrait") if size is not None else None,
                "pageWidthTwips": size.get(W + "w") if size is not None else None,
                "pageHeightTwips": size.get(W + "h") if size is not None else None,
                "marginsTwips": {
                    side: margins.get(W + side)
                    for side in ("top", "right", "bottom", "left", "header", "footer", "gutter")
                    if margins is not None and margins.get(W + side) is not None
                },
                "headerReferences": [ref.get(W + "type") for ref in header_refs],
                "footerReferences": [ref.get(W + "type") for ref in footer_refs],
                "headerReferenceDetails": [{"type": ref.get(W + "type", "default"), "relationshipId": ref.get(R + "id")}
                                            for ref in header_refs],
                "footerReferenceDetails": [{"type": ref.get(W + "type", "default"), "relationshipId": ref.get(R + "id")}
                                            for ref in footer_refs],
                "titlePageEnabled": _on_off(title_page),
                "evenAndOddHeadersEnabled": even_odd_enabled,
                "defaultHeaderLinkedToPrevious": ("default" not in header_types) if index > 0 else None,
                "defaultFooterLinkedToPrevious": ("default" not in footer_types) if index > 0 else None,
                "linkageInference": "default header/footer reference absence implies link-to-previous for sections after the first",
            })

        tables = []
        for index, table in enumerate(document.findall(f".//{W}body/{W}tbl")):
            properties = table.find(W + "tblPr")
            table_width = properties.find(W + "tblW") if properties is not None else None
            table_indent = properties.find(W + "tblInd") if properties is not None else None
            table_layout = properties.find(W + "tblLayout") if properties is not None else None
            grid = table.find(W + "tblGrid")
            rows = table.findall(W + "tr")
            first_row_properties = rows[0].find(W + "trPr") if rows else None
            header = first_row_properties.find(W + "tblHeader") if first_row_properties is not None else None
            header_enabled = header is not None and header.get(W + "val", "1").lower() not in {"0", "false", "off", "no"}
            tables.append({
                "index": index,
                "rowCount": len(rows),
                "columnWidthsTwips": [column.get(W + "w") for column in grid.findall(W + "gridCol")] if grid is not None else [],
                "width": {"value": table_width.get(W + "w"), "type": table_width.get(W + "type")} if table_width is not None else None,
                "indent": {"value": table_indent.get(W + "w"), "type": table_indent.get(W + "type")} if table_indent is not None else None,
                "layout": table_layout.get(W + "type") if table_layout is not None else None,
                "firstRowMarkedHeader": header_enabled,
                "geometryDiagnostics": _table_geometry(table),
            })

        images = []
        for part in sorted(name for name in names if name.startswith("word/") and name.endswith(".xml")):
            if part.startswith("word/theme/"):
                continue
            try:
                root = ET.fromstring(archive.read(part))
            except ET.ParseError:
                continue
            for image in root.findall(f".//{WP}docPr"):
                images.append({
                    "part": part,
                    "id": image.get("id", ""),
                    "name": image.get("name", ""),
                    "alternativeText": image.get("descr", ""),
                    "missingAlternativeText": not image.get("descr", "").strip(),
                })
        simple_fields = []
        complex_fields = []
        for part in sorted(name for name in names if name.startswith("word/") and name.endswith(".xml")):
            if part.startswith("word/theme/"):
                continue
            try:
                root = ET.fromstring(archive.read(part))
            except ET.ParseError:
                continue
            simple_fields.extend({
                "part": part,
                "instruction": field.get(W + "instr", ""),
                "result": "".join(node.text or "" for node in field.findall(f".//{W}t")),
            } for field in root.findall(f".//{W}fldSimple"))
            complex_fields.extend(node.text or "" for node in root.findall(f".//{W}instrText"))
        watermarks = []
        for part in sorted(name for name in names if name.startswith("word/") and name.endswith(".xml")):
            if part.startswith("word/theme/"):
                continue
            try:
                root = ET.fromstring(archive.read(part))
            except ET.ParseError:
                continue
            for textpath in root.findall(f".//{V}textpath"):
                text = textpath.get("string", "")
                if text:
                    watermarks.append({"part": part, "text": text})

        footnote_details = _note_details(document, archive, names, "word/footnotes.xml", "footnote")
        endnote_details = _note_details(document, archive, names, "word/endnotes.xml", "endnote")
        story_parts = ["word/document.xml"] + sorted(
            name for name in names if re.fullmatch(r"word/(?:header|footer)\d+\.xml", name)
        )
        story_roots: list[tuple[str, ET.Element]] = []
        skipped_story_parts: list[str] = []
        for part in story_parts:
            try:
                story_root = document if part == "word/document.xml" else ET.fromstring(archive.read(part))
            except ET.ParseError:
                skipped_story_parts.append(part)
                continue
            story_roots.append((part, story_root))
        accessibility_findings, accessibility_summary = _accessibility_audit(story_roots, skipped_story_parts)

    protection = None
    if settings is not None:
        element = settings.find(W + "documentProtection")
        if element is not None:
            protection = {
                "edit": element.get(W + "edit"),
                "enforcement": element.get(W + "enforcement"),
                "hasPasswordHash": bool(element.get(W + "hash")),
                "algorithmId": element.get(W + "cryptAlgorithmSid"),
            }
    return {
        "ok": True,
        "input": str(source),
        "features": {
            "sections": sections,
            "tables": tables,
            "images": images,
            "simpleFields": simple_fields,
            "complexFieldInstructions": complex_fields,
            "classicCommentCount": len(comments_root.findall(W + "comment")) if comments_root is not None else 0,
            "footnoteCount": sum(
                1 for note in footnotes_root.findall(W + "footnote")
                if note.get(W + "type") not in {"separator", "continuationSeparator"}
            ) if footnotes_root is not None else 0,
            "footnotes": footnote_details,
            "endnoteCount": sum(
                1 for note in endnotes_root.findall(W + "endnote")
                if note.get(W + "type") not in {"separator", "continuationSeparator"}
            ) if endnotes_root is not None else 0,
            "endnotes": endnote_details,
            "watermarks": watermarks,
            "protection": protection,
            "accessibilityFindings": accessibility_findings,
            "accessibilitySummary": accessibility_summary,
        },
        "limitations": [
            "inspects common OOXML parts only; not a complete Word feature or accessibility audit",
            "table cell widths are compared directly to grid widths; merged cells and gridSpan need manual review",
            "section link-to-previous is inferred from absent default header/footer references and is not resolved through relationships",
            "note references are counted from word/document.xml only; alternate stories and custom note parts are not scanned",
            "accessibility checks are mechanical guidance, not a complete WCAG or assistive-technology audit",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(audit(args.input), ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
