import importlib.util
import os
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("stage-ruxex-package.py")
SPEC = importlib.util.spec_from_file_location("stage_ruxex_package", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class StageRuxexPackageTest(unittest.TestCase):
    def _artifact_resources(self, root: Path) -> dict[str, Path]:
        resources = root / "artifact-resources"
        node = resources / "node"
        node_bin = node / "bin/node"
        node_bin.parent.mkdir(parents=True)
        node_bin.write_text("node", encoding="utf-8")
        node_bin.chmod(0o755)
        for package_name in ("docx", "pptxgenjs"):
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
        return {"node-runtime": node, "artifact-sdk": sdk, "artifact-engine": engine}

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

            self.assertEqual(
                sorted(path.relative_to(output).as_posix() for path in output.rglob("*")),
                [
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
                    "ruxex-resources/node/node_modules/pptxgenjs",
                    "ruxex-resources/node/node_modules/pptxgenjs/package.json",
                    "ruxex-resources/ruxex-artifact-tool",
                    "ruxex-resources/ruxex-artifact-tool/src",
                    "ruxex-resources/ruxex-artifact-tool/src/loader.mjs",
                    "ruxex-resources/ruxex-artifact-tool/src/runner.mjs",
                ],
            )
            self.assertTrue(os.access(output / "bin/ruxex", os.X_OK))
            MODULE.validate_package(output, "0.1.0", "x86_64-unknown-linux-gnu")

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
                    "--artifact-engine",
                    str(paths["artifact-engine"]),
                    "--bwrap",
                    str(paths["bwrap"]),
                ]
                with self.assertRaisesRegex(SystemExit, "missing .*docx"):
                    MODULE.main()
            finally:
                MODULE.sys.argv = old_argv

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
                "ruxex-resources/ruxex-artifact-tool/src/loader.mjs",
                "ruxex-resources/ruxex-artifact-tool/src/runner.mjs",
            ):
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("tool", encoding="utf-8")
                path.chmod(0o755)
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
