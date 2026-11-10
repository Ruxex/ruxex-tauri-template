import json
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
MANIFEST = ROOT / ".ruxex-plugin/plugin.json"
SKILLS_ROOT = ROOT / "skills"
SKILL_NAMES = {
    "documents": ("docx", "Document.create", "exportDocx"),
    "presentations": ("pptx", "Presentation.create", "exportPptx"),
    "spreadsheets": ("xlsx", "Workbook.create", "exportXlsx"),
    "pdf": ("pdf", "PdfDocument.create", "exportPdf"),
}


class ArtifactSkillContractTest(unittest.TestCase):
    def test_manifest_declares_the_artifact_plugin(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(manifest["name"], "ruxex-artifacts")
        self.assertIn("skills", manifest)

    def test_exposes_codex_named_format_skills(self) -> None:
        self.assertFalse((SKILLS_ROOT / "ruxex-artifacts/SKILL.md").exists())
        for skill_name in SKILL_NAMES:
            skill_dir = SKILLS_ROOT / skill_name
            self.assertTrue((skill_dir / "SKILL.md").is_file())
            self.assertTrue((skill_dir / "agents/openai.yaml").is_file())

    def test_each_skill_has_interface_metadata_without_bundled_icons(self) -> None:
        for skill_name in SKILL_NAMES:
            skill_dir = SKILLS_ROOT / skill_name
            metadata = (skill_dir / "agents/openai.yaml").read_text(
                encoding="utf-8",
            )
            self.assertIn("interface:", metadata)
            self.assertIn("display_name:", metadata)
            self.assertIn("short_description:", metadata)
            self.assertNotIn("icon_small:", metadata)
            self.assertNotIn("icon_large:", metadata)
            self.assertFalse((skill_dir / "assets/icon-small.svg").exists())
            self.assertFalse((skill_dir / "assets/icon-large.svg").exists())

    def test_each_skill_uses_only_its_format_workflow(self) -> None:
        for skill_name, (format_name, constructor, export_method) in SKILL_NAMES.items():
            skill = (SKILLS_ROOT / skill_name / "SKILL.md").read_text(
                encoding="utf-8",
            )
            self.assertIn("ruxex-artifacts run", skill)
            self.assertIn("@ruxex/artifact-tool", skill)
            self.assertIn(constructor, skill)
            self.assertIn(export_method, skill)
            self.assertIn(f"{format_name} validate", skill)

            for other_format in {"docx", "pptx", "xlsx", "pdf"} - {format_name}:
                self.assertNotIn(f"{other_format} validate", skill)

            self.assertNotIn("python", skill.lower())
            self.assertNotIn("pip", skill.lower())
            self.assertNotIn("npm", skill.lower())
            self.assertNotIn("excel", skill.lower())


if __name__ == "__main__":
    unittest.main()
