#!/usr/bin/env python3
"""Export simple DOCX tables as UTF-8 CSV files."""

from __future__ import annotations

import argparse
import csv
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def export_tables(input_path: Path, output_dir: Path) -> list[Path]:
    source = input_path.expanduser().resolve(strict=True)
    if not source.is_file() or source.suffix.lower() != ".docx":
        raise ValueError("input must be a regular .docx file")
    destination = output_dir.expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    tables = root.findall(f".//{W}body/{W}tbl")
    outputs = [destination / f"table-{index}.csv" for index in range(1, len(tables) + 1)]
    collisions = [path for path in outputs if path.exists()]
    if collisions:
        raise FileExistsError(f"output already exists: {collisions[0]}")
    for path, table in zip(outputs, tables, strict=True):
        with path.open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.writer(stream)
            for row in table.findall(W + "tr"):
                writer.writerow([
                    "".join(node.text or "" for node in cell.findall(f".//{W}t"))
                    for cell in row.findall(W + "tc")
                ])
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    try:
        for output in export_tables(args.input, args.output_dir):
            print(output)
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
