import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from PIL import Image


SCRIPT = Path(__file__).parents[1] / "skills/documents/scripts/compare_docx.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("compare_docx", SCRIPT)
assert SPEC and SPEC.loader
COMPARE_DOCX = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(COMPARE_DOCX)


def write_docx(path: Path, text: str) -> None:
    xml = (
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"
    )
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("word/document.xml", xml)


class CompareDocxRuntimeTest(unittest.TestCase):
    def test_locked_pillow_produces_image_diffs_for_rendered_pages(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            before = root / "before.docx"
            after = root / "after.docx"
            write_docx(before, "before")
            write_docx(after, "after")
            output = root / "comparison"

            def render_side_effect(document, page_dir, dpi, keep_pdf):
                page_dir.mkdir()
                page = page_dir / "page-1.png"
                color = "white" if Path(document) == before else "black"
                Image.new("RGB", (12, 12), color).save(page)
                return [page]

            with patch.object(COMPARE_DOCX, "render", side_effect=render_side_effect):
                report = COMPARE_DOCX.compare(before, after, output, 120)

            self.assertTrue(report["imageDiffAvailable"])
            self.assertTrue(report["textChanged"])
            self.assertEqual(report["pageCounts"], {"before": 1, "after": 1})
            self.assertGreater(report["pageComparison"][0]["meanAbsoluteDifference"], 0)
            self.assertTrue(Path(report["pageComparison"][0]["diffImage"]).is_file())
            self.assertTrue((output / "before-page-001.png").is_file())
            self.assertTrue((output / "after-page-001.png").is_file())


if __name__ == "__main__":
    unittest.main()
