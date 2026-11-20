import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile


SCRIPT = Path(__file__).parents[1] / "skills/documents/scripts/render_docx.py"
SPEC = importlib.util.spec_from_file_location("render_docx", SCRIPT)
assert SPEC and SPEC.loader
RENDER_DOCX = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RENDER_DOCX)


class RenderDocxRuntimeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.runtime = self.root / "runtime"
        self.bin_dir = self.runtime / "bin/override"
        self.bin_dir.mkdir(parents=True)
        for name in ("soffice", "pdfinfo", "pdftoppm"):
            executable = self.bin_dir / name
            executable.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            executable.chmod(0o755)
        self.source = self.root / "report.docx"
        with zipfile.ZipFile(self.source, "w") as archive:
            archive.writestr("word/document.xml", "<document/>")
        self.output = self.root / "pages"
        self.output.mkdir()

    def _convert(self, command, **kwargs):
        command = [str(value) for value in command]
        self.assertEqual(command[0], str(self.bin_dir / "soffice"))
        self.assertIn("--headless", command)
        outdir = Path(command[command.index("--outdir") + 1])
        (outdir / "report.pdf").write_bytes(b"PDF fixture")
        return type("Result", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    def _rasterize(self, pdf_path, **kwargs):
        self.assertEqual(Path(pdf_path).name, "report.pdf")
        self.assertEqual(kwargs["poppler_path"], str(self.bin_dir))
        self.assertEqual(kwargs["output_file"], "report")
        self.assertEqual(kwargs["dpi"], 150)
        from PIL import Image

        pages = []
        for number in (1, 2):
            page = Path(kwargs["output_folder"]) / f"report-{number}.png"
            Image.new("RGB", (40, 60), "white").save(page)
            pages.append(str(page))
        return pages

    def test_uses_only_shared_runtime_tools_and_renders_all_pages(self):
        with patch.dict(os.environ, {"RUXEX_RUNTIME_ROOT": str(self.runtime), "RUXEX_RUNTIME_BIN_DIR": str(self.bin_dir)}):
            with patch.object(RENDER_DOCX.subprocess, "run", side_effect=self._convert):
                with patch("pdf2image.convert_from_path", side_effect=self._rasterize) as rasterize:
                    with patch("shutil.which", side_effect=AssertionError("host PATH search")):
                        pages = RENDER_DOCX.render(self.source, self.output, 150, keep_pdf=True)

        self.assertEqual([path.name for path in pages], ["report-1.png", "report-2.png"])
        self.assertTrue(all(path.is_file() for path in pages))
        self.assertTrue((self.output / "report.pdf").is_file())
        rasterize.assert_called_once()

    def test_requires_managed_runtime_instead_of_falling_back_to_path(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "RUXEX_RUNTIME_BIN_DIR"):
                RENDER_DOCX.render(self.source, self.output, 150, keep_pdf=False)

    def test_rejects_missing_bundled_soffice(self):
        (self.bin_dir / "soffice").unlink()
        with patch.dict(
            os.environ,
            {
                "RUXEX_RUNTIME_ROOT": str(self.runtime),
                "RUXEX_RUNTIME_BIN_DIR": str(self.bin_dir),
            },
        ):
            with self.assertRaisesRegex(RuntimeError, "soffice"):
                RENDER_DOCX.render(self.source, self.output, 150, keep_pdf=False)

    def test_rasterization_failure_does_not_leave_partial_pages(self):
        with patch.dict(
            os.environ,
            {
                "RUXEX_RUNTIME_ROOT": str(self.runtime),
                "RUXEX_RUNTIME_BIN_DIR": str(self.bin_dir),
            },
        ):
            with patch.object(RENDER_DOCX.subprocess, "run", side_effect=self._convert):
                with patch("pdf2image.convert_from_path", side_effect=RuntimeError("bad PDF")):
                    with self.assertRaisesRegex(RuntimeError, "PDF page rendering failed"):
                        RENDER_DOCX.render(self.source, self.output, 150, keep_pdf=False)
        self.assertEqual(list(self.output.iterdir()), [])

    def test_rejects_runtime_bin_override_outside_shared_resources(self):
        with patch.dict(
            os.environ,
            {
                "RUXEX_RUNTIME_ROOT": str(self.runtime),
                "RUXEX_RUNTIME_BIN_DIR": str(self.root / "other-tools"),
            },
        ):
            with self.assertRaisesRegex(RuntimeError, "does not match"):
                RENDER_DOCX.render(self.source, self.output, 150, keep_pdf=False)

    def test_every_public_document_helper_starts_in_the_locked_python(self):
        helper_dir = SCRIPT.parent
        helpers = sorted(path for path in helper_dir.glob("*.py") if path.name != "ooxml_xml.py")
        self.assertGreater(len(helpers), 20)
        for helper in helpers:
            with self.subTest(helper=helper.name):
                result = subprocess.run(
                    [sys.executable, str(helper), "--help"],
                    capture_output=True,
                    text=True,
                    timeout=20,
                )
                self.assertEqual(
                    result.returncode,
                    0,
                    f"{helper.name} failed to start: {result.stderr or result.stdout}",
                )

    def test_document_task_guides_launch_python_helpers_through_shared_runtime(self):
        tasks = SCRIPT.parents[1] / "tasks"
        for guide in sorted(tasks.glob("*.md")):
            content = guide.read_text(encoding="utf-8")
            with self.subTest(guide=guide.name):
                self.assertNotRegex(content, r"(?m)^\s*python3(?:\s|$)")
                if "/scripts/" in content and ".py" in content:
                    self.assertIn('"/absolute/path/to/skill/documents/ruxex-artifacts" python', content)


if __name__ == "__main__":
    unittest.main()
