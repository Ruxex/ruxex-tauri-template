import importlib.util
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("stage-ruxex-package.py")
SPEC = importlib.util.spec_from_file_location("stage_ruxex_package", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class StageRuxexPackageTest(unittest.TestCase):
    def test_rejects_a_node_runtime_that_does_not_match_the_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            node = root / "bin/node"
            node.parent.mkdir(parents=True)
            node.write_text("#!/bin/sh\nprintf '%s\\n' 'v23.0.0'\n", encoding="utf-8")
            node.chmod(0o755)
            with self.assertRaisesRegex(SystemExit, "does not match runtime manifest"):
                MODULE.validate_node_runtime(root, "24.22.1")

    def _artifact_resources(self, root: Path) -> dict[str, Path]:
        resources = root / "artifact-resources"
        node = resources / "node"
        node_bin = node / "bin/node"
        node_bin.parent.mkdir(parents=True)
        node_bin.write_text("#!/bin/sh\nprintf '%s\\n' 'v24.22.1'\n", encoding="utf-8")
        node_bin.chmod(0o755)
        for package_name in ("docx", "pptxgenjs", "jszip", "sharp", "pdf-lib", "jsonpath-plus"):
            package_json = node / "node_modules" / package_name / "package.json"
            package_json.parent.mkdir(parents=True)
            package_json.write_text(
                '{"name": "' + package_name + '", "version": "test"}\n',
                encoding="utf-8",
            )

        sdk = resources / "sdk"
        (sdk / "src").mkdir(parents=True)
        (sdk / "src/loader.mjs").write_text("loader", encoding="utf-8")
        (sdk / "src/runner.mjs").write_text("runner", encoding="utf-8")

        engine = resources / "ruxex-artifacts-engine"
        engine.write_text("engine", encoding="utf-8")
        engine.chmod(0o755)

        artifact_runtime = resources / "artifact-runtime"
        for relative in (
            "python/bin/python3",
            "native/libreoffice/program/soffice",
            "native/poppler/bin/pdftoppm",
            "native/poppler/bin/pdfinfo",
            "bin/override/soffice",
            "bin/override/pdftoppm",
            "bin/override/pdfinfo",
        ):
            path = artifact_runtime / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("runtime fixture", encoding="utf-8")
            path.chmod(0o755)
        python = artifact_runtime / "python/bin/python3"
        python.write_text(
            "#!/bin/sh\n"
            "printf '%s\\n' '{\"pythonVersion\":\"3.12.14\","
            "\"pythonPackages\":{\"lxml\":\"6.1.1\",\"numpy\":\"2.3.5\","
            "\"Pillow\":\"13.0.0\",\"pdf2image\":\"1.17.0\","
            "\"python-pptx\":\"1.0.2\"}}'\n",
            encoding="utf-8",
        )
        python.chmod(0o755)
        licenses = artifact_runtime / "licenses/THIRD_PARTY_NOTICES.md"
        licenses.parent.mkdir(parents=True, exist_ok=True)
        licenses.write_text("test license notices\n", encoding="utf-8")
        (artifact_runtime / "runtime-manifest.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "target": "x86_64-unknown-linux-gnu",
                    "pythonVersion": "3.12.14",
                    "uvVersion": "0.13.5",
                    "nodeVersion": "24.22.1",
                    "pythonPackages": {
                        "lxml": "6.1.1",
                        "numpy": "2.3.5",
                        "Pillow": "13.0.0",
                        "pdf2image": "1.17.0",
                        "python-pptx": "1.0.2",
                    },
                    "native": {"libreofficeVersion": "test", "popplerVersion": "test"},
                    "nativeSource": {
                        "target": "x86_64-unknown-linux-gnu",
                        "libreofficeVersion": "test",
                        "popplerVersion": "test",
                    },
                    "inputs": {
                        "pythonRuntimeSha256": MODULE.directory_sha256(artifact_runtime / "python"),
                        "libreOfficeRuntimeSha256": MODULE.directory_sha256(artifact_runtime / "native/libreoffice"),
                        "popplerRuntimeSha256": MODULE.directory_sha256(artifact_runtime / "native/poppler"),
                        "overrideRuntimeSha256": MODULE.directory_sha256(artifact_runtime / "bin/override"),
                        "licenseRuntimeSha256": MODULE.directory_sha256(artifact_runtime / "licenses"),
                    },
                    "executables": {
                        "python": "python/bin/python3",
                        "soffice": "native/libreoffice/program/soffice",
                        "pdfinfo": "native/poppler/bin/pdfinfo",
                        "pdftoppm": "native/poppler/bin/pdftoppm",
                    },
                    "licenseNotices": "licenses/THIRD_PARTY_NOTICES.md",
                },
                separators=(",", ":"),
            )
            + "\n",
            encoding="utf-8",
        )
        return {
            "node-runtime": node,
            "artifact-sdk": sdk,
            "artifact-engine": engine,
            "artifact-runtime": artifact_runtime,
        }

    def _runtime_inputs(self, root: Path) -> dict[str, Path]:
        inputs = root / "inputs"
        inputs.mkdir()
        paths = {}
        for name in ("ruxex", "ruxex-code-mode-host", "rg", "bwrap", "ruxex-artifacts"):
            path = inputs / name
            path.write_text(name, encoding="utf-8")
            path.chmod(0o755)
            paths[name] = path
        paths.update(self._artifact_resources(root))
        return paths

    def test_preserves_repository_ignore_file(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            inputs = root / "inputs"
            inputs.mkdir()
            for name in ("ruxex", "ruxex-code-mode-host", "rg", "bwrap", "ruxex-artifacts"):
                path = inputs / name
                path.write_text(name, encoding="utf-8")
                path.chmod(0o755)
            resources = self._artifact_resources(root)

            output = root / "package"
            output.mkdir()
            ignore_file = output / ".gitignore"
            ignore_file.write_text("*\n!.gitignore\n", encoding="utf-8")
            old_argv = MODULE.sys.argv
            try:
                MODULE.sys.argv = [
                    str(SCRIPT),
                    "--output",
                    str(output),
                    "--ruxex-bin",
                    str(inputs / "ruxex"),
                    "--code-mode-host",
                    str(inputs / "ruxex-code-mode-host"),
                    "--rg",
                    str(inputs / "rg"),
                    "--artifact-tools",
                    str(inputs / "ruxex-artifacts"),
                    "--node-runtime",
                    str(resources["node-runtime"]),
                    "--artifact-sdk",
                    str(resources["artifact-sdk"]),
                    "--artifact-runtime",
                    str(resources["artifact-runtime"]),
                    "--artifact-engine",
                    str(resources["artifact-engine"]),
                    "--bwrap",
                    str(inputs / "bwrap"),
                    "--version",
                    "0.1.0",
                    "--target",
                    "x86_64-unknown-linux-gnu",
                ]
                MODULE.main()
            finally:
                MODULE.sys.argv = old_argv

            self.assertEqual(ignore_file.read_text(encoding="utf-8"), "*\n!.gitignore\n")

    def test_discovers_runtime_tools_from_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            inputs = root / "inputs"
            inputs.mkdir()
            for name in ("ruxex", "ruxex-code-mode-host"):
                path = inputs / name
                path.write_text(name, encoding="utf-8")
                path.chmod(0o755)
            resources = self._artifact_resources(root)

            tools = root / "tools"
            tools.mkdir()
            for name in ("rg", "bwrap", "ruxex-artifacts"):
                path = tools / name
                path.write_text(name, encoding="utf-8")
                path.chmod(0o755)

            output = root / "package"
            old_argv = MODULE.sys.argv
            old_path = os.environ.get("PATH")
            try:
                MODULE.sys.argv = [
                    str(SCRIPT),
                    "--output",
                    str(output),
                    "--ruxex-bin",
                    str(inputs / "ruxex"),
                    "--code-mode-host",
                    str(inputs / "ruxex-code-mode-host"),
                    "--node-runtime",
                    str(resources["node-runtime"]),
                    "--artifact-sdk",
                    str(resources["artifact-sdk"]),
                    "--artifact-runtime",
                    str(resources["artifact-runtime"]),
                    "--artifact-engine",
                    str(resources["artifact-engine"]),
                    "--version",
                    "0.1.0",
                    "--target",
                    "x86_64-unknown-linux-gnu",
                ]
                os.environ["PATH"] = str(tools)
                MODULE.main()
            finally:
                MODULE.sys.argv = old_argv
                if old_path is None:
                    os.environ.pop("PATH", None)
                else:
                    os.environ["PATH"] = old_path

            self.assertTrue((output / "ruxex-path/rg").is_file())
            self.assertTrue((output / "ruxex-path/ruxex-artifacts").is_file())
            self.assertTrue((output / "ruxex-resources/bwrap").is_file())

    def test_stages_layout_consumed_by_install_context(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            inputs = root / "inputs"
            inputs.mkdir()
            for name in ("ruxex", "ruxex-code-mode-host", "rg", "bwrap", "ruxex-artifacts"):
                path = inputs / name
                path.write_text(name, encoding="utf-8")
                path.chmod(0o755)
            resources = self._artifact_resources(root)

            output = root / "package"
            old_argv = MODULE.sys.argv
            try:
                MODULE.sys.argv = [
                    str(SCRIPT),
                    "--output",
                    str(output),
                    "--ruxex-bin",
                    str(inputs / "ruxex"),
                    "--code-mode-host",
                    str(inputs / "ruxex-code-mode-host"),
                    "--rg",
                    str(inputs / "rg"),
                    "--artifact-tools",
                    str(inputs / "ruxex-artifacts"),
                    "--node-runtime",
                    str(resources["node-runtime"]),
                    "--artifact-sdk",
                    str(resources["artifact-sdk"]),
                    "--artifact-runtime",
                    str(resources["artifact-runtime"]),
                    "--artifact-engine",
                    str(resources["artifact-engine"]),
                    "--bwrap",
                    str(inputs / "bwrap"),
                    "--version",
                    "0.1.0",
                    "--target",
                    "x86_64-unknown-linux-gnu",
                ]
                MODULE.main()
            finally:
                MODULE.sys.argv = old_argv

            staged_paths = {
                path.relative_to(output).as_posix() for path in output.rglob("*")
            }
            self.assertTrue(
                {
                    "bin",
                    "bin/ruxex",
                    "bin/ruxex-code-mode-host",
                    "ruxex-package.json",
                    "ruxex-path",
                    "ruxex-path/rg",
                    "ruxex-path/ruxex-artifacts",
                    "ruxex-path/ruxex-artifacts-engine",
                    "ruxex-resources",
                    "ruxex-resources/bwrap",
                    "ruxex-resources/node",
                    "ruxex-resources/node/bin",
                    "ruxex-resources/node/bin/node",
                    "ruxex-resources/node/node_modules",
                    "ruxex-resources/node/node_modules/docx",
                    "ruxex-resources/node/node_modules/docx/package.json",
                    "ruxex-resources/node/node_modules/jsonpath-plus",
                    "ruxex-resources/node/node_modules/jsonpath-plus/package.json",
                    "ruxex-resources/node/node_modules/jszip",
                    "ruxex-resources/node/node_modules/jszip/package.json",
                    "ruxex-resources/node/node_modules/pdf-lib",
                    "ruxex-resources/node/node_modules/pdf-lib/package.json",
                    "ruxex-resources/node/node_modules/pptxgenjs",
                    "ruxex-resources/node/node_modules/pptxgenjs/package.json",
                    "ruxex-resources/node/node_modules/sharp",
                    "ruxex-resources/node/node_modules/sharp/package.json",
                    "ruxex-resources/python/bin/python3",
                    "ruxex-resources/native/libreoffice/program/soffice",
                    "ruxex-resources/native/poppler/bin/pdftoppm",
                    "ruxex-resources/native/poppler/bin/pdfinfo",
                    "ruxex-resources/bin/override/soffice",
                    "ruxex-resources/bin/override/pdftoppm",
                    "ruxex-resources/bin/override/pdfinfo",
                    "ruxex-resources/licenses/THIRD_PARTY_NOTICES.md",
                    "ruxex-resources/runtime-manifest.json",
                    "ruxex-resources/ruxex-artifact-tool",
                    "ruxex-resources/ruxex-artifact-tool/src",
                    "ruxex-resources/ruxex-artifact-tool/src/loader.mjs",
                    "ruxex-resources/ruxex-artifact-tool/src/runner.mjs",
                    "ruxex-resources/vendored",
                    "ruxex-resources/vendored/skills",
                    "ruxex-resources/vendored/skills/RUNTIME.md",
                    "ruxex-resources/vendored/skills/documents",
                    "ruxex-resources/vendored/skills/documents/SKILL.md",
                    "ruxex-resources/vendored/skills/documents/agents",
                    "ruxex-resources/vendored/skills/documents/agents/ruxex.yaml",
                    "ruxex-resources/vendored/skills/documents/assets/word-skill.svg",
                    "ruxex-resources/vendored/skills/documents/ruxex-artifacts",
                    "ruxex-resources/vendored/skills/documents/tasks",
                    "ruxex-resources/vendored/skills/documents/tasks/accessibility-audit.md",
                    "ruxex-resources/vendored/skills/documents/tasks/advanced-ooxml.md",
                    "ruxex-resources/vendored/skills/documents/tasks/create-edit.md",
                    "ruxex-resources/vendored/skills/documents/tasks/privacy.md",
                    "ruxex-resources/vendored/skills/documents/tasks/read-review.md",
                    "ruxex-resources/vendored/skills/pdf",
                    "ruxex-resources/vendored/skills/pdf/SKILL.md",
                    "ruxex-resources/vendored/skills/pdf/agents",
                    "ruxex-resources/vendored/skills/pdf/agents/ruxex.yaml",
                    "ruxex-resources/vendored/skills/pdf/assets/pdf-skill.svg",
                    "ruxex-resources/vendored/skills/pdf/ruxex-artifacts",
                    "ruxex-resources/vendored/skills/presentations",
                    "ruxex-resources/vendored/skills/presentations/SKILL.md",
                    "ruxex-resources/vendored/skills/presentations/agents",
                    "ruxex-resources/vendored/skills/presentations/agents/ruxex.yaml",
                    "ruxex-resources/vendored/skills/presentations/assets/presentation-skill.svg",
                    "ruxex-resources/vendored/skills/presentations/domain-guidance",
                    "ruxex-resources/vendored/skills/presentations/domain-guidance/finance.md",
                    "ruxex-resources/vendored/skills/presentations/references",
                    "ruxex-resources/vendored/skills/presentations/references/api-compatibility.md",
                    "ruxex-resources/vendored/skills/presentations/references/design-guidance.md",
                    "ruxex-resources/vendored/skills/presentations/references/finalization.md",
                    "ruxex-resources/vendored/skills/presentations/references/template-workflow.md",
                    "ruxex-resources/vendored/skills/presentations/ruxex-artifacts",
                    "ruxex-resources/vendored/skills/spreadsheets",
                    "ruxex-resources/vendored/skills/spreadsheets/SKILL.md",
                    "ruxex-resources/vendored/skills/spreadsheets/agents",
                    "ruxex-resources/vendored/skills/spreadsheets/agents/ruxex.yaml",
                    "ruxex-resources/vendored/skills/spreadsheets/assets/excel-skill.svg",
                    "ruxex-resources/vendored/skills/spreadsheets/domain_guidance",
                    "ruxex-resources/vendored/skills/spreadsheets/domain_guidance/financial_models.md",
                    "ruxex-resources/vendored/skills/spreadsheets/domain_guidance/healthcare.md",
                    "ruxex-resources/vendored/skills/spreadsheets/domain_guidance/marketing_advertising.md",
                    "ruxex-resources/vendored/skills/spreadsheets/domain_guidance/scientific_research.md",
                    "ruxex-resources/vendored/skills/spreadsheets/features",
                    "ruxex-resources/vendored/skills/spreadsheets/features/charts.md",
                    "ruxex-resources/vendored/skills/spreadsheets/references",
                    "ruxex-resources/vendored/skills/spreadsheets/references/read_only_qna.md",
                    "ruxex-resources/vendored/skills/spreadsheets/references/workbook_design.md",
                    "ruxex-resources/vendored/skills/spreadsheets/ruxex-artifacts",
                    "ruxex-resources/vendored/skills/spreadsheets/style_guidelines.md",
                    "ruxex-resources/vendored/skills/spreadsheets/workflows",
                    "ruxex-resources/vendored/skills/spreadsheets/workflows/create_workflows.md",
                    "ruxex-resources/vendored/skills/spreadsheets/workflows/edit_workflows.md",
                }.issubset(staged_paths),
            )
            staged_presentations = "ruxex-resources/vendored/skills/presentations"
            for relative in (
                "references/api-reference-map.md",
                "references/native-evidence.md",
                "references/rendering-review.md",
            ):
                self.assertIn(f"{staged_presentations}/{relative}", staged_paths)
            self.assertFalse(
                any(
                    path.startswith(f"{staged_presentations}/scripts/")
                    or (path.startswith(f"{staged_presentations}/") and path.endswith(".py"))
                    for path in staged_paths
                ),
                "the staged Presentations Skill must not contain Python helpers",
            )
            self.assertTrue(os.access(output / "bin/ruxex", os.X_OK))
            MODULE.validate_package(output, "0.1.0", "x86_64-unknown-linux-gnu")
            runtime_manifest = json.loads(
                (output / "ruxex-resources/runtime-manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                runtime_manifest["bundledInputs"]["nodeRuntimeSha256"],
                MODULE.directory_sha256(output / "ruxex-resources/node"),
            )
            self.assertEqual(
                runtime_manifest["bundledInputs"]["artifactSdkSha256"],
                MODULE.directory_sha256(output / "ruxex-resources/ruxex-artifact-tool"),
            )

    def test_rejects_a_node_runtime_without_document_dependencies(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = self._runtime_inputs(root)
            (paths["node-runtime"] / "node_modules/docx/package.json").unlink()
            old_argv = MODULE.sys.argv
            try:
                MODULE.sys.argv = [
                    str(SCRIPT),
                    "--output",
                    str(root / "package"),
                    "--ruxex-bin",
                    str(paths["ruxex"]),
                    "--code-mode-host",
                    str(paths["ruxex-code-mode-host"]),
                    "--rg",
                    str(paths["rg"]),
                    "--artifact-tools",
                    str(paths["ruxex-artifacts"]),
                    "--node-runtime",
                    str(paths["node-runtime"]),
                    "--artifact-sdk",
                    str(paths["artifact-sdk"]),
                    "--artifact-runtime",
                    str(paths["artifact-runtime"]),
                    "--artifact-engine",
                    str(paths["artifact-engine"]),
                    "--bwrap",
                    str(paths["bwrap"]),
                ]
                with self.assertRaisesRegex(SystemExit, "missing .*docx"):
                    MODULE.main()
            finally:
                MODULE.sys.argv = old_argv

    def test_rejects_an_artifact_runtime_for_a_different_target(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            runtime = self._artifact_resources(Path(temporary))["artifact-runtime"]
            with self.assertRaisesRegex(SystemExit, "does not match"):
                MODULE.validate_artifact_runtime(runtime, "aarch64-apple-darwin")

    def test_rejects_python_version_or_package_versions_that_do_not_match_the_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            runtime = self._artifact_resources(Path(temporary))["artifact-runtime"]
            manifest_path = runtime / "runtime-manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["pythonVersion"] = "3.12.13"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(SystemExit, "Python version"):
                MODULE.validate_artifact_runtime(runtime, "x86_64-unknown-linux-gnu")

            manifest["pythonVersion"] = "3.12.14"
            manifest["pythonPackages"]["Pillow"] = "12.0.0"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(SystemExit, "package versions"):
                MODULE.validate_artifact_runtime(runtime, "x86_64-unknown-linux-gnu")

    def test_rejects_a_missing_runtime_binary(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = self._runtime_inputs(root)
            old_argv = MODULE.sys.argv
            try:
                MODULE.sys.argv = [
                    str(SCRIPT),
                    "--output",
                    str(root / "package"),
                    "--ruxex-bin",
                    str(root / "inputs" / "missing-ruxex"),
                    "--code-mode-host",
                    str(paths["ruxex-code-mode-host"]),
                    "--rg",
                    str(paths["rg"]),
                    "--artifact-tools",
                    str(paths["ruxex-artifacts"]),
                    "--node-runtime",
                    str(paths["node-runtime"]),
                    "--artifact-sdk",
                    str(paths["artifact-sdk"]),
                    "--artifact-runtime",
                    str(paths["artifact-runtime"]),
                    "--artifact-engine",
                    str(paths["artifact-engine"]),
                    "--bwrap",
                    str(paths["bwrap"]),
                ]
                with self.assertRaisesRegex(SystemExit, "missing .*ruxex"):
                    MODULE.main()
            finally:
                MODULE.sys.argv = old_argv

    def test_rejects_a_manifest_that_does_not_match_the_staged_target(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for relative in (
                "bin/ruxex",
                "bin/ruxex-code-mode-host",
                "ruxex-path/rg",
                "ruxex-path/ruxex-artifacts",
                "ruxex-path/ruxex-artifacts-engine",
                "ruxex-resources/bwrap",
                "ruxex-resources/node/bin/node",
                "ruxex-resources/node/node_modules/docx/package.json",
                "ruxex-resources/node/node_modules/pptxgenjs/package.json",
                "ruxex-resources/node/node_modules/jszip/package.json",
                "ruxex-resources/node/node_modules/sharp/package.json",
                "ruxex-resources/node/node_modules/pdf-lib/package.json",
                "ruxex-resources/node/node_modules/jsonpath-plus/package.json",
                "ruxex-resources/ruxex-artifact-tool/src/loader.mjs",
                "ruxex-resources/ruxex-artifact-tool/src/runner.mjs",
                *[
                    f"ruxex-resources/vendored/skills/{name}/{relative}"
                    for name in ("documents", "presentations", "spreadsheets", "pdf")
                    for relative in ("SKILL.md", "agents/ruxex.yaml", "ruxex-artifacts")
                ],
            ):
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("tool", encoding="utf-8")
                path.chmod(0o755)
            runtime_skills = root / "ruxex-resources/vendored/skills/RUNTIME.md"
            runtime_skills.write_text("contract", encoding="utf-8")
            runtime_assets = self._artifact_resources(root)
            runtime_fixture = runtime_assets["artifact-runtime"]
            for name in ("python", "native", "bin", "licenses"):
                shutil.copytree(runtime_fixture / name, root / f"ruxex-resources/{name}")
            for name, source_key in (
                ("node", "node-runtime"),
                ("ruxex-artifact-tool", "artifact-sdk"),
            ):
                shutil.copytree(
                    runtime_assets[source_key],
                    root / f"ruxex-resources/{name}",
                    dirs_exist_ok=True,
                )
            staged_manifest = json.loads(
                (runtime_fixture / "runtime-manifest.json").read_text(encoding="utf-8")
            )
            staged_manifest["bundledInputs"] = {
                "nodeRuntimeSha256": MODULE.directory_sha256(root / "ruxex-resources/node"),
                "artifactSdkSha256": MODULE.directory_sha256(
                    root / "ruxex-resources/ruxex-artifact-tool"
                ),
            }
            shutil.copy2(
                runtime_fixture / "runtime-manifest.json",
                root / "ruxex-resources/runtime-manifest.json",
            )
            (root / "ruxex-resources/runtime-manifest.json").write_text(
                json.dumps(staged_manifest, separators=(",", ":")) + "\n",
                encoding="utf-8",
            )
            (root / "ruxex-package.json").write_text(
                '{"version":"wrong","target":"wrong","entrypoint":"bin/ruxex"}',
                encoding="utf-8",
            )

            with self.assertRaisesRegex(SystemExit, "unexpected staged Ruxex package manifest"):
                MODULE.validate_package(root, "0.1.0", "x86_64-unknown-linux-gnu")

    def test_rejects_a_package_without_the_artifact_helper(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for relative in (
                "bin/ruxex",
                "bin/ruxex-code-mode-host",
                "ruxex-path/rg",
                "ruxex-resources/bwrap",
            ):
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("tool", encoding="utf-8")
                path.chmod(0o755)
            (root / "ruxex-package.json").write_text(
                '{"version":"0.1.0","target":"x86_64-unknown-linux-gnu","entrypoint":"bin/ruxex"}',
                encoding="utf-8",
            )

            with self.assertRaisesRegex(SystemExit, "missing ruxex-path/ruxex-artifacts"):
                MODULE.validate_package(root, "0.1.0", "x86_64-unknown-linux-gnu")

    def test_refuses_to_stage_into_the_filesystem_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = self._runtime_inputs(root)
            old_argv = MODULE.sys.argv
            try:
                MODULE.sys.argv = [
                    str(SCRIPT),
                    "--output",
                    "/",
                    "--ruxex-bin",
                    str(paths["ruxex"]),
                    "--code-mode-host",
                    str(paths["ruxex-code-mode-host"]),
                    "--rg",
                    str(paths["rg"]),
                    "--artifact-tools",
                    str(paths["ruxex-artifacts"]),
                    "--node-runtime",
                    str(paths["node-runtime"]),
                    "--artifact-sdk",
                    str(paths["artifact-sdk"]),
                    "--artifact-runtime",
                    str(paths["artifact-runtime"]),
                    "--artifact-engine",
                    str(paths["artifact-engine"]),
                    "--bwrap",
                    str(paths["bwrap"]),
                ]
                with self.assertRaisesRegex(SystemExit, "filesystem root"):
                    MODULE.main()
            finally:
                MODULE.sys.argv = old_argv


if __name__ == "__main__":
    unittest.main()
