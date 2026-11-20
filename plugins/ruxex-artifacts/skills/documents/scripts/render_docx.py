#!/usr/bin/env python3
"""Render DOCX pages with the shared, package-managed renderer runtime."""

from __future__ import annotations

import argparse
import copy
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path


def render(input_path: Path, output_dir: Path, dpi: int, keep_pdf: bool) -> list[Path]:
    source = input_path.expanduser().resolve(strict=True)
    if not source.is_file() or source.suffix.lower() not in {".docx", ".docm"}:
        raise ValueError("input must be a regular .docx or .docm file")

    runtime_root = os.environ.get("RUXEX_RUNTIME_ROOT")
    runtime_bin = os.environ.get("RUXEX_RUNTIME_BIN_DIR")
    if not runtime_root or not runtime_bin:
        raise RuntimeError(
            "document rendering must be launched with the bundled "
            "ruxex-artifacts runtime command "
            "(RUXEX_RUNTIME_ROOT and RUXEX_RUNTIME_BIN_DIR are unset)"
        )
    expected_bin = Path(runtime_root) / "bin/override"
    tool_dir = Path(runtime_bin)
    if tool_dir.resolve() != expected_bin.resolve():
        raise RuntimeError("RUXEX_RUNTIME_BIN_DIR does not match RUXEX_RUNTIME_ROOT")
    soffice = tool_dir / "soffice"
    for name, executable in (
        ("soffice", soffice),
        ("pdfinfo", tool_dir / "pdfinfo"),
        ("pdftoppm", tool_dir / "pdftoppm"),
    ):
        if not executable.is_file() or not os.access(executable, os.X_OK):
            raise RuntimeError(
                f"bundled rendering tool is missing or not executable: {name} ({executable})"
            )

    try:
        from pdf2image import convert_from_path
    except ImportError as error:
        raise RuntimeError(
            "the bundled document runtime is missing the locked pdf2image package"
        ) from error

    destination = output_dir.expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    pdf_name = f"{source.stem}.pdf"
    with tempfile.TemporaryDirectory(prefix="ruxex-docx-render-") as temporary:
        temp = Path(temporary)
        render_source = source
        with zipfile.ZipFile(source) as archive:
            member_names = [info.filename for info in archive.infolist()]
            repaired_names = [name.replace("\\", "/") for name in member_names]
            if len(set(repaired_names)) != len(repaired_names):
                raise RuntimeError("DOCX ZIP member names collide after path separator repair")
            if repaired_names != member_names:
                render_source = temp / source.name
                with zipfile.ZipFile(render_source, "w") as repaired:
                    for info, repaired_name in zip(archive.infolist(), repaired_names, strict=True):
                        repaired_info = copy.copy(info)
                        repaired_info.filename = repaired_name
                        repaired_info.orig_filename = repaired_name
                        repaired.writestr(repaired_info, archive.read(info))
        profile = (temp / "lo-profile").as_uri()
        converted = temp / pdf_name
        command = [
            str(soffice),
            "--headless",
            f"-env:UserInstallation={profile}",
            "--convert-to",
            "pdf",
            "--outdir",
            str(temp),
            str(render_source),
        ]
        result = subprocess.run(command, capture_output=True, text=True, timeout=180)
        if result.returncode != 0 or not converted.is_file():
            detail = (result.stderr or result.stdout).strip()
            raise RuntimeError(f"LibreOffice conversion failed: {detail or result.returncode}")

        try:
            rendered_pages = [
                Path(page)
                for page in convert_from_path(
                    converted,
                    dpi=dpi,
                    fmt="png",
                    output_folder=str(temp),
                    output_file=source.stem,
                    paths_only=True,
                    poppler_path=str(tool_dir),
                    timeout=180,
                )
            ]
        except Exception as error:
            raise RuntimeError(f"PDF page rendering failed: {error}") from error
        if not rendered_pages:
            raise RuntimeError("renderer completed without producing page images")
        pages = [destination / page.name for page in rendered_pages]
        retained_pdf = destination / pdf_name
        if any(page.exists() for page in pages) or (keep_pdf and retained_pdf.exists()):
            raise RuntimeError("one or more page images already exist in the output directory")
        for source_page, destination_page in zip(rendered_pages, pages, strict=True):
            shutil.copy2(source_page, destination_page)
        if keep_pdf:
            shutil.copy2(converted, retained_pdf)
        return pages


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="source DOCX/DOCM")
    parser.add_argument("--output-dir", required=True, type=Path, help="directory for page PNGs")
    parser.add_argument("--dpi", type=int, default=150, help="render resolution (72–600; default 150)")
    parser.add_argument("--keep-pdf", action="store_true", help="also retain the intermediate PDF")
    args = parser.parse_args()
    if not 72 <= args.dpi <= 600:
        parser.error("--dpi must be between 72 and 600")
    try:
        pages = render(args.input, args.output_dir, args.dpi, args.keep_pdf)
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile, subprocess.TimeoutExpired) as error:
        parser.error(str(error))
    for page in pages:
        print(page)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
