#!/usr/bin/env python3
"""Apply safe, local JSON patch operations to DOCX paragraphs and tables.

Supported operations are format_paragraph, format_run, set_section_layout,
replace_table_cell_text, insert_paragraph_after, insert_table_after,
replace_table_rows, and append_table_row. Formatting and cell replacement can
select document/headerN/footerN parts; structural edits target document only.
Each paragraph target is an exact-one substring match.
Table cell replacement is restricted to plain, unmerged cells without fields,
comments, revisions, drawings, nested tables, hyperlinks, or content controls.
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import os
import re
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml

W_URI = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = "{" + W_URI + "}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
PPR_ORDER = [
    "pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl",
    "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens",
    "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN",
    "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing",
    "mirrorIndents", "jc", "textDirection", "textAlignment", "textboxTightWrap",
    "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange",
]
RPR_ORDER = [
    "rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike",
    "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid",
    "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz",
    "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign",
    "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath", "rPrChange",
]
SECTPR_ORDER = [
    "headerReference", "footerReference", "footnotePr", "endnotePr", "type", "pgSz",
    "pgMar", "paperSrc", "pgBorders", "lnNumType", "pgNumType", "cols", "formProt",
    "vAlign", "noEndnote", "titlePg", "textDirection", "bidi", "rtlGutter", "docGrid",
    "printerSettings", "sectPrChange",
]
TBLPR_ORDER = [
    "tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize",
    "tblStyleColBandSize", "tblW", "jc", "tblCellSpacing", "tblInd", "tblBorders",
    "shd", "tblLayout", "tblCellMar", "tblLook", "tblCaption", "tblDescription",
]
TCPR_ORDER = [
    "cnfStyle", "tcW", "gridSpan", "hMerge", "vMerge", "tcBorders", "shd", "noWrap",
    "tcMar", "textDirection", "tcFitText", "vAlign", "hideMark", "headers", "cellIns",
    "cellDel", "cellMerge",
]
ALIGNMENTS = {"left", "center", "right", "both", "distribute", "start", "end"}
BUILTIN_STYLES = {
    "normal": "Normal", "title": "Title", "subtitle": "Subtitle",
    "heading 1": "Heading1", "heading1": "Heading1",
    "heading 2": "Heading2", "heading2": "Heading2",
    "heading 3": "Heading3", "heading3": "Heading3",
    "heading 4": "Heading4", "heading4": "Heading4",
    "heading 5": "Heading5", "heading5": "Heading5",
    "heading 6": "Heading6", "heading6": "Heading6",
    "heading 7": "Heading7", "heading7": "Heading7",
    "heading 8": "Heading8", "heading8": "Heading8",
    "heading 9": "Heading9", "heading9": "Heading9",
    "caption": "Caption", "quote": "Quote", "intense quote": "IntenseQuote",
    "list paragraph": "ListParagraph", "no spacing": "NoSpacing",
    "body text": "BodyText", "header": "Header", "footer": "Footer",
    "footnote text": "FootnoteText", "endnote text": "EndnoteText",
}
UNSAFE_CELL_TAGS = {
    "tbl", "fldSimple", "fldChar", "instrText", "commentRangeStart", "commentRangeEnd",
    "commentReference", "ins", "del", "moveFrom", "moveTo", "moveFromRangeStart",
    "moveFromRangeEnd", "moveToRangeStart", "moveToRangeEnd", "drawing", "pict", "object",
    "hyperlink", "sdt", "bookmarkStart", "bookmarkEnd", "gridSpan", "hMerge", "vMerge",
    "footnoteReference", "endnoteReference", "permStart", "permEnd", "customXml", "smartTag",
}


def _ordered_child(parent: ET.Element, local_name: str) -> ET.Element:
    return _ordered_child_for(parent, local_name, PPR_ORDER)


def _ordered_child_for(parent: ET.Element, local_name: str, order: list[str]) -> ET.Element:
    tag = W + local_name
    child = parent.find(tag)
    if child is not None:
        return child
    child = ET.Element(tag)
    target_order = order.index(local_name)
    for index, current in enumerate(list(parent)):
        current_name = current.tag[len(W):] if current.tag.startswith(W) else ""
        if current_name in order and order.index(current_name) > target_order:
            parent.insert(index, child)
            return child
    parent.append(child)
    return child


def _paragraph_properties(paragraph: ET.Element) -> ET.Element:
    properties = paragraph.find(W + "pPr")
    if properties is None:
        properties = ET.Element(W + "pPr")
        paragraph.insert(0, properties)
    return properties


def _paragraph_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.iter(W + "t"))


def _targets(body: ET.Element, substring: str) -> list[ET.Element]:
    return [paragraph for paragraph in body.findall(W + "p") if substring in _paragraph_text(paragraph)]


def _style_id(style: str) -> str:
    if not isinstance(style, str):
        raise ValueError("style must be a built-in paragraph style name")
    key = style.strip().casefold()
    if key not in BUILTIN_STYLES:
        raise ValueError(f"unsupported built-in paragraph style: {style!r}")
    return BUILTIN_STYLES[key]


def _validate_alignment(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("alignment must be a string")
    value = value.strip().lower()
    if value not in ALIGNMENTS:
        raise ValueError(f"unsupported paragraph alignment: {value!r}")
    return value


def _set_alignment(paragraph: ET.Element, alignment: str) -> None:
    properties = _paragraph_properties(paragraph)
    element = _ordered_child(properties, "jc")
    element.set(W + "val", alignment)


def _format_paragraph(paragraph: ET.Element, operation: dict) -> None:
    allowed = {"op", "contains", "style", "alignment", "spacingBefore", "spacingAfter",
               "keepWithNext", "pageBreakBefore"}
    unknown = set(operation) - allowed
    if unknown:
        raise ValueError(f"unknown format_paragraph field(s): {', '.join(sorted(unknown))}")
    if not any(key in operation for key in allowed - {"op", "contains"}):
        raise ValueError("format_paragraph must specify at least one formatting property")
    properties = _paragraph_properties(paragraph)
    if "style" in operation:
        style = _style_id(operation["style"])
        element = _ordered_child(properties, "pStyle")
        element.set(W + "val", style)
    if "alignment" in operation:
        _set_alignment(paragraph, _validate_alignment(operation["alignment"]))
    if "spacingBefore" in operation or "spacingAfter" in operation:
        spacing = _ordered_child(properties, "spacing")
        for key, attribute in (("spacingBefore", "before"), ("spacingAfter", "after")):
            if key in operation:
                value = operation[key]
                if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                    raise ValueError(f"{key} must be a nonnegative integer in DXA")
                spacing.set(W + attribute, str(value))
    for key, tag in (("keepWithNext", "keepNext"), ("pageBreakBefore", "pageBreakBefore")):
        if key in operation:
            value = operation[key]
            if not isinstance(value, bool):
                raise ValueError(f"{key} must be a JSON boolean")
            element = _ordered_child(properties, tag)
            element.set(W + "val", "1" if value else "0")


def _make_text_run(text: str, run_properties: ET.Element | None = None) -> ET.Element:
    run = ET.Element(W + "r")
    if run_properties is not None:
        run.append(copy.deepcopy(run_properties))
    node = ET.SubElement(run, W + "t")
    node.text = text
    if text.startswith(" ") or text.endswith(" "):
        node.set(XML_SPACE, "preserve")
    return run


def _unsafe_descendant(cell: ET.Element) -> str | None:
    for node in cell.iter():
        if not node.tag.startswith(W):
            return "foreign XML"
        if any(key.startswith("{") and not key.startswith((W, "{http://www.w3.org/XML/1998/namespace}"))
               for key in node.attrib):
            return "relationship or extension attributes"
        if node is cell:
            continue
        if node.tag.startswith(W):
            local = node.tag[len(W):]
            if local in UNSAFE_CELL_TAGS or local.endswith("Change") or local == "delText":
                return local
    return None


def _replace_cell(cell: ET.Element, text: str, alignment: str | None) -> None:
    unsafe = _unsafe_descendant(cell)
    if unsafe:
        raise ValueError(f"table cell contains unsupported {unsafe} content")
    if any(child.tag not in {W + "tcPr", W + "p"} for child in list(cell)):
        raise ValueError("table cell contains unsupported non-paragraph content")
    properties = cell.find(W + "tcPr")
    paragraphs = cell.findall(W + "p")
    first_paragraph = paragraphs[0] if paragraphs else ET.Element(W + "p")
    paragraph_properties = first_paragraph.find(W + "pPr")
    first_run = first_paragraph.find(W + "r")
    run_properties = first_run.find(W + "rPr") if first_run is not None else None
    for child in list(cell):
        if child is not properties:
            cell.remove(child)
    if paragraph_properties is None:
        paragraph_properties = ET.Element(W + "pPr")
        first_paragraph.insert(0, paragraph_properties)
    for child in list(first_paragraph):
        if child is not paragraph_properties:
            first_paragraph.remove(child)
    first_paragraph.append(_make_text_run(text, run_properties))
    if alignment is not None:
        _set_alignment(first_paragraph, alignment)
    cell.append(first_paragraph)


def _format_rpr(run_properties: ET.Element, values: dict) -> None:
    if "bold" in values:
        if not isinstance(values["bold"], bool):
            raise ValueError("bold must be a JSON boolean")
        element = _ordered_child_for(run_properties, "b", RPR_ORDER)
        element.set(W + "val", "1" if values["bold"] else "0")
    if "italic" in values:
        if not isinstance(values["italic"], bool):
            raise ValueError("italic must be a JSON boolean")
        element = _ordered_child_for(run_properties, "i", RPR_ORDER)
        element.set(W + "val", "1" if values["italic"] else "0")
    if "fontFace" in values:
        face = values["fontFace"]
        if not isinstance(face, str) or not face.strip():
            raise ValueError("fontFace must be a nonempty string")
        fonts = _ordered_child_for(run_properties, "rFonts", RPR_ORDER)
        for attribute in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"):
            fonts.attrib.pop(W + attribute, None)
        for attribute in ("ascii", "hAnsi", "eastAsia", "cs"):
            fonts.set(W + attribute, face.strip())
    if "fontSizePt" in values:
        size = values["fontSizePt"]
        if isinstance(size, bool) or not isinstance(size, (int, float)) or not math.isfinite(size) or size <= 0:
            raise ValueError("fontSizePt must be a positive finite number")
        half_points = str(max(1, round(size * 2)))
        for local in ("sz", "szCs"):
            element = _ordered_child_for(run_properties, local, RPR_ORDER)
            element.set(W + "val", half_points)
    if "color" in values:
        color = values["color"]
        if not isinstance(color, str):
            raise ValueError("color must be a 6-digit RGB string")
        color = color.lstrip("#")
        if len(color) != 6 or any(char not in "0123456789abcdefABCDEF" for char in color):
            raise ValueError("color must be a 6-digit RGB string")
        element = _ordered_child_for(run_properties, "color", RPR_ORDER)
        for attribute in ("themeColor", "themeTint", "themeShade"):
            element.attrib.pop(W + attribute, None)
        element.set(W + "val", color.upper())


def _clone_run_with_text(original: ET.Element, text: str, formatting: dict | None = None) -> ET.Element:
    run = ET.Element(W + "r", dict(original.attrib))
    original_properties = original.find(W + "rPr")
    run_properties = copy.deepcopy(original_properties) if original_properties is not None else None
    if formatting:
        if run_properties is None:
            run_properties = ET.Element(W + "rPr")
        _format_rpr(run_properties, formatting)
    if run_properties is not None:
        run.append(run_properties)
    text_node = ET.SubElement(run, W + "t")
    text_node.text = text
    if text.startswith(" ") or text.endswith(" "):
        text_node.set(XML_SPACE, "preserve")
    return run


def _format_run(root: ET.Element, operation: dict) -> None:
    allowed = {"op", "contains", "bold", "italic", "fontFace", "fontSizePt", "color"}
    unknown = set(operation) - allowed
    if unknown:
        raise ValueError(f"unknown format_run field(s): {', '.join(sorted(unknown))}")
    substring = operation.get("contains")
    if not isinstance(substring, str) or not substring:
        raise ValueError("format_run requires a nonempty contains substring")
    formatting = {key: value for key, value in operation.items() if key not in {"op", "contains"}}
    if not formatting:
        raise ValueError("format_run must specify at least one formatting property")
    matching = []
    for run in root.iter(W + "r"):
        text_nodes = run.findall(W + "t")
        text = "".join(node.text or "" for node in text_nodes)
        if substring in text:
            if text.count(substring) != 1:
                raise ValueError("format_run substring must occur exactly once within its run")
            matching.append((run, text))
    if len(matching) != 1:
        raise ValueError(f"format_run target must be fully contained in one unique run; found {len(matching)}")
    original, text = matching[0]
    if any(child.tag not in {W + "rPr", W + "t"} for child in list(original)):
        raise ValueError("format_run refuses runs with non-text content")
    if len(original.findall(W + "rPr")) > 1 or not original.findall(W + "t"):
        raise ValueError("format_run requires a simple text run")
    parent = next((node for node in root.iter() if original in list(node)), None)
    if parent is None or parent.tag not in {W + "p", W + "hyperlink"}:
        raise ValueError("format_run target is inside unsupported markup")
    start = text.index(substring)
    end = start + len(substring)
    replacements = []
    if start:
        replacements.append(_clone_run_with_text(original, text[:start]))
    replacements.append(_clone_run_with_text(original, text[start:end], formatting))
    if end < len(text):
        replacements.append(_clone_run_with_text(original, text[end:]))
    index = list(parent).index(original)
    parent.remove(original)
    for offset, run in enumerate(replacements):
        parent.insert(index + offset, run)


def _set_section_layout(root: ET.Element, operation: dict) -> None:
    allowed = {"op", "sectionIndex", "orientation", "pageWidthDxa", "pageHeightDxa", "marginsDxa"}
    unknown = set(operation) - allowed
    if unknown:
        raise ValueError(f"unknown set_section_layout field(s): {', '.join(sorted(unknown))}")
    index = operation.get("sectionIndex")
    if isinstance(index, bool) or not isinstance(index, int) or index < 0:
        raise ValueError("sectionIndex must be a nonnegative integer")
    if not any(key in operation for key in allowed - {"op", "sectionIndex"}):
        raise ValueError("set_section_layout must specify at least one layout property")
    sections = root.findall(f".//{W}sectPr")
    if index >= len(sections):
        raise ValueError(f"sectionIndex {index} is out of range")
    section = sections[index]
    if "orientation" in operation:
        orientation = operation["orientation"]
        if not isinstance(orientation, str) or orientation.lower() not in {"portrait", "landscape"}:
            raise ValueError("orientation must be portrait or landscape")
        page_size = _ordered_child_for(section, "pgSz", SECTPR_ORDER)
        page_size.set(W + "orient", orientation.lower())
    dimensions = {"pageWidthDxa": "w", "pageHeightDxa": "h"}
    if any(key in operation for key in dimensions):
        page_size = _ordered_child_for(section, "pgSz", SECTPR_ORDER)
        for key, attribute in dimensions.items():
            if key in operation:
                value = operation[key]
                if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                    raise ValueError(f"{key} must be a positive integer in DXA")
                page_size.set(W + attribute, str(value))
    if "marginsDxa" in operation:
        margins = operation["marginsDxa"]
        allowed_margins = {"top", "bottom", "left", "right", "header", "footer", "gutter"}
        if not isinstance(margins, dict) or not margins or set(margins) - allowed_margins:
            raise ValueError("marginsDxa must be a nonempty object of supported DXA margins")
        for name, value in margins.items():
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError(f"margin {name} must be a nonnegative integer in DXA")
        page_margins = _ordered_child_for(section, "pgMar", SECTPR_ORDER)
        for name, value in margins.items():
            page_margins.set(W + name, str(value))


def _insert_table_after(body: ET.Element, operation: dict) -> None:
    allowed = {"op", "contains", "rows", "headerRow", "columnWidthsDxa", "style"}
    unknown = set(operation) - allowed
    if unknown:
        raise ValueError(f"unknown insert_table_after field(s): {', '.join(sorted(unknown))}")
    substring = operation.get("contains")
    if not isinstance(substring, str) or not substring:
        raise ValueError("insert_table_after requires a nonempty contains substring")
    matches = _targets(body, substring)
    if len(matches) != 1:
        raise ValueError(f"insert_table_after target must match exactly one top-level paragraph; found {len(matches)}")
    rows = operation.get("rows")
    if not isinstance(rows, list) or not rows or any(not isinstance(row, list) or not row for row in rows):
        raise ValueError("rows must be a nonempty rectangular array of nonempty row arrays")
    column_count = len(rows[0])
    if any(len(row) != column_count or any(not isinstance(value, str) for value in row) for row in rows):
        raise ValueError("rows must be rectangular and contain only string cell values")
    header_row = operation.get("headerRow", False)
    if not isinstance(header_row, bool):
        raise ValueError("headerRow must be a JSON boolean")
    style = operation.get("style")
    if style is not None and (not isinstance(style, str) or not style.strip() or len(style.strip()) > 40):
        raise ValueError("style must be a nonempty table style ID of at most 40 characters")
    widths = operation.get("columnWidthsDxa")
    if widths is None:
        if column_count > 9360:
            raise ValueError("too many columns for the default 9360-DXA table width; provide columnWidthsDxa")
        base = 9360 // column_count
        widths = [base] * column_count
        widths[-1] += 9360 - sum(widths)
    elif (not isinstance(widths, list) or len(widths) != column_count or
          any(isinstance(value, bool) or not isinstance(value, int) or value <= 0 for value in widths)):
        raise ValueError("columnWidthsDxa must contain one positive integer DXA value per column")
    if sum(widths) <= 0:
        raise ValueError("table width must be positive")

    table = ET.Element(W + "tbl")
    properties = ET.SubElement(table, W + "tblPr")
    if style is not None:
        table_style = _ordered_child_for(properties, "tblStyle", TBLPR_ORDER)
        table_style.set(W + "val", style.strip())
    table_width = _ordered_child_for(properties, "tblW", TBLPR_ORDER)
    table_width.set(W + "w", str(sum(widths)))
    table_width.set(W + "type", "dxa")
    layout = _ordered_child_for(properties, "tblLayout", TBLPR_ORDER)
    layout.set(W + "type", "fixed")
    grid = ET.SubElement(table, W + "tblGrid")
    for width in widths:
        column = ET.SubElement(grid, W + "gridCol")
        column.set(W + "w", str(width))
    for row_index, values in enumerate(rows):
        row = ET.SubElement(table, W + "tr")
        if header_row and row_index == 0:
            row_properties = ET.SubElement(row, W + "trPr")
            ET.SubElement(row_properties, W + "tblHeader").set(W + "val", "1")
        for value, width in zip(values, widths):
            cell = ET.SubElement(row, W + "tc")
            cell_properties = ET.SubElement(cell, W + "tcPr")
            cell_width = ET.SubElement(cell_properties, W + "tcW")
            cell_width.set(W + "w", str(width))
            cell_width.set(W + "type", "dxa")
            paragraph = ET.SubElement(cell, W + "p")
            paragraph.append(_make_text_run(value))
    target = matches[0]
    body.insert(list(body).index(target) + 1, table)


def _simple_table(body: ET.Element, index: int) -> tuple[ET.Element, list[ET.Element], int]:
    if isinstance(index, bool) or not isinstance(index, int) or index < 0:
        raise ValueError("tableIndex must be a nonnegative integer")
    tables = body.findall(W + "tbl")
    if index >= len(tables):
        raise ValueError(f"tableIndex {index} is out of range")
    table = tables[index]
    # Structural edits clone rows. Reject anything carrying identities, references,
    # nested structures or row geometry that cannot safely be cloned or removed.
    for node in table.iter():
        if not node.tag.startswith(W):
            raise ValueError("structural table edits require WordprocessingML-only content")
        if any(key.startswith("{") and not key.startswith((W, "{http://www.w3.org/XML/1998/namespace}"))
               for key in node.attrib):
            raise ValueError("structural table edits refuse relationship or extension attributes")
        local = node.tag[len(W):]
        if node is not table and (local in UNSAFE_CELL_TAGS or local.endswith("Change")
                                 or local in {"delText", "gridBefore", "gridAfter", "tblPrEx", "tblpPr", "sectPr", "numPr"}):
            raise ValueError(f"structural table edits refuse unsupported {local} content")
    if any(child.tag not in {W + "tblPr", W + "tblGrid", W + "tr"} for child in table):
        raise ValueError("structural table edits require direct table rows")
    rows = table.findall(W + "tr")
    grid = table.find(W + "tblGrid")
    columns = len(grid.findall(W + "gridCol")) if grid is not None else 0
    if not rows or not columns:
        raise ValueError("structural table edits require existing rows and an explicit column grid")
    for row in rows:
        if any(child.tag not in {W + "trPr", W + "tc"} for child in row):
            raise ValueError("structural table edits require direct row cells")
        cells = row.findall(W + "tc")
        if len(cells) != columns:
            raise ValueError("structural table edits require rectangular rows matching the column grid")
        for cell in cells:
            if any(child.tag not in {W + "tcPr", W + "p"} for child in cell):
                raise ValueError("structural table edits require plain paragraph cells")
            for paragraph in cell.findall(W + "p"):
                if any(child.tag not in {W + "pPr", W + "r"} for child in paragraph):
                    raise ValueError("structural table edits require plain text paragraphs")
                for run in paragraph.findall(W + "r"):
                    if any(child.tag not in {W + "rPr", W + "t"} for child in run):
                        raise ValueError("structural table edits refuse non-text run content")
    return table, rows, columns


def _edit_table_rows(body: ET.Element, operation: dict) -> None:
    kind = operation["op"]
    values_key = "values" if kind == "append_table_row" else "rows"
    unknown = set(operation) - {"op", "tableIndex", values_key}
    if unknown:
        raise ValueError(f"unknown {kind} field(s): {', '.join(sorted(unknown))}")
    table, existing, columns = _simple_table(body, operation.get("tableIndex"))
    values = operation.get(values_key)
    replacement = [values] if kind == "append_table_row" else values
    if (not isinstance(replacement, list) or not replacement
            or any(not isinstance(row, list) or len(row) != columns
                   or any(not isinstance(value, str) for value in row) for row in replacement)):
        raise ValueError(f"{values_key} must contain string cells matching the existing {columns}-column grid")
    new_rows = []
    for index, values in enumerate(replacement):
        template_index = len(existing) - 1 if kind == "append_table_row" else min(index, len(existing) - 1)
        row = copy.deepcopy(existing[template_index])
        if kind == "append_table_row" or index >= len(existing):
            row_properties = row.find(W + "trPr")
            if row_properties is not None:
                for flag in row_properties.findall(W + "tblHeader"):
                    row_properties.remove(flag)
        for cell, value in zip(row.findall(W + "tc"), values):
            _replace_cell(cell, value, None)
        new_rows.append(row)
    if kind == "replace_table_rows":
        for row in existing:
            table.remove(row)
    for row in new_rows:
        table.append(row)


def _apply_operation(root: ET.Element, body: ET.Element, operation: dict) -> None:
    if not isinstance(operation, dict):
        raise ValueError("each operation must be a JSON object")
    kind = operation.get("op")
    if kind in {"replace_table_rows", "append_table_row"}:
        _edit_table_rows(body, operation)
        return
    if kind == "format_run":
        _format_run(root, operation)
        return
    if kind == "set_section_layout":
        _set_section_layout(root, operation)
        return
    if kind == "insert_table_after":
        _insert_table_after(body, operation)
        return
    if kind in {"format_paragraph", "insert_paragraph_after"}:
        if not isinstance(operation.get("contains"), str) or not operation["contains"]:
            raise ValueError(f"{kind} requires a nonempty contains substring")
        matches = _targets(body, operation["contains"])
        if len(matches) != 1:
            raise ValueError(f"{kind} target must match exactly one top-level paragraph; found {len(matches)}")
        target = matches[0]
        if kind == "format_paragraph":
            _format_paragraph(target, operation)
            return
        allowed = {"op", "contains", "text", "style"}
        unknown = set(operation) - allowed
        if unknown:
            raise ValueError(f"unknown insert_paragraph_after field(s): {', '.join(sorted(unknown))}")
        if not isinstance(operation.get("text"), str):
            raise ValueError("insert_paragraph_after requires text as a string")
        new_paragraph = ET.Element(W + "p")
        if "style" in operation:
            properties = ET.SubElement(new_paragraph, W + "pPr")
            style = ET.SubElement(properties, W + "pStyle")
            style.set(W + "val", _style_id(operation["style"]))
        new_paragraph.append(_make_text_run(operation["text"]))
        body.insert(list(body).index(target) + 1, new_paragraph)
        return
    if kind == "replace_table_cell_text":
        allowed = {"op", "tableIndex", "row", "column", "text", "alignment"}
        unknown = set(operation) - allowed
        if unknown:
            raise ValueError(f"unknown replace_table_cell_text field(s): {', '.join(sorted(unknown))}")
        indexes = []
        for key in ("tableIndex", "row", "column"):
            value = operation.get(key)
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError(f"{key} must be a nonnegative integer")
            indexes.append(value)
        if not isinstance(operation.get("text"), str):
            raise ValueError("replace_table_cell_text requires text as a string")
        alignment = _validate_alignment(operation["alignment"]) if "alignment" in operation else None
        tables = body.findall(W + "tbl")
        table_index, row_index, column_index = indexes
        if table_index >= len(tables):
            raise ValueError(f"tableIndex {table_index} is out of range")
        rows = tables[table_index].findall(W + "tr")
        if row_index >= len(rows):
            raise ValueError(f"row {row_index} is out of range for table {table_index}")
        cells = rows[row_index].findall(W + "tc")
        if column_index >= len(cells):
            raise ValueError(f"column {column_index} is out of range for table {table_index}, row {row_index}")
        row_properties = rows[row_index].find(W + "trPr")
        if row_properties is not None and any(row_properties.find(W + tag) is not None for tag in ("gridBefore", "gridAfter")):
            raise ValueError("table row has gridBefore/gridAfter, so its cell indexes are ambiguous")
        if any(node.tag in {W + "gridSpan", W + "hMerge", W + "vMerge"}
               for node in rows[row_index].iter()):
            raise ValueError("table row has merged cells, so its cell indexes are ambiguous")
        _replace_cell(cells[column_index], operation["text"], alignment)
        return
    raise ValueError(f"unsupported operation: {kind!r}")


def edit_docx(source: Path, destination: Path, operations: list[dict]) -> dict:
    source = source.expanduser().resolve(strict=True)
    destination = destination.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if destination.suffix.lower() != ".docx" or destination == source:
        raise ValueError("output must be a different .docx file")
    if destination.exists():
        raise FileExistsError(f"output already exists: {destination}")
    if not isinstance(operations, list) or not operations:
        raise ValueError("operations must be a nonempty JSON array")
    if not zipfile.is_zipfile(source):
        raise ValueError("input is not a valid DOCX/ZIP file")

    with zipfile.ZipFile(source) as archive:
        names = set(archive.namelist())
        if "word/document.xml" not in names:
            raise ValueError("DOCX is missing word/document.xml")
        parts = {}
        for operation in operations:
            if not isinstance(operation, dict):
                raise ValueError("each operation must be a JSON object")
            part = operation.get("part", "document")
            if not isinstance(part, str) or re.fullmatch(r"document|(?:header|footer)[1-9][0-9]*", part) is None:
                raise ValueError("part must be document, headerN or footerN (N starts at 1)")
            if part != "document" and operation.get("op") not in {
                "format_paragraph", "format_run", "replace_table_cell_text"
            }:
                raise ValueError("header/footer parts support only paragraph/run formatting and cell replacement")
            name = f"word/{part}.xml"
            if name not in names:
                raise ValueError(f"DOCX is missing selected part: {name}")
            if name not in parts:
                original = archive.read(name)
                root = parse_xml(original)
                expected_tag = W + ("document" if part == "document" else "hdr" if part.startswith("header") else "ftr")
                if root.tag != expected_tag:
                    raise ValueError(f"{name} has an unexpected root element")
                body = root.find(W + "body") if part == "document" else root
                if body is None:
                    raise ValueError("word/document.xml is missing w:body")
                parts[name] = (original, root, body)
            original, root, body = parts[name]
            # All selected parts live only in memory until every operation succeeds.
            local_operation = {key: value for key, value in operation.items() if key != "part"}
            _apply_operation(root, body, local_operation)
        updated = {name: serialize_xml(root, original)
                   for name, (original, root, body) in parts.items()}

        destination.parent.mkdir(parents=True, exist_ok=True)
        temp_name = None
        try:
            with tempfile.NamedTemporaryFile(prefix=".edit-docx-content-", suffix=".docx",
                                             dir=destination.parent, delete=False) as tmp:
                temp_name = tmp.name
            with zipfile.ZipFile(temp_name, "w", compression=zipfile.ZIP_DEFLATED) as output:
                for info in archive.infolist():
                    data = updated[info.filename] if info.filename in updated else archive.read(info.filename)
                    output.writestr(info, data)
            os.link(temp_name, destination)
            os.unlink(temp_name)
            temp_name = None
        finally:
            if temp_name and os.path.exists(temp_name):
                os.unlink(temp_name)
    return {"ok": True, "input": str(source), "output": str(destination),
            "operationsApplied": len(operations),
            "limitations": [
                "paragraph targets are top-level paragraphs in the selected document/headerN/footerN part and must match one substring uniquely",
                "structural table edits support simple body tables with a fixed explicit column grid; new rows clone the last row without its header flag",
                "paragraph style values are limited to the built-in styles listed by the helper",
                "table cell replacement collapses simple cell content to one paragraph",
                "table cell replacement refuses fields, comments, revisions, drawings, merges, hyperlinks, nested tables, and content controls",
                "run formatting matches a unique substring contained within one simple text run",
                "section layout edits only main document sectPr elements",
                "inserted tables use equal 9360-DXA widths when columnWidthsDxa is omitted",
            ]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_docx", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--operations-file", required=True, type=Path,
                        help="JSON file containing a nonempty array of patch operation objects")
    args = parser.parse_args()
    try:
        operations = json.loads(args.operations_file.read_text(encoding="utf-8"))
        result = edit_docx(args.input_docx, args.out, operations)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError, json.JSONDecodeError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
