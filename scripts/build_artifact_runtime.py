#!/usr/bin/env python3
"""Assemble the locked Python and native runtime used by local artifact Skills."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1] / "runtime/python"
REQUIRED_PACKAGES = ("lxml", "numpy", "Pillow", "pdf2image", "python-pptx")


def target_triple() -> str:
    machine = platform.machine()
    arch = {"AMD64": "x86_64", "aarch64": "aarch64", "arm64": "aarch64"}.get(
        machine, machine
    )
    if sys.platform == "darwin":
        return f"{arch}-apple-darwin"
    if sys.platform == "linux":
        libc = platform.libc_ver()[0]
        suffix = "unknown-linux-musl" if libc == "musl" else "unknown-linux-gnu"
        return f"{arch}-{suffix}"
    raise SystemExit(f"unsupported artifact runtime platform: {sys.platform}/{machine}")


def discover_native_tools(native_root: Path) -> dict[str, str]:
    required = {
        "soffice": native_root / "libreoffice",
        "pdfinfo": native_root / "poppler",
        "pdftoppm": native_root / "poppler",
    }
    found: dict[str, str] = {}
    for name, search_root in required.items():
        matches = sorted(
            path
            for path in search_root.rglob(name)
            if path.is_file() and os.access(path, os.X_OK)
        ) if search_root.is_dir() else []
        if len(matches) != 1:
            raise ValueError(
                f"expected one executable {name} under {search_root}, found {len(matches)}"
            )
        found[name] = matches[0].relative_to(native_root).as_posix()
    return found


def validate_native_manifest(
    native_root: Path, target: str, libreoffice_version: str, poppler_version: str
) -> dict[str, object]:
    manifest_path = native_root / "runtime-manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"native runtime manifest is unavailable or invalid: {manifest_path}") from error
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1:
        raise ValueError("native runtime manifest has an unsupported schema")
    if manifest.get("target") != target:
        raise ValueError(
            f"native runtime target {manifest.get('target')!r} does not match {target!r}"
        )
    if manifest.get("libreofficeVersion") != libreoffice_version:
        raise ValueError("native runtime LibreOffice version does not match the release input")
    if manifest.get("popplerVersion") != poppler_version:
        raise ValueError("native runtime Poppler version does not match the release input")
    return manifest


def run(command: list[str], *, cwd: Path | None = None) -> str:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True)
    if result.returncode:
        detail = (result.stderr or result.stdout).strip()
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(command)}\n{detail}")
    return result.stdout.strip()


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hash_tree(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(
        (item for item in root.rglob("*") if item.is_file()),
        key=lambda item: item.relative_to(root).as_posix(),
    ):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(stat.S_IMODE(path.stat().st_mode).to_bytes(2, "big"))
        digest.update(bytes.fromhex(hash_file(path)))
        digest.update(b"\0")
    return digest.hexdigest()


def shared_library_directories(root: Path) -> list[str]:
    directories = {
        item.parent
        for item in root.rglob("*")
        if item.is_file()
        and (".so" in item.name or item.suffix == ".dylib")
    }
    return sorted(directory.relative_to(root).as_posix() for directory in directories)


def write_wrapper(
    path: Path,
    runtime_relative_path: str,
    *,
    loader_variable: str | None = None,
    library_root: str = "native/poppler",
    library_directories: tuple[str, ...] = (),
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    loader_setup = ""
    if loader_variable:
        if library_directories:
            bundled_paths = ":".join(
                f"$RUXEX_RUNTIME_ROOT/{library_root}/{directory}"
                for directory in library_directories
            )
            loader_setup = f'export {loader_variable}="{bundled_paths}"\n'
        else:
            loader_setup = f"unset {loader_variable}\n"
    path.write_text(
        "#!/bin/sh\n"
        "set -eu\n"
        ': "${RUXEX_RUNTIME_ROOT:?RUXEX_RUNTIME_ROOT is required}"\n'
        f"{loader_setup}"
        f'exec "$RUXEX_RUNTIME_ROOT/{runtime_relative_path}" "$@"\n',
        encoding="utf-8",
    )
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def locate_python_install(install_dir: Path, version: str) -> Path:
    executable_name = f"python{version.rsplit('.', 1)[0]}"
    candidates = sorted(
        path
        for path in install_dir.rglob(executable_name)
        if path.is_file() and os.access(path, os.X_OK) and path.parent.name == "bin"
    )
    if len(candidates) != 1:
        raise RuntimeError(
            f"expected one managed Python executable named {executable_name}, found {len(candidates)}"
        )
    return candidates[0].parent.parent


def package_versions(python: Path) -> dict[str, str]:
    code = (
        "import importlib, importlib.metadata as m, json; "
        "modules = {'lxml': 'lxml.etree', 'numpy': 'numpy', 'Pillow': 'PIL', "
        "'pdf2image': 'pdf2image', 'python-pptx': 'pptx'}; "
        "[importlib.import_module(module) for module in modules.values()]; "
        "print(json.dumps({name: m.version(name) for name in modules}, sort_keys=True))"
    )
    values = json.loads(run([str(python), "-c", code]))
    return values


def validate_executable_version(
    executable: Path,
    arguments: tuple[str, ...],
    expected_version: str,
    runtime_root: Path,
) -> None:
    environment = os.environ.copy()
    environment["RUXEX_RUNTIME_ROOT"] = str(runtime_root)
    result = subprocess.run(
        [str(executable), *arguments],
        capture_output=True,
        text=True,
        env=environment,
    )
    if result.returncode:
        raise RuntimeError(
            f"could not query packaged {executable.name} version: "
            f"{(result.stderr or result.stdout).strip()}"
        )
    match = re.search(r"\b(\d+\.\d+(?:\.\d+){0,2})\b", f"{result.stdout}\n{result.stderr}")
    if not match:
        raise RuntimeError(f"could not read a version from packaged {executable.name}")
    if match.group(1) != expected_version:
        raise RuntimeError(
            f"expected native tool version {expected_version}, got {match.group(1)} "
            f"from {executable.name}"
        )


def assemble(args: argparse.Namespace) -> Path:
    target = args.target
    if target != target_triple():
        raise SystemExit(
            f"runtime assembly must run natively for {target}; this host is {target_triple()}"
        )
    python_version = (PROJECT / ".python-version").read_text(encoding="utf-8").strip()
    uv_version = (PROJECT / ".uv-version").read_text(encoding="utf-8").strip()
    actual_uv = run([str(args.uv), "--version"]).split()
    if len(actual_uv) < 2 or actual_uv[1] != uv_version:
        raise SystemExit(f"expected uv {uv_version}, got {' '.join(actual_uv)}")
    run([str(args.uv), "lock", "--check"], cwd=PROJECT)

    node = args.node_runtime / "bin/node"
    if not node.is_file() or not os.access(node, os.X_OK):
        raise SystemExit(f"bundled Node.js executable is missing or not executable: {node}")
    node_version = run([str(node), "--version"])
    if not re.fullmatch(r"v\d+\.\d+\.\d+", node_version):
        raise SystemExit(f"unexpected Node.js version output: {node_version!r}")

    native_manifest = validate_native_manifest(
        args.native_runtime, target, args.libreoffice_version, args.poppler_version
    )
    native_tools = discover_native_tools(args.native_runtime)
    notices = args.native_runtime / "licenses/THIRD_PARTY_NOTICES.md"
    if not notices.is_file():
        raise SystemExit(f"third-party notices are required: {notices}")

    output = args.output.resolve()
    if output == Path(output.anchor):
        raise SystemExit("refusing to assemble into the filesystem root")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    with tempfile.TemporaryDirectory(prefix="ruxex-artifact-runtime-") as temporary:
        temporary_root = Path(temporary)
        python_install = temporary_root / "python-install"
        run(
            [
                str(args.uv),
                "python",
                "install",
                "--install-dir",
                str(python_install),
                "--no-bin",
                python_version,
            ],
            cwd=PROJECT,
        )
        installed_home = locate_python_install(python_install, python_version)
        python_root = output / "python"
        shutil.copytree(installed_home, python_root)
        python_executable = python_root / "bin" / f"python{python_version.rsplit('.', 1)[0]}"
        if not python_executable.is_file():
            raise RuntimeError(f"managed Python executable is missing: {python_executable}")
        (python_root / "bin/python3").write_text(
            "#!/bin/sh\nset -eu\n"
            'HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\n'
            f'exec "$HERE/python{python_version.rsplit(".", 1)[0]}" -B "$@"\n',
            encoding="utf-8",
        )
        (python_root / "bin/python3").chmod(0o755)

        requirements = temporary_root / "requirements.txt"
        run(
            [
                str(args.uv),
                "export",
                "--locked",
                "--no-dev",
                "--no-emit-project",
                "--format",
                "requirements.txt",
                "--output-file",
                str(requirements),
            ],
            cwd=PROJECT,
        )
        site_packages = python_root / "lib" / f"python{python_version.rsplit('.', 1)[0]}" / "site-packages"
        run(
            [
                str(args.uv),
                "pip",
                "sync",
                "--python",
                str(python_executable),
                "--target",
                str(site_packages),
                str(requirements),
            ],
            cwd=PROJECT,
        )
        versions = package_versions(python_executable)
        if set(versions) != set(REQUIRED_PACKAGES):
            raise RuntimeError("assembled Python runtime did not import every required package")

    native_root = output / "native"
    shutil.copytree(args.native_runtime / "libreoffice", native_root / "libreoffice")
    shutil.copytree(args.native_runtime / "poppler", native_root / "poppler")
    shutil.copytree(args.native_runtime / "licenses", output / "licenses")
    libreoffice_library_dirs = tuple(
        shared_library_directories(native_root / "libreoffice")
    )
    poppler_library_dirs = tuple(shared_library_directories(native_root / "poppler"))
    loader_variable = (
        "DYLD_LIBRARY_PATH" if target.endswith("apple-darwin") else "LD_LIBRARY_PATH"
    )

    executables = {
        "python": "python/bin/python3",
        **{
            name: f"native/{relative}"
            for name, relative in native_tools.items()
        },
    }
    for name in ("soffice", "pdfinfo", "pdftoppm"):
        write_wrapper(
            output / f"bin/override/{name}",
            executables[name],
            loader_variable=loader_variable,
            library_root=(
                "native/libreoffice" if name == "soffice" else "native/poppler"
            ),
            library_directories=(
                libreoffice_library_dirs
                if name == "soffice"
                else poppler_library_dirs
            ),
        )

    validate_executable_version(
        output / "bin/override/soffice",
        ("--version",),
        args.libreoffice_version,
        output,
    )
    validate_executable_version(
        output / "bin/override/pdfinfo",
        ("-v",),
        args.poppler_version,
        output,
    )
    validate_executable_version(
        output / "bin/override/pdftoppm",
        ("-v",),
        args.poppler_version,
        output,
    )

    manifest = {
        "schemaVersion": 1,
        "target": target,
        "uvVersion": uv_version,
        "pythonVersion": python_version,
        "nodeVersion": node_version.removeprefix("v"),
        "pythonPackages": versions,
        "native": {
            "libreofficeVersion": args.libreoffice_version,
            "popplerVersion": args.poppler_version,
        },
        "executables": executables,
        "licenseNotices": "licenses/THIRD_PARTY_NOTICES.md",
        "inputs": {
            "nativeThirdPartyNoticesSha256": hash_file(notices),
            "nativeRuntimeManifestSha256": hash_file(
                args.native_runtime / "runtime-manifest.json"
            ),
            "pythonLockSha256": hash_file(PROJECT / "uv.lock"),
            "pythonRuntimeSha256": hash_tree(python_root),
            "libreOfficeRuntimeSha256": hash_tree(native_root / "libreoffice"),
            "popplerRuntimeSha256": hash_tree(native_root / "poppler"),
            "overrideRuntimeSha256": hash_tree(output / "bin/override"),
            "licenseRuntimeSha256": hash_tree(output / "licenses"),
        },
        "nativeSource": native_manifest,
    }
    manifest_path = output / "runtime-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--node-runtime", type=Path, required=True)
    parser.add_argument("--native-runtime", type=Path, required=True)
    parser.add_argument("--uv", type=Path, default=Path(shutil.which("uv") or "uv"))
    parser.add_argument("--target", default=target_triple())
    parser.add_argument("--libreoffice-version", required=True)
    parser.add_argument("--poppler-version", required=True)
    args = parser.parse_args()
    try:
        print(assemble(args))
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
