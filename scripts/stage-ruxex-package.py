#!/usr/bin/env python3
"""Stage the complete local Ruxex runtime package consumed by the daemon."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import stat
import subprocess
import sys
from pathlib import Path


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
    raise SystemExit(f"unsupported desktop runtime platform: {sys.platform}/{machine}")


def require_file(path: Path, label: str) -> Path:
    if not path.is_file():
        raise SystemExit(f"missing {label}: {path}")
    return path


def copy_executable(source: Path, destination: Path) -> None:
    require_file(source, destination.as_posix())
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    destination.chmod(destination.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def copy_directory(source: Path, destination: Path) -> None:
    if not source.is_dir():
        raise SystemExit(f"missing directory: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination)


def directory_sha256(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(
        (item for item in root.rglob("*") if item.is_file()),
        key=lambda item: item.relative_to(root).as_posix(),
    ):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(stat.S_IMODE(path.stat().st_mode).to_bytes(2, "big"))
        file_digest = hashlib.sha256()
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                file_digest.update(chunk)
        digest.update(file_digest.digest())
        digest.update(b"\0")
    return digest.hexdigest()


def validate_tree_hash(root: Path, expected: object, label: str) -> None:
    if not isinstance(expected, str) or len(expected) != 64:
        raise SystemExit(f"artifact runtime manifest is missing {label} SHA-256")
    actual = directory_sha256(root)
    if actual != expected:
        raise SystemExit(f"artifact runtime {label} hash does not match its manifest")


def validate_artifact_runtime(
    root: Path, target: str, *, require_bundled_inputs: bool = False
) -> None:
    required_files = (
        "python/bin/python3",
        "bin/override/soffice",
        "bin/override/pdftoppm",
        "bin/override/pdfinfo",
        "licenses/THIRD_PARTY_NOTICES.md",
        "runtime-manifest.json",
    )
    for relative in required_files:
        path = root / relative
        if not path.is_file():
            raise SystemExit(f"artifact runtime is missing {relative}")
    try:
        manifest = json.loads((root / "runtime-manifest.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"invalid artifact runtime manifest: {error}") from error
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1:
        raise SystemExit("artifact runtime manifest has an unsupported schema")
    if manifest.get("target") != target:
        raise SystemExit(
            f"artifact runtime target {manifest.get('target')!r} does not match {target!r}"
        )
    for key in ("pythonVersion", "nodeVersion"):
        if not isinstance(manifest.get(key), str) or not manifest[key].strip():
            raise SystemExit(f"artifact runtime manifest is missing {key}")
    if not isinstance(manifest.get("uvVersion"), str) or not manifest["uvVersion"].strip():
        raise SystemExit("artifact runtime manifest is missing uvVersion")
    native = manifest.get("native")
    if not isinstance(native, dict) or any(
        not isinstance(native.get(key), str) or not native[key].strip()
        for key in ("libreofficeVersion", "popplerVersion")
    ):
        raise SystemExit("artifact runtime manifest is missing native tool versions")
    native_source = manifest.get("nativeSource")
    if not isinstance(native_source, dict) or any(
        native_source.get(key) != value
        for key, value in (
            ("target", target),
            ("libreofficeVersion", native["libreofficeVersion"]),
            ("popplerVersion", native["popplerVersion"]),
        )
    ):
        raise SystemExit("artifact runtime source manifest does not match the assembled runtime")
    python_packages = manifest.get("pythonPackages")
    if not isinstance(python_packages, dict) or any(
        not isinstance(python_packages.get(name), str) or not python_packages[name].strip()
        for name in ("lxml", "numpy", "Pillow", "pdf2image", "python-pptx")
    ):
        raise SystemExit("artifact runtime manifest is missing locked Python package versions")
    python_probe = (
        "import importlib, importlib.metadata as metadata, json, sys; "
        "modules = {'lxml': 'lxml.etree', 'numpy': 'numpy', 'Pillow': 'PIL', "
        "'pdf2image': 'pdf2image', 'python-pptx': 'pptx'}; "
        "[importlib.import_module(module) for module in modules.values()]; "
        "print(json.dumps({'pythonVersion': '.'.join(map(str, sys.version_info[:3])), "
        "'pythonPackages': {name: metadata.version(name) for name in modules}}, sort_keys=True))"
    )
    try:
        python_result = subprocess.run(
            [str(root / "python/bin/python3"), "-c", python_probe],
            capture_output=True,
            text=True,
            check=True,
        )
        python_runtime = json.loads(python_result.stdout)
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        detail = getattr(error, "stderr", "") or str(error)
        raise SystemExit(f"bundled Python runtime failed its import/version check: {detail}") from error
    if python_runtime.get("pythonVersion") != manifest["pythonVersion"]:
        raise SystemExit(
            "bundled Python version does not match its runtime manifest: "
            f"{python_runtime.get('pythonVersion')!r} != {manifest['pythonVersion']!r}"
        )
    if python_runtime.get("pythonPackages") != python_packages:
        raise SystemExit("bundled Python package versions do not match the runtime manifest")
    executables = manifest.get("executables")
    expected_executables = {
        "python": "python/bin/python3",
        "soffice": None,
        "pdfinfo": None,
        "pdftoppm": None,
    }
    if not isinstance(executables, dict) or any(
        not isinstance(executables.get(name), str)
        or (relative is not None and executables[name] != relative)
        or (relative is None and not executables[name].startswith("native/"))
        for name, relative in expected_executables.items()
    ):
        raise SystemExit("artifact runtime manifest has unexpected executable paths")
    for name, relative in executables.items():
        if name not in expected_executables:
            continue
        executable_path = Path(relative)
        if executable_path.is_absolute() or ".." in executable_path.parts:
            raise SystemExit(f"artifact runtime executable path escapes the bundle: {relative}")
        executable = root / executable_path
        if not executable.is_file() or not executable.stat().st_mode & stat.S_IXUSR:
            raise SystemExit(f"artifact runtime executable is missing or not executable: {relative}")
    if manifest.get("licenseNotices") != "licenses/THIRD_PARTY_NOTICES.md":
        raise SystemExit("artifact runtime manifest is missing its third-party notice path")
    inputs = manifest.get("inputs")
    if not isinstance(inputs, dict):
        raise SystemExit("artifact runtime manifest is missing input hashes")
    for key, relative, label in (
        ("pythonRuntimeSha256", "python", "Python runtime"),
        ("libreOfficeRuntimeSha256", "native/libreoffice", "LibreOffice runtime"),
        ("popplerRuntimeSha256", "native/poppler", "Poppler runtime"),
        ("overrideRuntimeSha256", "bin/override", "native tool wrappers"),
        ("licenseRuntimeSha256", "licenses", "runtime licenses"),
    ):
        validate_tree_hash(root / relative, inputs.get(key), label)
    if require_bundled_inputs:
        bundled_inputs = manifest.get("bundledInputs")
        if not isinstance(bundled_inputs, dict):
            raise SystemExit("artifact runtime manifest is missing bundled input hashes")
        for key, relative, label in (
            ("nodeRuntimeSha256", "node", "Node.js runtime"),
            ("artifactSdkSha256", "ruxex-artifact-tool", "artifact SDK"),
        ):
            validate_tree_hash(root / relative, bundled_inputs.get(key), label)


def validate_node_runtime(root: Path, expected_version: str) -> None:
    node = root / "bin/node"
    if not node.is_file() or not node.stat().st_mode & stat.S_IXUSR:
        raise SystemExit(f"bundled Node.js executable is missing or not executable: {node}")
    try:
        result = subprocess.run([str(node), "--version"], capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"bundled Node.js executable could not be verified: {error}") from error
    if result.stdout.strip().removeprefix("v") != expected_version:
        raise SystemExit(
            f"bundled Node.js version {result.stdout.strip()!r} does not match runtime manifest {expected_version!r}"
        )


def validate_package(
    root: Path, version: str, target: str, desktop_host: bool = False
) -> None:
    required = [
        "ruxex-package.json",
        "bin/ruxex-code-mode-host",
        "ruxex-path/rg",
        "ruxex-path/ruxex-artifacts",
        "ruxex-path/ruxex-artifacts-engine",
        "ruxex-resources/node/bin/node",
        "ruxex-resources/python/bin/python3",
        "ruxex-resources/bin/override/soffice",
        "ruxex-resources/bin/override/pdftoppm",
        "ruxex-resources/bin/override/pdfinfo",
        "ruxex-resources/node/node_modules/docx/package.json",
        "ruxex-resources/node/node_modules/pptxgenjs/package.json",
        "ruxex-resources/node/node_modules/jszip/package.json",
        "ruxex-resources/node/node_modules/sharp/package.json",
        "ruxex-resources/node/node_modules/pdf-lib/package.json",
        "ruxex-resources/node/node_modules/jsonpath-plus/package.json",
        "ruxex-resources/python/bin/python3",
        "ruxex-resources/bin/override/soffice",
        "ruxex-resources/bin/override/pdftoppm",
        "ruxex-resources/bin/override/pdfinfo",
        "ruxex-resources/licenses/THIRD_PARTY_NOTICES.md",
        "ruxex-resources/runtime-manifest.json",
        "ruxex-resources/vendored/skills/RUNTIME.md",
        "ruxex-resources/vendored/skills/requirements-planning/SKILL.md",
        "ruxex-resources/vendored/skills/requirements-planning/agents/ruxex.yaml",
        "ruxex-resources/ruxex-artifact-tool/src/loader.mjs",
        "ruxex-resources/ruxex-artifact-tool/src/runner.mjs",
        *[
            f"ruxex-resources/vendored/skills/{name}/{relative}"
            for name in ("documents", "presentations", "spreadsheets", "pdf")
            for relative in ("SKILL.md", "agents/ruxex.yaml", "ruxex-artifacts")
        ],
    ]
    if not desktop_host:
        required.append("bin/ruxex")
    if sys.platform == "linux":
        required.append("ruxex-resources/bwrap")
    executable_files = {
        "bin/ruxex",
        "bin/ruxex-code-mode-host",
        "ruxex-path/rg",
        "ruxex-path/ruxex-artifacts",
        "ruxex-path/ruxex-artifacts-engine",
        "ruxex-resources/node/bin/node",
        "ruxex-resources/python/bin/python3",
        "ruxex-resources/bin/override/soffice",
        "ruxex-resources/bin/override/pdftoppm",
        "ruxex-resources/bin/override/pdfinfo",
        *[
            f"ruxex-resources/vendored/skills/{name}/ruxex-artifacts"
            for name in ("documents", "presentations", "spreadsheets", "pdf")
        ],
    }
    for relative in required:
        path = root / relative
        if not path.is_file():
            raise SystemExit(f"staged Ruxex package is missing {relative}")
        if relative in executable_files and not path.stat().st_mode & stat.S_IXUSR:
            raise SystemExit(f"staged Ruxex package file is not executable: {relative}")

    validate_artifact_runtime(
        root / "ruxex-resources", target, require_bundled_inputs=True
    )

    manifest = json.loads((root / "ruxex-package.json").read_text(encoding="utf-8"))
    entrypoint = "desktop-host" if desktop_host else "bin/ruxex"
    if manifest != {"version": version, "target": target, "entrypoint": entrypoint}:
        raise SystemExit(f"unexpected staged Ruxex package manifest: {manifest!r}")


def discover_tool(name: str) -> Path | None:
    path = shutil.which(name)
    return Path(path) if path is not None else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--ruxex-bin", type=Path)
    parser.add_argument(
        "--desktop-host",
        action="store_true",
        help="stage resources for a desktop host that embeds the Ruxex runtime",
    )
    parser.add_argument("--code-mode-host", type=Path, required=True)
    parser.add_argument("--rg", type=Path, default=discover_tool("rg"))
    parser.add_argument("--artifact-tools", type=Path, default=discover_tool("ruxex-artifacts"))
    parser.add_argument("--node-runtime", type=Path, required=True)
    parser.add_argument("--artifact-sdk", type=Path, required=True)
    parser.add_argument("--artifact-runtime", type=Path, required=True)
    parser.add_argument("--artifact-engine", type=Path, required=True)
    parser.add_argument("--bwrap", type=Path, default=discover_tool("bwrap"))
    parser.add_argument("--version", default="0.1.0")
    parser.add_argument("--target", default=target_triple())
    args = parser.parse_args()

    if not args.desktop_host and args.ruxex_bin is None:
        raise SystemExit("missing --ruxex-bin (or use --desktop-host)")
    if args.desktop_host and args.ruxex_bin is not None:
        raise SystemExit("--ruxex-bin cannot be combined with --desktop-host")
    if args.rg is None:
        raise SystemExit("missing rg: install ripgrep or pass --rg")
    if args.artifact_tools is None:
        raise SystemExit("missing ruxex-artifacts: build it or pass --artifact-tools")
    if sys.platform == "linux" and args.bwrap is None:
        raise SystemExit("missing bwrap: install bubblewrap or pass --bwrap")
    output = args.output.resolve()
    if output == Path(output.anchor):
        raise SystemExit("refusing to stage into the filesystem root")
    ignore_contents = None
    ignore_file = output / ".gitignore"
    if ignore_file.is_file():
        ignore_contents = ignore_file.read_text(encoding="utf-8")
    if output.exists():
        shutil.rmtree(output)
    if ignore_contents is not None:
        output.mkdir(parents=True)
        ignore_file.write_text(ignore_contents, encoding="utf-8")
    (output / "ruxex-path").mkdir(parents=True)
    (output / "ruxex-resources").mkdir(parents=True)

    if args.ruxex_bin is not None:
        copy_executable(args.ruxex_bin, output / "bin/ruxex")
    copy_executable(args.code_mode_host, output / "bin/ruxex-code-mode-host")
    copy_executable(args.rg, output / "ruxex-path/rg")
    copy_executable(args.artifact_tools, output / "ruxex-path/ruxex-artifacts")
    copy_executable(args.artifact_engine, output / "ruxex-path/ruxex-artifacts-engine")
    validate_artifact_runtime(args.artifact_runtime, args.target)
    runtime_manifest = json.loads(
        (args.artifact_runtime / "runtime-manifest.json").read_text(encoding="utf-8")
    )
    validate_node_runtime(args.node_runtime, runtime_manifest["nodeVersion"])
    copy_directory(args.node_runtime, output / "ruxex-resources/node")
    copy_directory(args.artifact_sdk, output / "ruxex-resources/ruxex-artifact-tool")
    for name in ("python", "native", "bin", "licenses"):
        copy_directory(args.artifact_runtime / name, output / f"ruxex-resources/{name}")
    shutil.copy2(
        args.artifact_runtime / "runtime-manifest.json",
        output / "ruxex-resources/runtime-manifest.json",
    )
    runtime_manifest_path = output / "ruxex-resources/runtime-manifest.json"
    runtime_manifest = json.loads(runtime_manifest_path.read_text(encoding="utf-8"))
    runtime_manifest["bundledInputs"] = {
        "nodeRuntimeSha256": directory_sha256(output / "ruxex-resources/node"),
        "artifactSdkSha256": directory_sha256(output / "ruxex-resources/ruxex-artifact-tool"),
    }
    runtime_manifest_path.write_text(
        json.dumps(runtime_manifest, indent=2) + "\n", encoding="utf-8"
    )
    source_skills = Path(__file__).resolve().parents[1] / "plugins/ruxex-artifacts/skills"
    copy_directory(source_skills, output / "ruxex-resources/vendored/skills")
    github_requirements_skill = (
        Path(__file__).resolve().parents[1]
        / "plugins/ruxex-github/skills/requirements-planning"
    )
    copy_directory(
        github_requirements_skill,
        output / "ruxex-resources/vendored/skills/requirements-planning",
    )
    for name in ("documents", "presentations", "spreadsheets", "pdf"):
        copy_executable(
            args.artifact_tools,
            output / f"ruxex-resources/vendored/skills/{name}/ruxex-artifacts",
        )
    if args.bwrap is not None:
        copy_executable(args.bwrap, output / "ruxex-resources/bwrap")

    (output / "ruxex-package.json").write_text(
        json.dumps(
            {
                "version": args.version,
                "target": args.target,
                "entrypoint": "desktop-host" if args.desktop_host else "bin/ruxex",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    validate_package(output, args.version, args.target, args.desktop_host)
    print(output)


if __name__ == "__main__":
    main()
