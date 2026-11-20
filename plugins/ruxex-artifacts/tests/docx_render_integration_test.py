import os
from pathlib import Path
import tempfile
import unittest
import zipfile

from docx_render_runtime_test import RENDER_DOCX


def write_minimal_docx(path: Path) -> None:
    content_types = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""
    relationships = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""
    document = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Managed renderer integration check</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>"""
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", relationships)
        archive.writestr("word/document.xml", document)


class DocxRenderIntegrationTest(unittest.TestCase):
    @unittest.skipUnless(
        os.environ.get("RUXEX_RUNTIME_ROOT") and os.environ.get("RUXEX_RUNTIME_BIN_DIR"),
        "release integration requires the assembled Ruxex runtime environment",
    )
    def test_bundled_office_and_poppler_render_a_real_docx(self):
        with tempfile.TemporaryDirectory(prefix="ruxex-docx-render-integration-") as temporary:
            root = Path(temporary)
            source = root / "report.docx"
            write_minimal_docx(source)
            pages = RENDER_DOCX.render(source, root / "pages", 72, keep_pdf=True)

            self.assertEqual(len(pages), 1)
            self.assertTrue((root / "pages/report.pdf").is_file())
            self.assertGreater((root / "pages/report.pdf").stat().st_size, 0)
            from PIL import Image

            with Image.open(pages[0]) as page:
                page.verify()
                self.assertGreater(page.width, 0)
                self.assertGreater(page.height, 0)


if __name__ == "__main__":
    unittest.main()
