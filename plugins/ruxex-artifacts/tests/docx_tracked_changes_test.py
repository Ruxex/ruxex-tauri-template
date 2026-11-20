"""Settings lifecycle tests for resolving tracked changes."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
from xml.etree import ElementTree as ET

SCRIPTS = Path(__file__).parents[1] / 'skills/documents/scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('process_tracked_changes', SCRIPTS / 'process_tracked_changes.py')
process_changes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(process_changes)
W = process_changes.W


class TrackedChangesSettingsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'source.docx'
        self.output = Path(self.temp.name) / 'resolved.docx'
        with zipfile.ZipFile(self.source, 'w') as archive:
            archive.writestr(
                'word/document.xml',
                f'<w:document xmlns:w="{process_changes.W[1:-1]}"><w:body>'
                '<w:p><w:ins w:id="1"><w:r><w:t>new</w:t></w:r></w:ins></w:p>'
                '<w:sectPr/></w:body></w:document>',
            )
            archive.writestr(
                'word/settings.xml',
                f'<w:settings xmlns:w="{process_changes.W[1:-1]}">'
                '<w:trackRevisions/><w:zoom w:percent="100"/></w:settings>',
            )
            archive.writestr('custom/data.bin', b'preserve')

    def output_parts(self):
        with zipfile.ZipFile(self.output) as archive:
            return {name: archive.read(name) for name in archive.namelist()}

    def test_resolving_revisions_disables_tracking_by_default(self):
        result = process_changes.process(self.source, self.output, 'accept')
        parts = self.output_parts()
        settings = ET.fromstring(parts['word/settings.xml'])
        self.assertIsNone(settings.find(W + 'trackRevisions'))
        self.assertIsNotNone(settings.find(W + 'zoom'))
        document = ET.fromstring(parts['word/document.xml'])
        self.assertIsNone(document.find(f'.//{W}ins'))
        self.assertIn('word/settings.xml', result['modifiedParts'])
        self.assertTrue(result['trackingDisabled'])
        self.assertEqual(parts['custom/data.bin'], b'preserve')

    def test_keep_tracking_on_preserves_settings_after_resolution(self):
        result = process_changes.process(self.source, self.output, 'accept', keep_tracking_on=True)
        settings = ET.fromstring(self.output_parts()['word/settings.xml'])
        self.assertIsNotNone(settings.find(W + 'trackRevisions'))
        self.assertFalse(result['trackingDisabled'])


if __name__ == '__main__':
    unittest.main()
