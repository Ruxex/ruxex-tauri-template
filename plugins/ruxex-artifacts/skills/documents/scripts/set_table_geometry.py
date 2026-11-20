#!/usr/bin/env python3
"""Set exact DXA geometry for selected top-level body tables in a DOCX copy.

Only unmerged tables with the requested number of cells in every row are
supported. Widths are written to tblW, tblGrid, and each cell's tcW; layout is
fixed and the requested table indent and cell margins are applied uniformly.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.dont_write_bytecode = True
from ooxml_xml import parse_xml, serialize_xml

W_URI = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = "{" + W_URI + "}"

TBLPR_ORDER = [
    "tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize",
    "tblStyleColBandSize", "tblW", "jc", "tblCellSpacing", "tblInd",
    "tblBorders", "shd", "tblLayout", "tblCellMar", "tblLook", "tblCaption",
    "tblDescription",
]
TCPR_ORDER = [
    "cnfStyle", "tcW", "gridSpan", "hMerge", "vMerge", "tcBorders", "shd",
    "noWrap", "tcMar", "textDirection", "tcFitText", "vAlign", "hideMark",
    "headers", "cellIns", "cellDel", "cellMerge",
]
MARGIN_SIDES = ("start", "end", "top", "bottom")
TCMAR_ORDER = ["top", "start", "bottom", "end", "insideH", "insideV"]
DEFAULT_MARGINS_DXA = {"top": 80, "bottom": 80, "start": 120, "end": 120}


def _ensure_ordered_child(parent: ET.Element, local_name: str, order: list[str]) -> ET.Element:
    tag = W + local_name
    existing = parent.find(tag)
    if existing is not None:
        return existing
    child = ET.Element(tag)
    target_order = order.index(local_name) if local_name in order else len(order)
    insert_at = len(parent)
    for index, current in enumerate(list(parent)):
        current_name = current.tag[len(W):] if current.tag.startswith(W) else ""
        if current_name in order and order.index(current_name) > target_order:
            insert_at = index
            break
    parent.insert(insert_at, child)
    return child


def _ensure_table_properties(table: ET.Element) -> ET.Element:
    properties = table.find(W + "tblPr")
    if properties is None:
        properties = ET.Element(W + "tblPr")
        table.insert(0, properties)
    return properties


def _ensure_table_grid(table: ET.Element) -> ET.Element:
    grid = table.find(W + "tblGrid")
    if grid is None:
        grid = ET.Element(W + "tblGrid")
        properties = table.find(W + "tblPr")
        table.insert(list(table).index(properties) + 1 if properties is not None else 0, grid)
    return grid


def _table_rows(table: ET.Element) -> list[ET.Element]:
    return table.findall(W + "tr")


def _validate_table(table: ET.Element, index: int, column_count: int) -> list[ET.Element]:
    rows = _table_rows(table)
    if not rows:
        raise ValueError(f"table {index} has no direct body rows")
    for row_index, row in enumerate(rows):
        cells = row.findall(W + "tc")
        for cell_index, cell in enumerate(cells):
            tcpr = cell.find(W + "tcPr")
            if tcpr is None:
                continue
            if tcpr.find(W + "gridSpan") is not None:
                raise ValueError(f"table {index} contains gridSpan/merged cells and cannot be resized safely")
            if tcpr.find(W + "hMerge") is not None or tcpr.find(W + "vMerge") is not None:
                raise ValueError(f"table {index} contains merged cells (hMerge/vMerge) and cannot be resized safely")
        if len(cells) != column_count:
            raise ValueError(
                f"table {index}, row {row_index} has {len(cells)} cells; expected {column_count} columns"
            )
    return rows


def _set_dxa(element: ET.Element, value: int) -> None:
    element.set(W + "w", str(value))
    element.set(W + "type", "dxa")


def _apply_table(table: ET.Element, widths: list[int], indent: int,
                 margins: dict[str, int]) -> None:
    properties = _ensure_table_properties(table)
    total_width = sum(widths)
    table_width = _ensure_ordered_child(properties, "tblW", TBLPR_ORDER)
    _set_dxa(table_width, total_width)
    table_indent = _ensure_ordered_child(properties, "tblInd", TBLPR_ORDER)
    _set_dxa(table_indent, indent)
    layout = _ensure_ordered_child(properties, "tblLayout", TBLPR_ORDER)
    layout.set(W + "type", "fixed")

    grid = _ensure_table_grid(table)
    for column in list(grid):
        grid.remove(column)
    for width in widths:
        column = ET.SubElement(grid, W + "gridCol")
        column.set(W + "w", str(width))

    for row in _table_rows(table):
        for cell, width in zip(row.findall(W + "tc"), widths):
            tcpr = cell.find(W + "tcPr")
            if tcpr is None:
                tcpr = ET.Element(W + "tcPr")
                cell.insert(0, tcpr)
            cell_width = _ensure_ordered_child(tcpr, "tcW", TCPR_ORDER)
            _set_dxa(cell_width, width)
            cell_margins = _ensure_ordered_child(tcpr, "tcMar", TCPR_ORDER)
            for side in MARGIN_SIDES:
                margin = _ensure_ordered_child(cell_margins, side, TCMAR_ORDER)
                _set_dxa(margin, margins[side])


def set_table_geometry(source: Path, destination: Path, widths: list[int], *,
                       table_indices: list[int] | None = None, indent_dxa: int = 120,
                       margins_dxa: dict[str, int] | None = None) -> dict:
    source = source.expanduser().resolve(strict=True)
    destination = destination.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    if destination.suffix.lower() != ".docx" or destination == source:
        raise ValueError("output must be a different .docx file")
    if destination.exists():
        raise FileExistsError(f"output already exists: {destination}")
    if not widths or any(width <= 0 for width in widths):
        raise ValueError("column widths must be positive DXA integers")
    if indent_dxa < 0:
        raise ValueError("table indent must be a nonnegative DXA integer")
    margins = dict(DEFAULT_MARGINS_DXA)
    if margins_dxa:
        margins.update(margins_dxa)
    if any(margins[side] < 0 for side in MARGIN_SIDES):
        raise ValueError("cell margins must be nonnegative DXA integers")
    if not zipfile.is_zipfile(source):
        raise ValueError("input is not a valid DOCX/ZIP file")

    with zipfile.ZipFile(source) as archive:
        if "word/document.xml" not in archive.namelist():
            raise ValueError("DOCX is missing word/document.xml")
        original = archive.read("word/document.xml")
        root = parse_xml(original)
        body = root.find(W + "body")
        if body is None:
            raise ValueError("word/document.xml is missing w:body")
        tables = body.findall(W + "tbl")
        if not tables:
            raise ValueError("document has no top-level body tables")
        if table_indices is None:
            selected_indices = list(range(len(tables)))
        else:
            if len(table_indices) != len(set(table_indices)):
                raise ValueError("--table-index values must not be repeated")
            if any(index < 0 or index >= len(tables) for index in table_indices):
                raise ValueError(f"table index must be between 0 and {len(tables) - 1}")
            selected_indices = list(table_indices)
            if not selected_indices:
                raise ValueError("select at least one table, or omit --table-index to select all")

        # Complete preflight before changing the in-memory XML so merged or
        # irregular tables never produce a partial output document.
        selected = [(index, tables[index], _validate_table(tables[index], index, len(widths)))
                    for index in selected_indices]
        for _index, table, _rows in selected:
            _apply_table(table, widths, indent_dxa, margins)
        updated = serialize_xml(root, original)

        destination.parent.mkdir(parents=True, exist_ok=True)
        temp_name = None
        try:
            with tempfile.NamedTemporaryFile(prefix=".set-table-geometry-", suffix=".docx",
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
            "tableIndices": selected_indices, "columnWidthsDxa": widths,
            "tableWidthDxa": sum(widths), "indentDxa": indent_dxa,
            "cellMarginsDxa": margins,
            "limitations": [
                "only top-level body tables are selected; header/footer tables are untouched",
                "merged cells, gridSpan, hMerge/vMerge, and irregular row cell counts are refused",
            ]}


def _positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be an integer DXA value") from error
    if number <= 0:
        raise argparse.ArgumentTypeError("must be a positive DXA value")
    return number


def _nonnegative_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be an integer DXA value") from error
    if number < 0:
        raise argparse.ArgumentTypeError("must be a nonnegative DXA value")
    return number


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_docx", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--column-widths-dxa", required=True, nargs="+", type=_positive_int,
                        help="column widths in DXA; sum becomes table width")
    parser.add_argument("--table-index", action="append", type=int,
                        help="zero-based top-level body table index; repeat to select several (default: all)")
    parser.add_argument("--indent-dxa", type=_nonnegative_int, default=120)
    parser.add_argument("--start-margin-dxa", type=_nonnegative_int, default=120)
    parser.add_argument("--end-margin-dxa", type=_nonnegative_int, default=120)
    parser.add_argument("--top-margin-dxa", type=_nonnegative_int, default=80)
    parser.add_argument("--bottom-margin-dxa", type=_nonnegative_int, default=80)
    args = parser.parse_args()
    margins = {"start": args.start_margin_dxa, "end": args.end_margin_dxa,
               "top": args.top_margin_dxa, "bottom": args.bottom_margin_dxa}
    try:
        result = set_table_geometry(args.input_docx, args.out, args.column_widths_dxa,
                                    table_indices=args.table_index, indent_dxa=args.indent_dxa,
                                    margins_dxa=margins)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
