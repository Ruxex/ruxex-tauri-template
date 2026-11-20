from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile


SCRIPT = Path(__file__).with_name("ci_test_bundled_artifact_runtime.py")
SPEC = importlib.util.spec_from_file_location("ci_bundled_runtime", SCRIPT)
assert SPEC and SPEC.loader
CI_RUNTIME = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CI_RUNTIME)


class BundledArtifactRuntimeValidationTests(unittest.TestCase):
    def _valid_artifacts(self, root: Path) -> None:
        entries = {
            "smoke.docx": "word/document.xml",
            "smoke.pptx": "ppt/slides/slide1.xml",
            "smoke.xlsx": "xl/workbook.xml",
        }
        for filename, entry in entries.items():
            with zipfile.ZipFile(root / filename, "w") as archive:
                archive.writestr(entry, "<root />")
        (root / "smoke.pdf").write_bytes(b"%PDF-1.7\n")
        (root / "smoke-sharp.png").write_bytes(b"\x89PNG\r\n\x1a\n")

    def test_accepts_the_four_artifact_formats_and_sharp_image(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self._valid_artifacts(root)

            CI_RUNTIME.validate_artifact_files(root)

    def test_rejects_an_office_file_without_its_main_document_part(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self._valid_artifacts(root)
            (root / "smoke.docx").unlink()
            with zipfile.ZipFile(root / "smoke.docx", "w") as archive:
                archive.writestr("word/styles.xml", "<styles />")

            with self.assertRaisesRegex(RuntimeError, "word/document.xml"):
                CI_RUNTIME.validate_artifact_files(root)

    def test_rejects_a_missing_sharp_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self._valid_artifacts(root)
            (root / "smoke-sharp.png").unlink()

            with self.assertRaisesRegex(RuntimeError, "smoke-sharp.png"):
                CI_RUNTIME.validate_artifact_files(root)


if __name__ == "__main__":
    unittest.main()
