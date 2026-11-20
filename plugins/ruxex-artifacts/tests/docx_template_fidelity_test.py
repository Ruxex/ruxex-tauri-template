import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).parents[1] / 'skills/documents/scripts/template_fidelity.py'


def load_helper():
    spec = importlib.util.spec_from_file_location('template_fidelity', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_docx(path, text='Template', header='Logo', extra=True):
    w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('word/document.xml', f'<w:document xmlns:w="{w}"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>')
        if extra:
            archive.writestr('word/header1.xml', f'<w:hdr xmlns:w="{w}"><w:p><w:r><w:t>{header}</w:t></w:r></w:p></w:hdr>')
        archive.writestr('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="header" Target="header1.xml"/></Relationships>')


class TemplateFidelityTest(unittest.TestCase):
    def setUp(self):
        self.helper = load_helper()
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'reference.docx'
        self.manifest = self.root / 'reference.json'
        self.final = self.root / 'final.docx'
        write_docx(self.source)
        self.helper.snapshot(self.source, self.manifest)

    def test_inventory_records_hash_parts_relationships_and_features(self):
        data = json.loads(self.manifest.read_text())
        self.assertEqual(len(data['source']['sha256']), 64)
        self.assertEqual(data['parts']['word/document.xml']['features']['sectPr'], 1)
        self.assertEqual(data['parts']['word/_rels/document.xml.rels']['relationships'][0]['Target'], 'header1.xml')

    def test_explicit_content_part_edit_preserves_other_parts(self):
        write_docx(self.final, text='New report')
        report = self.helper.verify(self.source, self.final, self.manifest, ['word/document.xml'])
        self.assertTrue(report['ok'])
        self.assertEqual(report['changedEditableParts'], ['word/document.xml'])

    def test_header_change_is_a_preservation_failure(self):
        write_docx(self.final, text='New report', header='Missing logo')
        report = self.helper.verify(self.source, self.final, self.manifest, ['word/document.xml'])
        self.assertFalse(report['ok'])
        self.assertIn('word/header1.xml', report['changedPreserveOnlyParts'])

    def test_reference_tamper_and_removed_parts_fail(self):
        write_docx(self.final, extra=False)
        report = self.helper.verify(self.source, self.final, self.manifest, ['word/document.xml'])
        self.assertFalse(report['ok'])
        self.assertEqual(report['removedParts'], ['word/header1.xml'])
        write_docx(self.source, text='Tampered')
        with self.assertRaisesRegex(ValueError, 'reference.*changed'):
            self.helper.verify(self.source, self.final, self.manifest, ['word/document.xml'])

    def test_unknown_editable_part_rejected(self):
        write_docx(self.final)
        with self.assertRaisesRegex(ValueError, 'editable part'):
            self.helper.verify(self.source, self.final, self.manifest, ['word/missing.xml'])


if __name__ == '__main__':
    unittest.main()
