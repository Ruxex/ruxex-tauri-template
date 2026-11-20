#!/usr/bin/env python3
"""Generate and inspect office artifacts using only the staged runtime."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import zipfile


ROOT = Path(__file__).resolve().parents[1]
SMOKE_BUILDER = ROOT / "artifact-tool/tests/fixtures/smoke-builder.mjs"
ARTIFACT_ENTRIES = {
    "smoke.docx": "word/document.xml",
    "smoke.pptx": "ppt/slides/slide1.xml",
    "smoke.xlsx": "xl/workbook.xml",
}


def run(command: list[str], *, env: dict[str, str], label: str) -> str:
    result = subprocess.run(command, capture_output=True, text=True, env=env)
    if result.returncode:
        raise RuntimeError(
            f"{label} failed ({result.returncode}): {' '.join(command)}\n"
            f"{result.stdout}\n{result.stderr}"
        )
    return result.stdout + result.stderr


def validate_artifact_files(output: Path) -> None:
    for filename, required_entry in ARTIFACT_ENTRIES.items():
        path = output / filename
        if not path.is_file() or path.stat().st_size == 0:
            raise RuntimeError(f"artifact is missing or empty: {filename}")
        try:
            with zipfile.ZipFile(path) as archive:
                if required_entry not in archive.namelist():
                    raise RuntimeError(f"{filename} is missing {required_entry}")
                corrupt_entry = archive.testzip()
                if corrupt_entry:
                    raise RuntimeError(f"{filename} has a corrupt ZIP entry: {corrupt_entry}")
        except zipfile.BadZipFile as error:
            raise RuntimeError(f"{filename} is not a valid Office ZIP package") from error

    pdf = output / "smoke.pdf"
    if not pdf.is_file() or not pdf.read_bytes().startswith(b"%PDF-"):
        raise RuntimeError("smoke.pdf is missing or has an invalid PDF signature")
    png = output / "smoke-sharp.png"
    if not png.is_file() or not png.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError("smoke-sharp.png is missing or has an invalid PNG signature")


def validate_pdf_and_render(
    pdf: Path, prefix: Path, *, pdfinfo: Path, pdftoppm: Path, env: dict[str, str]
) -> None:
    details = run([str(pdfinfo), str(pdf)], env=env, label="bundled pdfinfo")
    pages = next(
        (line.split(":", 1)[1].strip() for line in details.splitlines() if line.startswith("Pages:")),
        None,
    )
    if pages is None or not pages.isdigit() or int(pages) < 1:
        raise RuntimeError(f"PDF has no readable pages: {pdf}")
    run(
        [str(pdftoppm), "-singlefile", "-png", "-r", "72", "-f", "1", "-l", "1", str(pdf), str(prefix)],
        env=env,
        label="bundled pdftoppm",
    )
    rendered = prefix.with_suffix(".png")
    if (
        not rendered.is_file()
        or rendered.stat().st_size < 128
        or not rendered.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    ):
        raise RuntimeError(f"Poppler did not produce a valid page image for {pdf}")


def copy_file(source: Path, destination: Path, *, executable: bool = False) -> None:
    if not source.is_file():
        raise RuntimeError(f"required runtime input is missing: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source.resolve(), destination)
    if executable:
        destination.chmod(destination.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def hardlink_or_copy(source: str, destination: str) -> str:
    try:
        os.link(source, destination)
        return destination
    except OSError:
        return shutil.copy2(source, destination)


def prepare_runtime(
    root: Path,
    *,
    node: Path,
    node_modules: Path,
    sdk: Path,
    native_runtime: Path,
    artifact_cli: Path,
    artifact_engine: Path,
) -> Path:
    resources = root / "ruxex-resources"
    copy_file(node, resources / "node/bin/node", executable=True)
    (resources / "node").mkdir(parents=True, exist_ok=True)
    # Materialize the exact locked pnpm tree in the staged runtime while
    # hard-linking package files to avoid duplicating the large CI install.
    shutil.copytree(
        node_modules,
        resources / "node/node_modules",
        symlinks=True,
        copy_function=hardlink_or_copy,
    )
    shutil.copytree(sdk, resources / "ruxex-artifact-tool")
    for name in ("bin", "native", "licenses"):
        shutil.copytree(native_runtime / name, resources / name)
    shutil.copy2(native_runtime / "runtime-manifest.json", resources / "runtime-manifest.json")
    copy_file(artifact_cli, root / "ruxex-path/ruxex-artifacts", executable=True)
    copy_file(artifact_engine, root / "ruxex-path/ruxex-artifacts-engine", executable=True)
    return resources


def exercise_runtime(args: argparse.Namespace) -> None:
    with tempfile.TemporaryDirectory(prefix="ruxex-bundled-artifact-e2e-") as temporary:
        root = Path(temporary) / "package"
        resources = prepare_runtime(
            root,
            node=args.node.resolve(strict=True),
            node_modules=args.node_modules.resolve(strict=True),
            sdk=args.artifact_sdk.resolve(strict=True),
            native_runtime=args.native_runtime.resolve(strict=True),
            artifact_cli=args.artifact_cli.resolve(strict=True),
            artifact_engine=args.artifact_engine.resolve(strict=True),
        )
        manifest = json.loads((resources / "runtime-manifest.json").read_text(encoding="utf-8"))
        bundled_node_version = run(
            [str(resources / "node/bin/node"), "--version"],
            env=os.environ.copy(),
            label="bundled Node.js",
        ).strip().removeprefix("v")
        if bundled_node_version != manifest["nodeVersion"]:
            raise RuntimeError(
                f"staged Node.js version {bundled_node_version} does not match "
                f"runtime manifest {manifest['nodeVersion']}"
            )
        output = Path(temporary) / "artifacts"
        output.mkdir()
        env = os.environ.copy()
        env["RUXEX_ARTIFACT_PACKAGE_ROOT"] = str(root)
        env["RUXEX_RUNTIME_ROOT"] = str(resources)
        env["RUXEX_RUNTIME_NODE"] = str(resources / "node/bin/node")
        env["RUXEX_RUNTIME_NODE_MODULES"] = str(resources / "node/node_modules")
        env["RUXEX_RUNTIME_BIN_DIR"] = str(resources / "bin/override")
        env["RUXEX_RUNTIME_NATIVE_ROOT"] = str(resources / "native")
        env.pop("RUXEX_RUNTIME_PYTHON", None)
        run(
            [
                str(root / "ruxex-path/ruxex-artifacts"),
                "run",
                str(SMOKE_BUILDER),
                "--output-dir",
                str(output),
            ],
            env=env,
            label="bundled artifact builder",
        )
        validate_artifact_files(output)

        rendered = Path(temporary) / "rendered"
        rendered.mkdir()
        pdfinfo = resources / manifest["executables"]["pdfinfo"]
        pdftoppm = resources / manifest["executables"]["pdftoppm"]
        soffice = resources / "bin/override/soffice"
        office_files = [output / name for name in ARTIFACT_ENTRIES]
        pdf_files = [output / "smoke.pdf"]
        for index, office_file in enumerate(office_files):
            office_output = rendered / f"office-{index}"
            office_output.mkdir()
            profile = rendered / f"profile-{index}"
            run(
                [
                    str(soffice),
                    "--headless",
                    f"-env:UserInstallation={profile.as_uri()}",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(office_output),
                    str(office_file),
                ],
                env=env,
                label=f"bundled LibreOffice rendering of {office_file.name}",
            )
            converted = office_output / f"{office_file.stem}.pdf"
            if not converted.is_file():
                raise RuntimeError(f"LibreOffice did not create a PDF for {office_file.name}")
            pdf_files.append(converted)

        for index, pdf in enumerate(pdf_files):
            validate_pdf_and_render(
                pdf,
                rendered / f"page-{index}",
                pdfinfo=pdfinfo,
                pdftoppm=pdftoppm,
                env=env,
            )
        print(
            f"Generated and inspected DOCX, PPTX, XLSX, PDF, and sharp PNG using "
            f"the staged runtime ({manifest['target']}); rendered 4 PDFs with bundled tools."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", type=Path, required=True)
    parser.add_argument("--node-modules", type=Path, required=True)
    parser.add_argument("--artifact-sdk", type=Path, required=True)
    parser.add_argument("--native-runtime", type=Path, required=True)
    parser.add_argument("--artifact-cli", type=Path, required=True)
    parser.add_argument("--artifact-engine", type=Path, required=True)
    args = parser.parse_args()
    exercise_runtime(args)


if __name__ == "__main__":
    main()
