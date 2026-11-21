import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
MANIFEST = ROOT / ".ruxex-plugin/plugin.json"
SKILLS_ROOT = ROOT / "skills"
SKILL_NAMES = {
    "documents": ("docx", "Document.create", "exportDocx", "word-skill.svg"),
    "presentations": (
        "pptx",
        "Presentation.create",
        "exportPptx",
        "presentation-skill.svg",
    ),
    "spreadsheets": ("xlsx", "Workbook.create", "exportXlsx", "excel-skill.svg"),
    "pdf": ("pdf", "PdfDocument.create", "exportPdf", "pdf-skill.svg"),
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

    def test_each_skill_uses_its_bundled_svg_logo(self) -> None:
        for skill_name, (_, _, _, expected_logo) in SKILL_NAMES.items():
            skill_dir = SKILLS_ROOT / skill_name
            metadata = (skill_dir / "agents/ruxex.yaml").read_text(
                encoding="utf-8",
            )
            self.assertIn("interface:", metadata)
            self.assertIn("display_name:", metadata)
            self.assertIn("short_description:", metadata)
            self.assertIn("icon_small:", metadata)
            self.assertIn("icon_large:", metadata)
            self.assertFalse((skill_dir / "assets/icon-small.svg").exists())
            self.assertFalse((skill_dir / "assets/icon-large.svg").exists())
            icon = metadata.split("icon_small:", 1)[1].splitlines()[0].strip().strip('"')
            large_icon = metadata.split("icon_large:", 1)[1].splitlines()[0].strip().strip('"')
            self.assertEqual(icon, large_icon)
            self.assertEqual(icon, f"./assets/{expected_logo}")
            self.assertTrue((skill_dir / icon.removeprefix("./")).is_file())
            self.assertTrue(icon.endswith(".svg"))

    def test_each_skill_uses_only_its_format_workflow(self) -> None:
        for skill_name, (format_name, constructor, export_method, _logo) in SKILL_NAMES.items():
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

            if skill_name != "presentations":
                self.assertNotIn("python", skill.lower())
            self.assertNotIn("pip", skill.lower())
            self.assertNotIn("npm", skill.lower())
            self.assertNotIn("excel", skill.lower())

    def test_presentation_skill_references_the_shared_runtime_contract(self) -> None:
        runtime_contract = SKILLS_ROOT / "RUNTIME.md"
        self.assertTrue(runtime_contract.is_file())
        contract = runtime_contract.read_text(encoding="utf-8").lower()
        for phrase in (
            "`node/`",
            "`native/`",
            "does not bundle cpython or python packages",
            "do not fall back to host tools",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, contract)

        skill = (SKILLS_ROOT / "presentations" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("../RUNTIME.md", skill)

    def test_document_skill_matches_portable_title_and_opening_guidance(self) -> None:
        skill = (SKILLS_ROOT / "documents" / "SKILL.md").read_text(encoding="utf-8").lower()
        for phrase in (
            "word's `title` paragraph style",
            "black",
            "underlining",
            "paragraph borders",
            "what the document covers",
            "why it matters",
            "main conclusion",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, skill)

    def test_document_workflows_use_rust_helpers_without_python_scripts(self) -> None:
        skill_dir = SKILLS_ROOT / "documents"
        for guide in sorted((skill_dir / "tasks").glob("*.md")):
            content = guide.read_text(encoding="utf-8").lower()
            with self.subTest(guide=guide.name):
                self.assertNotIn(".py", content)
                self.assertNotIn(" python ", content)
        self.assertFalse(list((skill_dir / "scripts").glob("*.py")))

        capability_source = (
            ROOT.parent.parent / "crates/artifact-engine/src/artifacts/cli.rs"
        ).read_text(encoding="utf-8")
        for operation in ("content-edit", "render", "compare"):
            with self.subTest(operation=operation):
                self.assertIn(f'"{operation}"', capability_source)

    def test_release_docx_render_integration_uses_rust_test_target(self) -> None:
        makefile = (ROOT.parent.parent / "Makefile").read_text(encoding="utf-8")
        runtime_ci = (
            ROOT.parent.parent / "scripts/ci_test_native_artifact_runtime.py"
        ).read_text(encoding="utf-8")
        self.assertIn("rust-test-docx-render-integration:", makefile)
        self.assertIn("rust-test-docx-render-integration", runtime_ci)
        self.assertNotIn("docx_render_integration_test.py", makefile)
        self.assertNotIn("docx_render_integration_test.py", runtime_ci)

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

    def test_presentation_skill_documents_template_and_quality_helpers(self) -> None:
        skill_dir = SKILLS_ROOT / "presentations"
        skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8").lower()
        for phrase in (
            "inspect-template",
            "validate-template-plan",
            "check-template-fidelity",
            "prepare-template-starter-deck",
            "inspect-package-integrity",
            "inspect-layout-geometry",
            "native-chart-title-gate",
            "native-quantitative-chart-gate",
            "native-table-arithmetic-gate",
            "make-contact-sheet",
        ):
            with self.subTest(helper=phrase):
                self.assertIn(phrase, skill)
        self.assertNotIn("ruxex-artifacts python", skill)
        self.assertFalse(list((skill_dir / "scripts").glob("*.py")))

        for relative_path in (
            "references/api-reference-map.md",
            "references/api-quick-start.md",
            "references/template-workflow.md",
            "references/native-evidence.md",
            "references/rendering-review.md",
            "references/writing-guidance.md",
            "references/accessibility-review.md",
        ):
            with self.subTest(guide=relative_path):
                self.assertTrue((skill_dir / relative_path).is_file())

    def test_presentation_reference_links_resolve_and_match_capability_index(self) -> None:
        skill_dir = SKILLS_ROOT / "presentations"
        markdown_files = sorted(skill_dir.rglob("*.md"))
        self.assertEqual(len(markdown_files), 34)
        for source in markdown_files:
            content = source.read_text(encoding="utf-8")
            for link in re.findall(r"\]\(([^)#]+\.md)(?:#[^)]*)?\)", content):
                with self.subTest(source=source.relative_to(skill_dir), link=link):
                    self.assertTrue((source.parent / link).is_file())

        capability_source = (
            ROOT.parent.parent / "crates/artifact-engine/src/artifacts/cli.rs"
        ).read_text(encoding="utf-8")
        self.assertIn('"domainGuidance": ["domain-guidance/finance.md"]', capability_source)

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
