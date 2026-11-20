#!/usr/bin/env python3
"""Write a concise Markdown style inventory from a DOCX/DOTX template."""

from __future__ import annotations

import argparse
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


def value(element: ET.Element | None, attribute: str = "val") -> str | None:
    return element.get(W + attribute) if element is not None else None


def distill(input_path: Path, output_path: Path) -> Path:
    source = input_path.expanduser().resolve(strict=True)
    output = output_path.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() not in {".docx", ".dotx"}:
        raise ValueError("input must be a regular .docx or .dotx file")
    if output.suffix.lower() != ".md" or output == source:
        raise ValueError("output must be a separate .md file")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")
    with zipfile.ZipFile(source) as archive:
        names = set(archive.namelist())
        styles = ET.fromstring(archive.read("word/styles.xml"))
        document = ET.fromstring(archive.read("word/document.xml"))
        theme = ET.fromstring(archive.read("word/theme/theme1.xml")) if "word/theme/theme1.xml" in names else None
        numbering = ET.fromstring(archive.read("word/numbering.xml")) if "word/numbering.xml" in names else None

    defaults = styles.find(W + "docDefaults")
    run_defaults = defaults.find(f"{W}rPrDefault/{W}rPr") if defaults is not None else None
    default_font = value(run_defaults.find(W + "rFonts") if run_defaults is not None else None, "ascii")
    default_size = value(run_defaults.find(W + "sz") if run_defaults is not None else None)
    style_rows = []
    for style in styles.findall(W + "style"):
        style_id = style.get(W + "styleId", "")
        name = value(style.find(W + "name")) or style_id
        if not name:
            continue
        based_on = value(style.find(W + "basedOn"))
        outline = value(style.find(f"{W}pPr/{W}outlineLvl"))
        style_rows.append((style.get(W + "type", ""), name, style_id, based_on, outline))

    section = document.findall(f".//{W}sectPr")
    page = section[-1].find(W + "pgSz") if section else None
    margins = section[-1].find(W + "pgMar") if section else None
    colors = []
    fonts = []
    if theme is not None:
        scheme = theme.find(f".//{A}clrScheme")
        if scheme is not None:
            for color in scheme:
                child = next(iter(color), None)
                if child is not None:
                    colors.append((color.tag.rsplit("}", 1)[-1], child.get("lastClr") or child.get("val", "")))
        font_scheme = theme.find(f".//{A}fontScheme")
        if font_scheme is not None:
            for role in ("majorFont", "minorFont"):
                font = font_scheme.find(f"{A}{role}/{A}latin")
                if font is not None:
                    fonts.append((role, font.get("typeface", "")))
    abstract_count = len(numbering.findall(W + "abstractNum")) if numbering is not None else 0
    numbering_count = len(numbering.findall(W + "num")) if numbering is not None else 0

    lines = [
        "# Distilled DOCX Template Style Guide",
        "",
        f"Source: `{source.name}`",
        "",
        "This inventory records reusable document conventions. It does not include personal document properties.",
        "",
        "## Page setup",
        "",
    ]
    if page is not None:
        lines.append(f"- Page size: {page.get(W + 'w', '?')} × {page.get(W + 'h', '?')} twips; orientation: {page.get(W + 'orient', 'portrait')}.")
    if margins is not None:
        lines.append("- Margins (twips): " + ", ".join(f"{side}={margins.get(W + side, '?')}" for side in ("top", "right", "bottom", "left")) + ".")
    if default_font or default_size:
        lines.append(f"- Default run: font `{default_font or 'inherited'}`, size `{default_size or 'inherited'}` half-points.")
    if not any(line.startswith("-") for line in lines):
        lines.append("- No page setup or default run values found.")
    lines.extend(["", "## Theme", ""])
    lines.extend(f"- Color `{name}`: `{color}`." for name, color in colors)
    lines.extend(f"- Font `{role}`: `{font}`." for role, font in fonts)
    if not colors and not fonts:
        lines.append("- No theme color or font scheme found.")
    lines.extend(["", "## Styles", "", "| Type | Name | Style ID | Based on | Outline level |", "| --- | --- | --- | --- | --- |"])
    for style_type, name, style_id, based_on, outline in style_rows:
        cells = [style_type, name, style_id, based_on or "", outline or ""]
        lines.append("| " + " | ".join(cell.replace("|", "\\|") for cell in cells) + " |")
    lines.extend(["", "## Numbering inventory", "", f"- Abstract numbering definitions: {abstract_count}.", f"- Numbering instances: {numbering_count}.", ""])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines), encoding="utf-8")
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(distill(args.input, args.output))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
