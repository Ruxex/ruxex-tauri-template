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
            self.assertTrue((skill_dir / "agents/ruxex.yaml").is_file())
            self.assertFalse((skill_dir / "agents/openai.yaml").exists())

    def test_each_skill_has_ruxex_interface_metadata_without_bundled_icons(self) -> None:
        for skill_name in SKILL_NAMES:
            skill_dir = SKILLS_ROOT / skill_name
            metadata = (skill_dir / "agents/ruxex.yaml").read_text(
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
            self.assertIn("absolute path to this `SKILL.md`", skill)
            self.assertIn('"/absolute/path/to/skill/ruxex-artifacts" run', skill)
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

    def test_presentation_skill_covers_codex_quality_workflow_without_hosted_routes(self) -> None:
        skill = (SKILLS_ROOT / "presentations" / "SKILL.md").read_text(
            encoding="utf-8",
        ).lower()
        for phrase in (
            "read-only",
            "existing deck",
            "template",
            "factual claims",
            "speaker notes",
            "slide count",
            "pixel",
            "local images",
            "native charts",
            "editable",
            "diagnostics",
            "api-compatibility.md",
            "package structure",
            "pixel-accurate slide rendering",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, skill)
        self.assertNotIn("google slides", skill)
        self.assertNotIn("artifact session", skill)

    def test_spreadsheet_skill_covers_codex_quality_guidance(self) -> None:
        skill_dir = SKILLS_ROOT / "spreadsheets"
        skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("workflows/verification.md", skill)
        self.assertIn("references/formula_guidance.md", skill)
        self.assertIn("references/template_workflow.md", skill)

        required_files = (
            "workflows/verification.md",
            "references/formula_guidance.md",
            "references/template_workflow.md",
        )
        for relative_path in required_files:
            with self.subTest(file=relative_path):
                self.assertTrue((skill_dir / relative_path).is_file())

        template = (skill_dir / "references/template_workflow.md").read_text(encoding="utf-8").lower()
        for phrase in (
            "screenshot and image references",
            "formula-derived",
            "antialiasing",
            "preserve numeric and date values",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, template)

        formulas = (skill_dir / "references/formula_guidance.md").read_text(encoding="utf-8").lower()
        for phrase in (
            "duplicate keys",
            "blank versus zero",
            "one-time override",
            "do not blanket-wrap",
            "flow",
            "stock",
            "terminal",
            "evaluates both branches of `if`",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, formulas)

        verification = (skill_dir / "workflows/verification.md").read_text(encoding="utf-8").lower()
        for phrase in (
            "first, middle, and last",
            "next period",
            "duplicate keys",
            "blank versus zero",
            "reconciliation",
            "chart",
            "cached formula values",
            "structural file check",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, verification)

        charts = (skill_dir / "features/charts.md").read_text(encoding="utf-8").lower()
        for phrase in (
            "missing observations blank",
            "point counts",
            "baseline",
            "units",
            "category and value ranges aligned",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, charts)

        finance = (skill_dir / "domain_guidance/financial_models.md").read_text(encoding="utf-8").lower()
        for phrase in (
            "retained earnings",
            "accumulated depreciation",
            "favorable/unfavorable",
            "terminal-value method",
            "finance checks",
            "pressure point",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, finance)

        style = (skill_dir / "style_guidelines.md").read_text(encoding="utf-8").lower()
        for phrase in (
            "selected case",
            "active assumption row",
            "dark, high-contrast header",
            "gridline visibility",
            "tab colors",
            "internal file paths",
            "required user actions",
            "generic disclaimers",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, style)

        design = (skill_dir / "references/workbook_design.md").read_text(encoding="utf-8").lower()
        self.assertIn("terminal review outputs", design)
        self.assertIn("no assumption, build, summary", design)

    def test_spreadsheet_edit_workflow_warns_about_cached_results_and_xlsx_fidelity(self) -> None:
        skill_dir = SKILLS_ROOT / "spreadsheets"
        edit = (skill_dir / "workflows/edit_workflows.md").read_text(encoding="utf-8").lower()
        for phrase in (
            "cached formula results",
            "unsupported formulas",
            "styles",
            "charts",
            "images",
            "do not round-trip",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, edit)


if __name__ == "__main__":
    unittest.main()
