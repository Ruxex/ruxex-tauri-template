import argparse
import importlib.util
import json
import os
import subprocess
import shutil
import sys
import tempfile
import tomllib
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("build_artifact_runtime.py")
SPEC = importlib.util.spec_from_file_location("build_artifact_runtime", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

STAGE_SCRIPT = Path(__file__).with_name("stage-ruxex-package.py")
STAGE_SPEC = importlib.util.spec_from_file_location("stage_ruxex_package", STAGE_SCRIPT)
assert STAGE_SPEC and STAGE_SPEC.loader
STAGE_MODULE = importlib.util.module_from_spec(STAGE_SPEC)
STAGE_SPEC.loader.exec_module(STAGE_MODULE)


class BuildArtifactRuntimeTest(unittest.TestCase):
    def test_rejects_native_tool_version_that_differs_from_the_release_manifest(self) -> None:
        with patch.object(
            MODULE.subprocess,
            "run",
            return_value=SimpleNamespace(
                returncode=0, stdout="pdfinfo version 26.05.0\n", stderr=""
            ),
        ):
            with self.assertRaisesRegex(
                RuntimeError, "expected native tool version 26.04.0, got 26.05.0"
            ):
                MODULE.validate_executable_version(
                    Path("/runtime/bin/override/pdfinfo"),
                    ("-v",),
                    "26.04.0",
                    Path("/runtime"),
                )

    def test_python_version_probe_imports_every_locked_runtime_package(self) -> None:
        expected_python = (MODULE.PROJECT / ".python-version").read_text(encoding="utf-8").strip()
        actual_python = ".".join(str(part) for part in sys.version_info[:3])
        if actual_python != expected_python:
            self.skipTest(
                f"package import smoke test requires locked Python {expected_python}, "
                f"current test interpreter is {actual_python}"
            )
        versions = MODULE.package_versions(Path(sys.executable))
        self.assertEqual(
            set(versions),
            {"lxml", "numpy", "Pillow", "pdf2image", "python-pptx"},
        )
        self.assertTrue(all(version for version in versions.values()))

    def test_uv_version_is_explicitly_pinned_for_development_and_release(self) -> None:
        expected = (MODULE.PROJECT / ".uv-version").read_text(encoding="utf-8").strip()
        actual = MODULE.run(["uv", "--version"]).split()
        self.assertGreaterEqual(len(actual), 2)
        self.assertEqual(actual[1], expected)
        project = tomllib.loads((MODULE.PROJECT / "pyproject.toml").read_text(encoding="utf-8"))
        self.assertEqual(project["tool"]["uv"]["required-version"], f"=={expected}")

    def test_assembles_and_validates_a_standalone_runtime_for_the_current_target(self) -> None:
        expected_python = (MODULE.PROJECT / ".python-version").read_text(encoding="utf-8").strip()
        actual_python = ".".join(str(part) for part in sys.version_info[:3])
        if actual_python != expected_python:
            self.skipTest(
                f"runtime assembly requires locked Python {expected_python}, current is {actual_python}"
            )

        with tempfile.TemporaryDirectory(prefix="ruxex-runtime-assembly-test-") as temporary:
            root = Path(temporary)
            native = root / "native"
            for relative in (
                "libreoffice/program/soffice",
                "poppler/bin/pdfinfo",
                "poppler/bin/pdftoppm",
            ):
                executable = native / relative
                executable.parent.mkdir(parents=True, exist_ok=True)
                version_output = (
                    "LibreOffice 24.2.7.2\n"
                    if relative.startswith("libreoffice/")
                    else "Poppler 24.02.0\n"
                )
                executable.write_text(
                    f"#!/bin/sh\nprintf '%s\\n' '{version_output.strip()}'\n",
                    encoding="utf-8",
                )
                executable.chmod(0o755)
            notices = native / "licenses/THIRD_PARTY_NOTICES.md"
            notices.parent.mkdir(parents=True)
            notices.write_text("Test fixture licenses only.\n", encoding="utf-8")
            target = MODULE.target_triple()
            (native / "runtime-manifest.json").write_text(
                json.dumps({
                    "schemaVersion": 1,
                    "target": target,
                    "libreofficeVersion": "24.2.7.2",
                    "popplerVersion": "24.02.0",
                }),
                encoding="utf-8",
            )
            node = root / "node/bin/node"
            node.parent.mkdir(parents=True)
            node.write_text("#!/bin/sh\nprintf 'v22.14.0\\n'\n", encoding="utf-8")
            node.chmod(0o755)
            output = root / "runtime"
            manifest_path = MODULE.assemble(argparse.Namespace(
                output=output,
                node_runtime=node.parent.parent,
                native_runtime=native,
                uv=Path(shutil.which("uv") or "uv"),
                target=target,
                libreoffice_version="24.2.7.2",
                poppler_version="24.02.0",
            ))

            STAGE_MODULE.validate_artifact_runtime(output, target)
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(manifest["pythonVersion"], expected_python)
            self.assertEqual(set(manifest["pythonPackages"]), set(MODULE.REQUIRED_PACKAGES))
            self.assertEqual(manifest["target"], target)
            self.assertEqual(manifest["native"]["libreofficeVersion"], "24.2.7.2")
            self.assertEqual(manifest["native"]["popplerVersion"], "24.02.0")
            python_wrapper = (output / "python/bin/python3").read_text(encoding="utf-8")
            self.assertIn(
                f'"$HERE/python{".".join(expected_python.split(".")[:2])}" -B "$@"',
                python_wrapper,
            )
            subprocess.run(
                [
                    str(output / "python/bin/python3"),
                    "-c",
                    "import lxml.etree, numpy, PIL, pdf2image, pptx",
                ],
                check=True,
            )
            self.assertEqual(
                MODULE.hash_tree(output / "python"),
                manifest["inputs"]["pythonRuntimeSha256"],
            )

    def test_hashes_runtime_tree_contents_and_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            item = root / "bin/runtime"
            item.parent.mkdir(parents=True)
            item.write_text("first", encoding="utf-8")
            first = MODULE.hash_tree(root)
            self.assertEqual(first, MODULE.hash_tree(root))
            item.write_text("second", encoding="utf-8")
            self.assertNotEqual(first, MODULE.hash_tree(root))

    def test_poppler_wrappers_prefer_libraries_from_the_shared_runtime(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for relative in (
                "native/poppler/lib/libpoppler.so.1",
                "native/poppler/Frameworks/libpoppler.dylib",
            ):
                library = root / relative
                library.parent.mkdir(parents=True, exist_ok=True)
                library.write_text("test library", encoding="utf-8")

            directories = MODULE.shared_library_directories(root / "native/poppler")
            self.assertEqual(directories, ["Frameworks", "lib"])
            wrapper = root / "bin/override/pdfinfo"
            MODULE.write_wrapper(
                wrapper,
                "native/poppler/bin/pdfinfo",
                loader_variable="LD_LIBRARY_PATH",
                library_directories=tuple(directories),
            )

            content = wrapper.read_text(encoding="utf-8")
            self.assertIn(
                'export LD_LIBRARY_PATH="$RUXEX_RUNTIME_ROOT/native/poppler/Frameworks:'
                '$RUXEX_RUNTIME_ROOT/native/poppler/lib"',
                content,
            )
            self.assertTrue(os.access(wrapper, os.X_OK))

            office_wrapper = root / "bin/override/soffice"
            MODULE.write_wrapper(
                office_wrapper,
                "native/libreoffice/program/soffice",
                loader_variable="LD_LIBRARY_PATH",
                library_root="native/libreoffice",
                library_directories=("program", "ure/lib"),
            )
            self.assertIn(
                'export LD_LIBRARY_PATH="$RUXEX_RUNTIME_ROOT/native/libreoffice/program:'
                '$RUXEX_RUNTIME_ROOT/native/libreoffice/ure/lib"',
                office_wrapper.read_text(encoding="utf-8"),
            )

    def test_discovers_target_native_tools_by_relative_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for relative in (
                "libreoffice/program/soffice",
                "poppler/bin/pdfinfo",
                "poppler/bin/pdftoppm",
            ):
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("native tool", encoding="utf-8")
                path.chmod(0o755)

            self.assertEqual(
                MODULE.discover_native_tools(root),
                {
                    "soffice": "libreoffice/program/soffice",
                    "pdfinfo": "poppler/bin/pdfinfo",
                    "pdftoppm": "poppler/bin/pdftoppm",
                },
            )

    def test_rejects_native_runtime_missing_a_required_renderer(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for relative in ("libreoffice/program/soffice", "poppler/bin/pdfinfo"):
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("native tool", encoding="utf-8")
                path.chmod(0o755)

            with self.assertRaisesRegex(ValueError, "pdftoppm"):
                MODULE.discover_native_tools(root)

    def test_rejects_prebuilt_native_assets_for_a_different_target(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest = root / "runtime-manifest.json"
            manifest.write_text(
                '{"schemaVersion":1,"target":"aarch64-apple-darwin",'
                '"libreofficeVersion":"24.8","popplerVersion":"25.1"}',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "target"):
                MODULE.validate_native_manifest(root, "x86_64-unknown-linux-gnu", "24.8", "25.1")

    def test_accepts_prebuilt_native_assets_with_matching_versions(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "runtime-manifest.json").write_text(
                '{"schemaVersion":1,"target":"x86_64-unknown-linux-gnu",'
                '"libreofficeVersion":"24.8","popplerVersion":"25.1"}',
                encoding="utf-8",
            )
            manifest = MODULE.validate_native_manifest(
                root, "x86_64-unknown-linux-gnu", "24.8", "25.1"
            )
            self.assertEqual(manifest["libreofficeVersion"], "24.8")


if __name__ == "__main__":
    unittest.main()
