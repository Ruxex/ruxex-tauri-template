#!/usr/bin/env python3
"""Render two DOCX files and compare page images plus extracted text."""

from __future__ import annotations

import argparse
import difflib
import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.dont_write_bytecode = True

from PIL import Image, ImageChops, ImageStat

from render_docx import render

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def text_lines(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    return [
        "".join(node.text or "" for node in paragraph.findall(f".//{W}t"))
        for paragraph in root.findall(f".//{W}p")
    ]


def compare(before: Path, after: Path, output_dir: Path, dpi: int) -> dict:
    before = before.expanduser().resolve(strict=True)
    after = after.expanduser().resolve(strict=True)
    if not before.is_file() or not after.is_file():
        raise ValueError("both inputs must be regular files")
    if before.suffix.lower() != ".docx" or after.suffix.lower() != ".docx":
        raise ValueError("both inputs must be .docx files")
    output = output_dir.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise ValueError("output directory must be empty")
    with tempfile.TemporaryDirectory(prefix="ruxex-docx-compare-") as temporary:
        temp = Path(temporary)
        staged_output = temp / "results"
        staged_output.mkdir()
        before_pages = render(before, temp / "before", dpi, False)
        after_pages = render(after, temp / "after", dpi, False)

        old_lines = text_lines(before)
        new_lines = text_lines(after)
        text_diff = list(difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=before.name,
            tofile=after.name,
            lineterm="",
        ))
        diff_path = output / "text.diff"
        (staged_output / "text.diff").write_text(
            "\n".join(text_diff) + ("\n" if text_diff else ""),
            encoding="utf-8",
        )

        page_report = []
        for index in range(max(len(before_pages), len(after_pages))):
            entry = {"page": index + 1, "before": index < len(before_pages), "after": index < len(after_pages)}
            if index < len(before_pages) and index < len(after_pages):
                with Image.open(before_pages[index]) as old_image, Image.open(after_pages[index]) as new_image:
                    size = (max(old_image.width, new_image.width), max(old_image.height, new_image.height))
                    old_canvas = Image.new("RGB", size, "white")
                    new_canvas = Image.new("RGB", size, "white")
                    old_canvas.paste(old_image.convert("RGB"), (0, 0))
                    new_canvas.paste(new_image.convert("RGB"), (0, 0))
                    difference = ImageChops.difference(old_canvas, new_canvas)
                    entry["meanAbsoluteDifference"] = round(sum(ImageStat.Stat(difference).mean) / 3, 3)
                    diff_name = f"page-{index + 1:03d}-diff.png"
                    difference.save(staged_output / diff_name)
                    entry["diffImage"] = str(output / diff_name)
            page_report.append(entry)

        for label, pages in (("before", before_pages), ("after", after_pages)):
            for index, page in enumerate(pages, start=1):
                target = output / f"{label}-page-{index:03d}.png"
                shutil.copy2(page, staged_output / target.name)
        report = {
            "ok": True,
            "before": str(before),
            "after": str(after),
            "pageCounts": {"before": len(before_pages), "after": len(after_pages)},
            "textChanged": old_lines != new_lines,
            "textDiff": str(diff_path),
            "pageComparison": page_report,
            "imageDiffAvailable": True,
        }
        report_path = output / "comparison.json"
        (staged_output / report_path.name).write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        copied = []
        try:
            for staged in staged_output.iterdir():
                target = output / staged.name
                shutil.copy2(staged, target)
                copied.append(target)
        except Exception:
            for target in copied:
                target.unlink(missing_ok=True)
            raise
        return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before", required=True, type=Path)
    parser.add_argument("--after", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--dpi", type=int, default=120)
    args = parser.parse_args()
    if not 72 <= args.dpi <= 600:
        parser.error("--dpi must be between 72 and 600")
    try:
        print(json.dumps(compare(args.before, args.after, args.output_dir, args.dpi), ensure_ascii=False, indent=2))
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
