from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from xml.etree import ElementTree as ET
import zipfile

SCRIPTS = Path(__file__).parents[1] / 'skills/documents/scripts'
SCRIPT = SCRIPTS / 'watermark_add.py'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P = 'http://schemas.openxmlformats.org/package/2006/relationships'
V = 'urn:schemas-microsoft-com:vml'


def fixture(path, headers=('header1.xml',), referenced=None, malformed=False):
    if referenced is None:
        referenced = headers
    references = ''.join(f'<w:headerReference w:type="default" r:id="rId{i}"/>' for i, _ in enumerate(referenced))
    relationships = ''.join(f'<Relationship Id="rId{i}" Type="{R}/header" Target="{name}"/>' for i, name in enumerate(referenced))
    with zipfile.ZipFile(path, 'w') as archive:
        archive.comment = b'Preserve archive comment'
        archive.writestr('word/document.xml', f'<w:document xmlns:w="{W}" xmlns:r="{R}"><w:body><w:sectPr>{references}</w:sectPr></w:body></w:document>')
        archive.writestr('word/_rels/document.xml.rels', f'<Relationships xmlns="{P}">{relationships}</Relationships>')
        for name in headers:
            info = zipfile.ZipInfo('word/' + name, (2020, 1, 2, 3, 4, 6))
            info.comment = b'part comment'
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, b'<bad' if malformed else f'<w:hdr xmlns:w="{W}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14"><!--keep--><w:p><w:r><w:t>Company header</w:t></w:r></w:p></w:hdr>'.encode())
        archive.writestr('customXml/opaque.bin', b'\x00opaque\xff')


class WatermarkTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'source.docx'
        self.output = Path(self.temp.name) / 'output.docx'

    def run_helper(self, *args):
        return subprocess.run([sys.executable, '-S', str(SCRIPT), '--input', str(self.source), '--output', str(self.output), '--text', 'DRAFT & <private>', *args], capture_output=True, text=True)

    def test_adds_discoverable_watermark_preserving_package_and_header_content(self):
        fixture(self.source)
        original = self.source.read_bytes()
        result = self.run_helper()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.source.read_bytes(), original)
        with zipfile.ZipFile(self.source) as before, zipfile.ZipFile(self.output) as after:
            self.assertEqual(before.namelist(), after.namelist())
            self.assertEqual(before.comment, after.comment)
            for info in before.infolist():
                other = after.getinfo(info.filename)
                for field in ('date_time', 'compress_type', 'comment', 'extra', 'external_attr'):
                    self.assertEqual(getattr(info, field), getattr(other, field))
                if info.filename != 'word/header1.xml':
                    self.assertEqual(before.read(info), after.read(info.filename))
            header = after.read('word/header1.xml')
            root = ET.fromstring(header)
            self.assertEqual(root.find(f'.//{{{V}}}shape/{{{V}}}textpath').get('string'), 'DRAFT & <private>')
            self.assertEqual(root.find(f'.//{{{W}}}t').text, 'Company header')
            self.assertIn(b'<!--keep-->', header)
            self.assertIn(b'xmlns:w14=', header)
        removed = Path(self.temp.name) / 'removed.docx'
        result = subprocess.run([sys.executable, str(SCRIPTS / 'remove_publishing_controls.py'), '--input', str(self.output), '--output', str(removed), '--kind', 'watermark', '--text', 'DRAFT & <private>'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(removed) as archive:
            self.assertIsNone(ET.fromstring(archive.read('word/header1.xml')).find(f'.//{{{V}}}textpath'))

    def test_ambiguous_headers_require_explicit_target(self):
        fixture(self.source, ('header1.xml', 'header2.xml'))
        result = self.run_helper()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('multiple', result.stderr)
        self.assertFalse(self.output.exists())
        result = self.run_helper('--header-part', 'word/header2.xml')
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.source) as before, zipfile.ZipFile(self.output) as after:
            self.assertEqual(before.read('word/header1.xml'), after.read('word/header1.xml'))
            self.assertIn(b'DRAFT', after.read('word/header2.xml'))

    def test_no_usable_or_malformed_header_leaves_no_output(self):
        for kwargs in ({'headers': ()}, {'referenced': ()}, {'malformed': True}, {'referenced': ('missing.xml',)}):
            with self.subTest(kwargs=kwargs):
                fixture(self.source, **kwargs)
                result = self.run_helper()
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.output.exists())

    def test_unreferenced_explicit_target_is_rejected(self):
        fixture(self.source, ('header1.xml', 'header2.xml'), ('header1.xml',))
        result = self.run_helper('--header-part', 'word/header2.xml')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('referenced', result.stderr)
        self.assertFalse(self.output.exists())

    def test_rejects_invalid_header_roots_external_targets_and_duplicate_parts(self):
        for case in ('wrong-root', 'external', 'duplicate'):
            with self.subTest(case=case):
                fixture(self.source)
                with zipfile.ZipFile(self.source) as archive:
                    entries = [(info, archive.read(info)) for info in archive.infolist()]
                with zipfile.ZipFile(self.source, 'w') as archive:
                    for info, content in entries:
                        if case == 'wrong-root' and info.filename == 'word/header1.xml':
                            content = f'<w:document xmlns:w="{W}"/>'.encode()
                        if case == 'external' and info.filename.endswith('.rels'):
                            content = content.replace(b' Target=', b' TargetMode="External" Target=')
                        archive.writestr(info, content)
                    if case == 'duplicate':
                        import warnings
                        with warnings.catch_warnings():
                            warnings.simplefilter('ignore', UserWarning)
                            archive.writestr('word/header1.xml', b'duplicate')
                result = self.run_helper()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('error:', result.stderr)
                self.assertFalse(self.output.exists())

    def test_empty_or_invalid_xml_label_is_rejected(self):
        fixture(self.source)
        for text in ('   ', '\x01'):
            with self.subTest(text=text):
                result = self.run_helper('--text', text)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('valid XML text', result.stderr)
                self.assertFalse(self.output.exists())

    def test_existing_output_and_source_are_never_overwritten(self):
        fixture(self.source)
        self.output.write_bytes(b'keep existing')
        result = self.run_helper()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.output.read_bytes(), b'keep existing')
        original = self.source.read_bytes()
        result = self.run_helper('--output', str(self.source))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.source.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
