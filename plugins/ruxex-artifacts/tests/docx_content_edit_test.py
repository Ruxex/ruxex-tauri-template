"""Package-level regression tests for local DOCX content edits."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
from xml.etree import ElementTree as ET

SCRIPTS = Path(__file__).parents[1] / 'skills/documents/scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('edit_docx_content', SCRIPTS / 'edit_docx_content.py')
edit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(edit)
W = edit.W


def paragraph(text):
    return f'<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>{text}</w:t></w:r></w:p>'


def table():
    rows = ''.join('<w:tr>' + ('<w:trPr><w:tblHeader/></w:trPr>' if i == 0 else '') + ''.join(
        f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/></w:tcPr>{paragraph(value)}</w:tc>'
        for width, value in zip((2000, 4000), values)) + '</w:tr>'
        for i, values in enumerate((('A', 'B'), ('C', 'D'))))
    return '<w:tbl><w:tblPr><w:tblW w:w="6000" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="4000"/></w:tblGrid>' + rows + '</w:tbl>'


class DocxContentEditTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'source.docx'
        self.out = Path(self.temp.name) / 'edited.docx'
        self.parts = {
            'word/document.xml': f'<w:document xmlns:w="{edit.W_URI}"><w:body>{paragraph("Shared")}{table()}<w:sectPr/></w:body></w:document>'.encode(),
            'word/header1.xml': f'<w:hdr xmlns:w="{edit.W_URI}">{paragraph("Shared")}{table()}</w:hdr>'.encode(),
            'word/footer1.xml': f'<w:ftr xmlns:w="{edit.W_URI}">{paragraph("Shared")}</w:ftr>'.encode(),
            'word/_rels/header1.xml.rels': b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
            '[Content_Types].xml': b'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
        }
        self.write_source()

    def write_source(self):
        with zipfile.ZipFile(self.source, 'w') as archive:
            for name, content in self.parts.items():
                archive.writestr(name, content)

    def apply(self, operations):
        edit.edit_docx(self.source, self.out, operations)
        with zipfile.ZipFile(self.out) as archive:
            return {name: archive.read(name) for name in archive.namelist()}

    def test_part_selectors_format_header_footer_and_replace_header_cell(self):
        result = self.apply([
            {'op': 'format_paragraph', 'part': 'header1', 'contains': 'Shared', 'alignment': 'center'},
            {'op': 'format_run', 'part': 'footer1', 'contains': 'Shared', 'italic': True},
            {'op': 'replace_table_cell_text', 'part': 'header1', 'tableIndex': 0, 'row': 1, 'column': 0, 'text': 'Ready'},
        ])
        header = ET.fromstring(result['word/header1.xml'])
        self.assertEqual(header.find(f'{W}p/{W}pPr/{W}jc').get(W+'val'), 'center')
        self.assertIn('Ready', ''.join(header.itertext()))
        footer = ET.fromstring(result['word/footer1.xml'])
        self.assertEqual(footer.find(f'{W}p/{W}r/{W}rPr/{W}i').get(W+'val'), '1')
        for name in ('word/document.xml', 'word/_rels/header1.xml.rels', '[Content_Types].xml'):
            self.assertEqual(result[name], self.parts[name])

    def test_explicit_run_color_and_font_remove_theme_overrides(self):
        self.parts['word/document.xml'] = self.parts['word/document.xml'].replace(
            b'<w:rPr><w:b/></w:rPr>',
            b'<w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" '
            b'w:eastAsiaTheme="minorEastAsia" w:cstheme="minorBidi"/>'
            b'<w:color w:val="123456" w:themeColor="accent1" w:themeTint="99" w:themeShade="88"/>'
            b'<w:b/></w:rPr>',
            1,
        )
        self.write_source()
        result = self.apply([{'op': 'format_run', 'contains': 'Shared', 'fontFace': 'Arial', 'color': '000000'}])
        root = ET.fromstring(result['word/document.xml'])
        run_properties = root.find(f'{W}body/{W}p/{W}r/{W}rPr')
        fonts = run_properties.find(W + 'rFonts')
        color = run_properties.find(W + 'color')
        for attribute in ('asciiTheme', 'hAnsiTheme', 'eastAsiaTheme', 'cstheme'):
            self.assertIsNone(fonts.get(W + attribute))
        for attribute in ('themeColor', 'themeTint', 'themeShade'):
            self.assertIsNone(color.get(W + attribute))
        self.assertEqual(fonts.get(W + 'ascii'), 'Arial')
        self.assertEqual(color.get(W + 'val'), '000000')

    def test_rectangular_replacement_and_append_preserve_geometry_and_formats(self):
        result = self.apply([
            {'op': 'replace_table_rows', 'tableIndex': 0, 'rows': [['H1', 'H2'], ['V1', 'V2'], ['V3', 'V4']]},
            {'op': 'append_table_row', 'tableIndex': 0, 'values': ['End1', 'End2']},
        ])
        root = ET.fromstring(result['word/document.xml'])
        tbl = root.find(f'{W}body/{W}tbl')
        rows = tbl.findall(W+'tr')
        self.assertEqual([[ ''.join(cell.itertext()) for cell in row.findall(W+'tc')] for row in rows],
                         [['H1', 'H2'], ['V1', 'V2'], ['V3', 'V4'], ['End1', 'End2']])
        self.assertEqual([col.get(W+'w') for col in tbl.findall(f'{W}tblGrid/{W}gridCol')], ['2000', '4000'])
        for row in rows:
            self.assertEqual([cell.find(f'{W}tcPr/{W}tcW').get(W+'w') for cell in row.findall(W+'tc')], ['2000', '4000'])
            self.assertIsNotNone(row.find(f'{W}tc/{W}p/{W}r/{W}rPr/{W}b'))
        self.assertIsNotNone(rows[0].find(f'{W}trPr/{W}tblHeader'))
        self.assertTrue(all(row.find(f'{W}trPr/{W}tblHeader') is None for row in rows[1:]))

    def test_rectangular_replacement_can_delete_rows(self):
        result = self.apply([{'op': 'replace_table_rows', 'part': 'document', 'tableIndex': 0, 'rows': [['Only', 'Row']]}])
        root = ET.fromstring(result['word/document.xml'])
        rows = root.findall(f'{W}body/{W}tbl/{W}tr')
        self.assertEqual(len(rows), 1)
        self.assertEqual(''.join(rows[0].itertext()), 'OnlyRow')

    def test_structure_refuses_non_plain_cell_content(self):
        baseline = self.parts['word/document.xml']
        for unsafe in (b'<w:tab/>', b'<w:br/>', b'<w:customUnsupported/>'):
            with self.subTest(unsafe=unsafe):
                self.parts['word/document.xml'] = baseline.replace(b'<w:t>A</w:t>', unsafe, 1)
                self.write_source()
                with self.assertRaises(ValueError):
                    self.apply([{'op': 'replace_table_rows', 'tableIndex': 0, 'rows': [['E', 'F']]}])
                self.assertFalse(self.out.exists())

    def test_append_single_header_row_does_not_duplicate_header_flag(self):
        root = ET.fromstring(self.parts['word/document.xml'])
        tbl = root.find(f'{W}body/{W}tbl')
        tbl.remove(tbl.findall(W+'tr')[1])
        self.parts['word/document.xml'] = ET.tostring(root)
        self.write_source()
        result = self.apply([{'op': 'append_table_row', 'tableIndex': 0, 'values': ['E', 'F']}])
        rows = ET.fromstring(result['word/document.xml']).findall(f'{W}body/{W}tbl/{W}tr')
        self.assertIsNotNone(rows[0].find(f'{W}trPr/{W}tblHeader'))
        self.assertIsNone(rows[1].find(f'{W}trPr/{W}tblHeader'))

    def test_all_parts_preflight_before_creating_output(self):
        before = self.source.read_bytes()
        with self.assertRaises(ValueError):
            self.apply([{'op': 'format_run', 'part': 'header1', 'contains': 'Shared', 'italic': True},
                        {'op': 'append_table_row', 'tableIndex': 0, 'values': ['wrong width']}])
        self.assertFalse(self.out.exists())
        self.assertEqual(self.source.read_bytes(), before)

    def test_rejects_invalid_or_missing_parts_and_structural_header_edits(self):
        for part in ('../header1', 'header0', 'header2', 'footnotes', True):
            with self.subTest(part=part), self.assertRaises(ValueError):
                self.apply([{'op': 'format_run', 'part': part, 'contains': 'Shared', 'italic': True}])
            self.assertFalse(self.out.exists())
        with self.assertRaises(ValueError):
            self.apply([{'op': 'append_table_row', 'part': 'header1', 'tableIndex': 0, 'values': ['E', 'F']}])

    def test_structure_refuses_merges_relationships_and_ambiguous_geometry(self):
        baseline = self.parts['word/document.xml']
        variants = [
            baseline.replace(b'<w:tcPr>', b'<w:tcPr><w:gridSpan w:val="2"/>', 1),
            baseline.replace(b'<w:tr>', b'<w:tr><w:trPr><w:gridBefore w:val="1"/></w:trPr>', 1),
            baseline.replace(b'<w:t>A</w:t>', b'<w:drawing/>', 1),
            baseline.replace(b'<w:t>A</w:t>', b'<w:t xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1">A</w:t>', 1),
            baseline.replace(b'<w:gridCol w:w="4000"/>', b'', 1),
        ]
        for content in variants:
            with self.subTest(content=content):
                self.parts['word/document.xml'] = content
                self.write_source()
                with self.assertRaises(ValueError):
                    self.apply([{'op': 'append_table_row', 'tableIndex': 0, 'values': ['E', 'F']}])
                self.assertFalse(self.out.exists())

    def test_cell_replacement_refuses_relationship_markup_and_merged_row_indexes(self):
        baseline = self.parts['word/header1.xml']
        variants = [
            baseline.replace(b'<w:t>A</w:t>', b'<x:reference xmlns:x="urn:foreign"/>', 1),
            baseline.replace(b'<w:t>A</w:t>', b'<w:t xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1">A</w:t>', 1),
            baseline.replace(b'<w:tcPr>', b'<w:tcPr><w:gridSpan w:val="2"/>', 1),
        ]
        for index, content in enumerate(variants):
            with self.subTest(index=index):
                self.parts['word/header1.xml'] = content
                self.write_source()
                with self.assertRaises(ValueError):
                    self.apply([{'op': 'replace_table_cell_text', 'part': 'header1', 'tableIndex': 0,
                                 'row': 0, 'column': 1 if index == 2 else 0, 'text': 'E'}])
                self.assertFalse(self.out.exists())

    def test_invalid_rectangles_are_rejected(self):
        for rows in ([], [['one']], [['A', 'B'], ['C']], [['A', 2]], 'rows'):
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                self.apply([{'op': 'replace_table_rows', 'tableIndex': 0, 'rows': rows}])
            self.assertFalse(self.out.exists())


if __name__ == '__main__':
    unittest.main()
