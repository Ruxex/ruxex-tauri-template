"""ZIP/XML fixtures for portable plain-text content-control authoring."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
from xml.etree import ElementTree as ET

SCRIPT = Path(__file__).parents[1] / 'skills/documents/scripts/content_controls.py'
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def run(text):
    return f'<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{text}</w:t></w:r>'


class ContentControlsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'source.docx'
        self.output = Path(self.temp.name) / 'wrapped.docx'
        self.parts = {
            'word/header1.xml': f'<w:hdr xmlns:w="{W[1:-1]}"><w:p>{run("{{HEADER}}")}</w:p><w:sdt><w:sdtPr><w:tag w:val="OLD"/><w:id w:val="1"/><w:text/></w:sdtPr><w:sdtContent>{run("Old")}</w:sdtContent></w:sdt></w:hdr>'.encode(),
            '[Content_Types].xml': b'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
            'word/media/image.bin': b'unchanged binary',
        }

    def source_with(self, body):
        self.parts['word/document.xml'] = f'<w:document xmlns:w="{W[1:-1]}"><w:body>{body}<w:sectPr/></w:body></w:document>'.encode()
        with zipfile.ZipFile(self.source, 'w') as archive:
            for name, data in self.parts.items():
                archive.writestr(name, data)
        return self.source.read_bytes()

    def invoke(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], capture_output=True, text=True)

    def wrap(self):
        return self.invoke('wrap_placeholders', '--input', self.source, '--output', self.output)

    def test_wrap_preserves_visible_text_formatting_parts_and_unique_ids(self):
        original = self.source_with(f'<w:p><w:pPr><w:jc w:val="right"/></w:pPr>{run(" Before {{NAME}} and {{EMAIL}} after ")}</w:p><w:tbl><w:tr><w:tc><w:p>{run("{{TABLE}}")}</w:p></w:tc></w:tr></w:tbl>')
        result = self.wrap()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['matches'], 2)
        with zipfile.ZipFile(self.output) as archive:
            for name in self.parts.keys() - {'word/document.xml'}:
                self.assertEqual(archive.read(name), self.parts[name])
            root = ET.fromstring(archive.read('word/document.xml'))
        controls = root.findall(f'{W}body/{W}p/{W}sdt')
        self.assertEqual([c.find(f'{W}sdtPr/{W}tag').get(W+'val') for c in controls], ['NAME', 'EMAIL'])
        self.assertEqual([c.find(f'{W}sdtPr/{W}id').get(W+'val') for c in controls], ['2', '3'])
        self.assertEqual(''.join(t.text or '' for t in root.iter(W+'t')), ' Before {{NAME}} and {{EMAIL}} after {{TABLE}}')
        for control in controls:
            self.assertIsNotNone(control.find(f'{W}sdtPr/{W}text'))
            self.assertIsNotNone(control.find(f'{W}sdtContent/{W}r/{W}rPr/{W}b'))
        self.assertIsNotNone(root.find(f'{W}body/{W}p/{W}pPr/{W}jc'))
        text = root.find(f'{W}body/{W}p/{W}r/{W}t')
        self.assertEqual(text.get('{http://www.w3.org/XML/1998/namespace}space'), 'preserve')
        self.assertEqual(self.source.read_bytes(), original)
        other = self.output.with_name('second.docx')
        repeated = self.invoke('wrap_placeholders', '--input', self.source, '--output', other)
        self.assertEqual(repeated.returncode, 0, repeated.stderr)
        self.assertEqual(other.read_bytes(), self.output.read_bytes())

    def test_created_inline_control_can_be_listed_and_filled_without_nested_paragraph(self):
        self.source_with(f'<w:p>{run("Hello {{NAME}}!")}</w:p>')
        wrapped = self.wrap()
        self.assertEqual(wrapped.returncode, 0, wrapped.stderr)
        listing = self.invoke('list', '--input', self.output)
        self.assertEqual(listing.returncode, 0, listing.stderr)
        self.assertIn({'part': 'word/document.xml', 'tag': 'NAME', 'alias': 'NAME', 'type': 'plainText', 'text': '{{NAME}}'}, json.loads(listing.stdout)['controls'])
        filled = self.output.with_name('filled.docx')
        result = self.invoke('fill', '--input', self.output, '--output', filled, '--tag', 'NAME', '--value', ' Ada ')
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(filled) as archive:
            root = ET.fromstring(archive.read('word/document.xml'))
        content = root.find(f'{W}body/{W}p/{W}sdt/{W}sdtContent')
        self.assertIsNone(content.find(W+'p'))
        self.assertEqual(''.join(t.text or '' for t in root.iter(W+'t')), 'Hello  Ada !')

    def test_rejects_ambiguous_duplicate_unsupported_and_missing_markers_before_output(self):
        cases = [
            run('{{NAME}} {{NAME}}'), run('{{OLD}}'), run('{{bad tag}}'),
            run('{{{NAME}}}'), run('{{NAME'), run('NAME}}'),
            run('{{NA') + run('ME}}'),
            '<w:hyperlink>' + run('{{NAME}}') + '</w:hyperlink>',
            '<w:r><w:t>{{NAME}}</w:t><w:tab/></w:r>',
            run('No markers'),
        ]
        for body in cases:
            with self.subTest(body=body):
                original = self.source_with('<w:p>' + body + '</w:p>')
                result = self.wrap()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('error:', result.stderr)
                self.assertNotIn('invalid choice', result.stderr)
                self.assertFalse(self.output.exists())
                self.assertEqual(self.source.read_bytes(), original)

    def test_existing_controls_are_preserved_and_not_nested(self):
        existing = '<w:sdt><w:sdtPr><w:tag w:val="EXISTING"/><w:id w:val="7"/><w:text/></w:sdtPr><w:sdtContent>' + run('{{EXISTING}}') + '</w:sdtContent></w:sdt>'
        self.source_with('<w:p>' + existing + run('{{NEW}}') + '</w:p>')
        result = self.wrap()
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.output) as archive:
            root = ET.fromstring(archive.read('word/document.xml'))
        controls = root.findall(f'.//{W}sdt')
        self.assertEqual(len(controls), 2)
        self.assertFalse(any(c.find(f'.//{W}sdt') is not None for c in controls))

    def test_ids_avoid_numerically_equivalent_existing_ids(self):
        self.parts['word/header1.xml'] = self.parts['word/header1.xml'].replace(b'w:val="1"', b'w:val="+01"')
        self.source_with('<w:p>' + run('{{NAME}}') + '</w:p>')
        result = self.wrap()
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.output) as archive:
            root = ET.fromstring(archive.read('word/document.xml'))
        self.assertEqual(root.find(f'{W}body/{W}p/{W}sdt/{W}sdtPr/{W}id').get(W+'val'), '2')

    def test_refuses_overwrite_of_source_or_existing_output(self):
        self.source_with('<w:p>' + run('{{NAME}}') + '</w:p>')
        original = self.source.read_bytes()
        result = self.invoke('wrap_placeholders', '--input', self.source, '--output', self.source)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.source.read_bytes(), original)
        self.output.write_bytes(b'keep output')
        result = self.wrap()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.output.read_bytes(), b'keep output')


if __name__ == '__main__':
    unittest.main()
