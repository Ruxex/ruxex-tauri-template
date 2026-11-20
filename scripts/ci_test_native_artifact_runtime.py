#!/usr/bin/env python3
"""Build and exercise the managed runtime with this CI host's native renderers.

This verifies the platform-specific copy and launch path. It is not a release
input generator: the CI-only license notice is intentionally not suitable for
redistribution.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / "scripts/build_artifact_runtime.py"
SPEC = importlib.util.spec_from_file_location("build_artifact_runtime", BUILDER_PATH)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)
STAGER_PATH = ROOT / "scripts/stage-ruxex-package.py"
STAGER_SPEC = importlib.util.spec_from_file_location("stage_ruxex_package", STAGER_PATH)
assert STAGER_SPEC and STAGER_SPEC.loader
STAGER = importlib.util.module_from_spec(STAGER_SPEC)
STAGER_SPEC.loader.exec_module(STAGER)


def executable(name: str) -> Path:
    resolved = shutil.which(name)
    if not resolved:
        raise RuntimeError(f"CI host is missing required executable: {name}")
    return Path(resolved).resolve(strict=True)


def command_version(command: list[str]) -> str:
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    output = f"{result.stdout}\n{result.stderr}"
    match = re.search(r"\b(\d+\.\d+(?:\.\d+){0,2})\b", output)
    if not match:
        raise RuntimeError(f"could not read a version from {' '.join(command)}")
    return match.group(1)


def copy_library(source: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    resolved = source.resolve(strict=True)
    target = destination / source.name
    if target.exists():
        def digest(path: Path) -> bytes:
            value = hashlib.sha256()
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    value.update(chunk)
            return value.digest()

        if digest(target) != digest(resolved):
            raise RuntimeError(f"conflicting native library with the same name: {source.name}")
        return
    shutil.copy2(resolved, target)


def copy_linux_shared_dependencies(binaries: tuple[Path, ...], destination: Path) -> None:
    system_libraries = (
        "libc.so", "libm.so", "libpthread.so", "libdl.so", "librt.so",
        "libresolv.so", "libutil.so", "libnss_", "ld-linux", "linux-vdso",
    )
    library_dir = destination / "lib"
    for binary in binaries:
        result = subprocess.run(["ldd", str(binary)], capture_output=True, text=True, check=True)
        for line in result.stdout.splitlines():
            if "not found" in line:
                raise RuntimeError(f"unresolved native dependency for {binary}: {line.strip()}")
            match = re.search(r"(?:=>\s+|^\s*)(/[^\s(]+)\s*(?:\(|$)", line)
            if not match:
                continue
            source = Path(match.group(1))
            if any(token in source.name for token in system_libraries):
                continue
            copy_library(source, library_dir)


def copy_homebrew_poppler_dependencies(brew: str, destination: Path) -> None:
    formulas = subprocess.check_output(
        [brew, "deps", "--installed", "--recursive", "poppler"], text=True
    ).splitlines()
    library_dir = destination / "lib"
    for formula in ("poppler", *formulas):
        prefix = Path(subprocess.check_output([brew, "--prefix", formula], text=True).strip())
        source_dir = prefix / "lib"
        if not source_dir.is_dir():
            continue
        for source in source_dir.iterdir():
            if source.is_file() and (".dylib" in source.name or source.suffix == ".so"):
                copy_library(source, library_dir)


def validate_linux_dependency_closure(
    runtime_root: Path,
    native_relative_root: str,
    binary_paths: tuple[Path, ...],
) -> None:
    native_root = runtime_root / native_relative_root
    system_libraries = (
        "libc.so", "libm.so", "libpthread.so", "libdl.so", "librt.so",
        "libresolv.so", "libutil.so", "libnss_", "ld-linux", "linux-vdso",
    )
    library_directories = BUILDER.shared_library_directories(native_root)
    environment = os.environ.copy()
    environment.pop("LD_LIBRARY_PATH", None)
    environment["LD_LIBRARY_PATH"] = ":".join(
        str(native_root / directory) for directory in library_directories
    )
    for executable_path in binary_paths:
        result = subprocess.run(
            ["ldd", str(executable_path)],
            capture_output=True,
            text=True,
            env=environment,
            check=True,
        )
        for line in result.stdout.splitlines():
            if "not found" in line:
                raise RuntimeError(f"unresolved bundled native dependency: {line.strip()}")
            match = re.search(r"(?:=>\s+|^\s*)(/[^\s(]+)\s*(?:\(|$)", line)
            if not match:
                continue
            loaded = Path(match.group(1)).resolve()
            library_name = loaded.name
            if any(token in library_name for token in system_libraries):
                continue
            if not loaded.is_relative_to(native_root.resolve()):
                raise RuntimeError(
                    f"Native dependency resolves outside {native_relative_root}: {loaded}"
                )


def validate_macos_dependency_closure(
    runtime_root: Path,
    native_relative_root: str,
    commands: tuple[tuple[Path, tuple[str, ...]], ...],
) -> None:
    native_root = (runtime_root / native_relative_root).resolve()
    library_directories = BUILDER.shared_library_directories(native_root)
    environment = os.environ.copy()
    environment.pop("DYLD_LIBRARY_PATH", None)
    environment["DYLD_LIBRARY_PATH"] = ":".join(
        str(native_root / directory) for directory in library_directories
    )
    environment["DYLD_PRINT_LIBRARIES"] = "1"
    environment["RUXEX_RUNTIME_ROOT"] = str(runtime_root)
    bundled_library_loaded = False
    for executable_path, arguments in commands:
        result = subprocess.run(
            [str(executable_path), *arguments],
            capture_output=True,
            text=True,
            env=environment,
        )
        if result.returncode:
            raise RuntimeError(
                f"packaged native command {executable_path.name} failed to start: "
                f"{result.stderr.strip()}"
            )
        for loaded in parse_macos_dyld_loaded_images(result.stderr):
            resolved = loaded.resolve()
            if resolved.is_relative_to(native_root):
                if ".dylib" in resolved.name or ".framework/" in str(resolved):
                    bundled_library_loaded = True
                continue
            if is_macos_system_library(resolved):
                continue
            raise RuntimeError(
                f"{native_relative_root} dependency resolves outside the packaged runtime: "
                f"{resolved}"
            )
    if not bundled_library_loaded:
        raise RuntimeError(
            f"macOS dyld diagnostics did not show {native_relative_root} loading a bundled library"
        )


def parse_macos_dyld_loaded_images(output: str) -> list[Path]:
    loaded_images = []
    for line in output.splitlines():
        match = re.match(r"^\s*(?:dyld\[\d+\]:\s*)?<[^>]+>\s+(.+?)\s*$", line)
        if match:
            image = Path(match.group(1).strip())
            if image.is_absolute():
                loaded_images.append(image)
    return loaded_images


def is_macos_system_library(path: Path) -> bool:
    return str(path).startswith((
        "/System/Library/",
        "/usr/lib/",
        "/System/Cryptexes/",
        "/System/Volumes/Preboot/Cryptexes/OS/",
    ))


def validate_assembled_runtime(runtime_root: Path) -> None:
    target = BUILDER.target_triple()
    STAGER.validate_artifact_runtime(runtime_root, target)
    manifest = json.loads(
        (runtime_root / "runtime-manifest.json").read_text(encoding="utf-8")
    )
    if sys.platform == "linux":
        office_root = runtime_root / "native/libreoffice"
        office_binaries = tuple(
            path
            for path in office_root.rglob("soffice.bin")
            if path.is_file() and os.access(path, os.X_OK)
        )
        if len(office_binaries) != 1:
            raise RuntimeError(
                f"expected one bundled LibreOffice binary, found {len(office_binaries)}"
            )
        validate_linux_dependency_closure(
            runtime_root, "native/libreoffice", office_binaries
        )
        validate_linux_dependency_closure(
            runtime_root,
            "native/poppler",
            tuple(
                runtime_root / manifest["executables"][name]
                for name in ("pdfinfo", "pdftoppm")
            ),
        )
    elif sys.platform == "darwin":
        validate_macos_dependency_closure(
            runtime_root,
            "native/poppler",
            tuple(
                (runtime_root / manifest["executables"][name], ("-v",))
                for name in ("pdfinfo", "pdftoppm")
            ),
        )
        validate_macos_dependency_closure(
            runtime_root,
            "native/libreoffice",
            ((runtime_root / "bin/override/soffice", ("--version",)),),
        )
    else:
        raise RuntimeError(f"unsupported native runtime validation host: {sys.platform}")

    native = manifest["native"]
    print(
        f"Validated {target} with LibreOffice {native['libreofficeVersion']} "
        f"and Poppler {native['popplerVersion']}"
    )


def stage_native_inputs(native: Path) -> tuple[str, str]:
    system = sys.platform
    native.mkdir(parents=True)
    for name in ("soffice", "pdfinfo", "pdftoppm"):
        executable(name)

    if system == "darwin":
        app = Path("/Applications/LibreOffice.app")
        soffice = app / "Contents/MacOS/soffice"
        if not soffice.is_file():
            raise RuntimeError(f"LibreOffice app bundle is missing: {soffice}")
        shutil.copytree(app, native / "libreoffice/LibreOffice.app")
        soffice_in_bundle = native / "libreoffice/LibreOffice.app/Contents/MacOS/soffice"

        brew = shutil.which("brew")
        if not brew:
            raise RuntimeError("Homebrew is required on macOS CI")
        poppler_prefix = Path(subprocess.check_output(
            [brew, "--prefix", "poppler"], text=True
        ).strip())
        shutil.copytree(poppler_prefix / "bin", native / "poppler/bin")
        copy_homebrew_poppler_dependencies(brew, native / "poppler")
        pdfinfo = native / "poppler/bin/pdfinfo"
        pdftoppm = native / "poppler/bin/pdftoppm"
    elif system == "linux":
        soffice_source = executable("soffice")
        libreoffice_root = next(
            (parent for parent in soffice_source.parents if parent.name == "libreoffice"),
            None,
        )
        if libreoffice_root is None:
            raise RuntimeError(f"cannot locate LibreOffice tree from {soffice_source}")
        shutil.copytree(libreoffice_root, native / "libreoffice")
        soffice_in_bundle = native / "libreoffice" / soffice_source.relative_to(libreoffice_root)
        office_binaries = tuple(
            path
            for path in (native / "libreoffice").rglob("soffice.bin")
            if path.is_file() and os.access(path, os.X_OK)
        )
        if len(office_binaries) != 1:
            raise RuntimeError(
                f"expected one LibreOffice binary in the host tree, found {len(office_binaries)}"
            )
        copy_linux_shared_dependencies(office_binaries, native / "libreoffice")
        for name in ("pdfinfo", "pdftoppm"):
            source = executable(name)
            destination = native / "poppler/bin" / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            destination.chmod(destination.stat().st_mode | 0o111)
        copy_linux_shared_dependencies(
            (native / "poppler/bin/pdfinfo", native / "poppler/bin/pdftoppm"),
            native / "poppler",
        )
        pdfinfo = native / "poppler/bin/pdfinfo"
        pdftoppm = native / "poppler/bin/pdftoppm"
    else:
        raise RuntimeError(f"unsupported CI host: {system}")

    notices = native / "licenses/THIRD_PARTY_NOTICES.md"
    notices.parent.mkdir(parents=True)
    notices.write_text(
        "CI-only validation fixture. This file is not a redistribution notice.\n",
        encoding="utf-8",
    )
    libreoffice_version = command_version([str(soffice_in_bundle), "--version"])
    poppler_version = command_version([str(pdfinfo), "-v"])
    manifest = {
        "schemaVersion": 1,
        "target": BUILDER.target_triple(),
        "libreofficeVersion": libreoffice_version,
        "popplerVersion": poppler_version,
    }
    (native / "runtime-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    return libreoffice_version, poppler_version


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--validate-existing-runtime",
        action="store_true",
        help="validate native dependency closure in an already assembled runtime",
    )
    args = parser.parse_args()

    if args.validate_existing_runtime:
        validate_assembled_runtime(args.output.resolve())
        return

    with tempfile.TemporaryDirectory(prefix="ruxex-native-runtime-ci-") as temporary:
        temp = Path(temporary)
        native = temp / "native-input"
        libreoffice_version, poppler_version = stage_native_inputs(native)
        node_path = executable("node")
        assembled = args.output.resolve()
        BUILDER.assemble(argparse.Namespace(
            target=BUILDER.target_triple(),
            output=assembled,
            node_runtime=node_path.parent.parent,
            native_runtime=native,
            uv=Path(shutil.which("uv") or "uv"),
            libreoffice_version=libreoffice_version,
            poppler_version=poppler_version,
        ))
        validate_assembled_runtime(assembled)
        environment = os.environ.copy()
        environment["RUXEX_RUNTIME_ROOT"] = str(assembled)
        environment["RUXEX_RUNTIME_BIN_DIR"] = str(assembled / "bin/override")
        environment.pop("LD_LIBRARY_PATH", None)
        environment.pop("DYLD_LIBRARY_PATH", None)
        runtime_path = temp / "system-utilities"
        runtime_path.mkdir()
        for name in (
            "basename", "cat", "dirname", "env", "expr", "fc-cache", "fc-list",
            "fc-match", "fc-pattern", "fc-query", "fc-scan", "grep", "ldconfig",
            "mkdir", "mktemp", "readlink", "rm", "sed", "tr", "uname", "which",
        ):
            source = shutil.which(name)
            if source:
                (runtime_path / name).symlink_to(Path(source).resolve())
        environment["RUXEX_TEST_PATH"] = str(runtime_path)
        subprocess.run(
            [str(executable("make")), "rust-test-docx-render-integration"],
            cwd=ROOT,
            env=environment,
            check=True,
        )


if __name__ == "__main__":
    main()
