import json
import os
import re
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib
import zipfile
from pathlib import Path

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches


ROOT = Path(__file__).parents[1]
SCRIPTS = ROOT / "skills" / "presentations" / "scripts"
REPO_ROOT = ROOT.parent.parent
ARTIFACT_CLI = REPO_ROOT / "target" / "debug" / "ruxex-artifacts"
HELPERS = {
    "inspect_template_deck.py": "inspect-template",
    "validate_template_plan.py": "validate-template-plan",
    "check_template_fidelity.py": "check-template-fidelity",
    "prepare_template_starter_deck.py": "prepare-template-starter-deck",
    "inspect_presentation_package_integrity.py": "inspect-package-integrity",
    "inspect_presentation_layout_geometry.py": "inspect-layout-geometry",
    "native_chart_title_gate.py": "native-chart-title-gate",
    "native_quantitative_chart_gate.py": "native-quantitative-chart-gate",
    "native_table_arithmetic_gate.py": "native-table-arithmetic-gate",
    "render_slides.py": "render-slides",
    "make_contact_sheet.py": "make-contact-sheet",
}


class PresentationSkillToolsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.source = self.directory / "source.pptx"
        self.output = self.directory / "output.pptx"
        self._make_deck(self.source)
        self._make_deck(self.output)

    def _make_deck(self, path: Path, *, chart_title: str | None = None) -> None:
        deck = Presentation()
        slide = deck.slides.add_slide(deck.slide_layouts[6])
        title = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(6), Inches(1))
        title.text = "Quarterly review"
        table = slide.shapes.add_table(4, 2, Inches(1), Inches(2), Inches(5), Inches(2)).table
        for row_index, values in enumerate((("Item", "Value"), ("A", "10"), ("B", "15"), ("Total", "25"))):
            for column_index, value in enumerate(values):
                table.cell(row_index, column_index).text = value
        data = CategoryChartData()
        data.categories = ["A", "B"]
        data.add_series("Revenue", (10, 15))
        chart = slide.shapes.add_chart(
            XL_CHART_TYPE.COLUMN_CLUSTERED,
            Inches(7), Inches(1), Inches(4), Inches(3), data,
        ).chart
        if chart_title is not None:
            chart.has_title = True
            chart.chart_title.text_frame.text = chart_title
        deck.save(path)

    def _run(self, script: str, *args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(ARTIFACT_CLI), "pptx", "helper", HELPERS[script], *map(str, args)],
            capture_output=True,
            text=True,
            check=False,
            env=env,
        )

    def test_presentation_skill_has_no_python_runtime_or_helper_files(self) -> None:
        skill_root = ROOT / "skills" / "presentations"
        documents = "\n".join(path.read_text(encoding="utf-8") for path in skill_root.rglob("*.md"))
        self.assertNotIn("ruxex-artifacts python", documents)
        self.assertFalse(list((skill_root / "scripts").glob("*.py")))

    def test_template_inspector_returns_slide_and_shape_inventory(self) -> None:
        result = self._run("inspect_template_deck.py", "--input", str(self.source))
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["slideCount"], 1)
        self.assertGreaterEqual(report["slides"][0]["shapeCount"], 3)
        self.assertEqual(report["slides"][0]["text"], ["Quarterly review", "Item", "Value", "A", "10", "B", "15", "Total", "25"])

    def test_template_plan_validation_checks_one_based_source_slide(self) -> None:
        plan = self.directory / "plan.json"
        plan.write_text(json.dumps({"slides": [{"sourceSlide": 1, "outputSlide": 1, "action": "reuse"}]}))
        good = self._run("validate_template_plan.py", "--input", str(self.source), "--plan", str(plan))
        self.assertEqual(good.returncode, 0, good.stderr)
        self.assertTrue(json.loads(good.stdout)["valid"])

        plan.write_text(json.dumps({"slides": [{"sourceSlide": 2, "outputSlide": 1, "action": "reuse"}]}))
        bad = self._run("validate_template_plan.py", "--input", str(self.source), "--plan", str(plan))
        self.assertEqual(bad.returncode, 1)
        self.assertFalse(json.loads(bad.stdout)["valid"])

        plan.write_text(json.dumps({"slides": [{"sourceSlide": 1, "action": "omit"}]}))
        omitted = self._run("validate_template_plan.py", "--input", str(self.source), "--plan", str(plan))
        self.assertEqual(omitted.returncode, 0, omitted.stderr)
        self.assertTrue(json.loads(omitted.stdout)["valid"])

        plan.write_text(json.dumps({"slides": [{"sourceSlide": 1, "outputSlide": 2, "action": "reuse"}]}))
        gap = self._run("validate_template_plan.py", "--input", str(self.source), "--plan", str(plan))
        self.assertEqual(gap.returncode, 1)
        self.assertFalse(json.loads(gap.stdout)["valid"])

    def test_template_fidelity_reports_structural_deltas(self) -> None:
        result = self._run("check_template_fidelity.py", "--source", str(self.source), "--output", str(self.output))
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["slideCountDelta"], 0)
        self.assertEqual(report["slides"][0]["shapeCountDelta"], 0)

    def test_template_starter_creates_a_cleared_copy_without_touching_source(self) -> None:
        from PIL import Image

        source_shape_count = len(Presentation(self.source).slides[0].shapes)
        starter = self.directory / "starter.pptx"
        result = self._run("prepare_template_starter_deck.py", "--input", str(self.source), "--output", str(starter))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(starter.is_file())
        self.assertEqual(len(Presentation(self.source).slides[0].shapes), source_shape_count)
        self.assertEqual(len(Presentation(starter).slides[0].shapes), 0)
        refused = self._run("prepare_template_starter_deck.py", "--input", str(self.source), "--output", str(starter))
        self.assertEqual(refused.returncode, 1)
        self.assertIn("refusing to overwrite", refused.stderr)

        templated = Presentation()
        slide = templated.slides.add_slide(templated.slide_layouts[0])
        slide.shapes.title.text = "Old title"
        slide.placeholders[1].text = "Old subtitle"
        slide.notes_slide.notes_text_frame.text = "Old note"
        source_with_placeholders = self.directory / "template-content.pptx"
        templated.save(source_with_placeholders)
        clean_starter = self.directory / "template-starter.pptx"
        cleared = self._run("prepare_template_starter_deck.py", "--input", str(source_with_placeholders), "--output", str(clean_starter))
        self.assertEqual(cleared.returncode, 0, cleared.stderr)
        result_deck = Presentation(clean_starter)
        self.assertEqual(result_deck.slides[0].shapes.title.text, "")
        self.assertEqual(result_deck.slides[0].placeholders[1].text, "")
        self.assertEqual(result_deck.slides[0].notes_slide.notes_text_frame.text, "")

        picture_deck = Presentation()
        picture_slide = picture_deck.slides.add_slide(picture_deck.slide_layouts[8])
        picture_path = self.directory / "picture.png"
        Image.new("RGB", (12, 12), "red").save(picture_path)
        picture_slide.placeholders[1].insert_picture(str(picture_path))
        picture_source = self.directory / "picture-template.pptx"
        picture_deck.save(picture_source)
        picture_starter = self.directory / "picture-starter.pptx"
        picture_result = self._run("prepare_template_starter_deck.py", "--input", str(picture_source), "--output", str(picture_starter))
        self.assertEqual(picture_result.returncode, 0, picture_result.stderr)
        from pptx.enum.shapes import PP_PLACEHOLDER

        self.assertFalse(any(
            shape.is_placeholder and shape.placeholder_format.type == PP_PLACEHOLDER.PICTURE
            for shape in Presentation(picture_starter).slides[0].shapes
        ))

    def test_package_integrity_accepts_valid_pptx_and_rejects_non_zip(self) -> None:
        valid = self._run("inspect_presentation_package_integrity.py", "--input", str(self.source))
        self.assertEqual(valid.returncode, 0, valid.stderr)
        self.assertTrue(json.loads(valid.stdout)["valid"])

        invalid_path = self.directory / "broken.pptx"
        invalid_path.write_text("not a package")
        invalid = self._run("inspect_presentation_package_integrity.py", "--input", str(invalid_path))
        self.assertEqual(invalid.returncode, 1)

        without_root_relationship = self.directory / "missing-root-rels.pptx"
        with zipfile.ZipFile(self.source) as original, zipfile.ZipFile(without_root_relationship, "w") as modified:
            for item in original.infolist():
                if item.filename != "_rels/.rels":
                    modified.writestr(item, original.read(item.filename))
        missing_root = self._run("inspect_presentation_package_integrity.py", "--input", str(without_root_relationship))
        self.assertEqual(missing_root.returncode, 1)
        self.assertIn("_rels/.rels", json.loads(missing_root.stdout)["missingRequiredParts"])

    def test_package_integrity_resolves_absolute_relationship_targets_from_package_root(self) -> None:
        absolute_target = self.directory / "absolute-target.pptx"
        with zipfile.ZipFile(self.source) as original, zipfile.ZipFile(absolute_target, "w") as modified:
            relationship_name = "ppt/_rels/presentation.xml.rels"
            relationships = original.read(relationship_name)
            targets = re.findall(rb'Target="([^"]+)"', relationships)
            relative_target = next(target for target in targets if b":" not in target and not target.startswith(b"/"))
            updated = relationships.replace(
                b'Target="' + relative_target + b'"',
                b'Target="/ppt/' + relative_target + b'"',
                1,
            )
            self.assertNotEqual(updated, relationships)
            for item in original.infolist():
                content = updated if item.filename == relationship_name else original.read(item.filename)
                modified.writestr(item, content)
        result = self._run("inspect_presentation_package_integrity.py", "--input", str(absolute_target))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(json.loads(result.stdout)["valid"])

    def test_layout_geometry_reports_out_of_bounds_shapes(self) -> None:
        deck = Presentation(self.source)
        deck.slides[0].shapes[0].left = Inches(-1)
        bad_path = self.directory / "out-of-bounds.pptx"
        deck.save(bad_path)
        result = self._run("inspect_presentation_layout_geometry.py", "--input", str(bad_path))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreaterEqual(json.loads(result.stdout)["outOfBoundsCount"], 1)

    def test_chart_title_gate_only_enforces_declared_slides(self) -> None:
        contracts = self.directory / "charts.json"
        contracts.write_text(json.dumps({"requiredTitles": [{"slide": 1}]}))
        failed = self._run("native_chart_title_gate.py", "--input", str(self.source), "--contracts", str(contracts))
        self.assertEqual(failed.returncode, 1)
        self._make_deck(self.output, chart_title="Revenue")
        passed = self._run("native_chart_title_gate.py", "--input", str(self.output), "--contracts", str(contracts))
        self.assertEqual(passed.returncode, 0, passed.stderr)

        deck = Presentation(self.output)
        chart = deck.slides[0].shapes[2].chart
        from pptx.oxml.ns import qn
        from pptx.oxml.xmlchemy import OxmlElement

        title = chart._element.find(f".//{qn('c:title')}")
        text_body = title.find(qn("c:tx"))
        for child in list(text_body):
            text_body.remove(child)
        string_ref = OxmlElement("c:strRef")
        formula = OxmlElement("c:f")
        formula.text = "Sheet1!$A$1"
        string_ref.append(formula)
        cache = OxmlElement("c:strCache")
        point = OxmlElement("c:pt")
        point.set("idx", "0")
        value = OxmlElement("c:v")
        value.text = "Revenue"
        point.append(value)
        cache.append(point)
        string_ref.append(cache)
        text_body.append(string_ref)
        linked_title = self.directory / "linked-chart-title.pptx"
        deck.save(linked_title)
        linked = self._run("native_chart_title_gate.py", "--input", str(linked_title), "--contracts", str(contracts))
        self.assertEqual(linked.returncode, 0, linked.stderr)

        axis_only = Presentation(self.source)
        axis_chart = axis_only.slides[0].shapes[2].chart
        axis_chart.value_axis.has_title = True
        axis_chart.value_axis.axis_title.text_frame.text = "USD"
        axis_only_path = self.directory / "axis-title-only.pptx"
        axis_only.save(axis_only_path)
        axis_result = self._run("native_chart_title_gate.py", "--input", str(axis_only_path), "--contracts", str(contracts))
        self.assertEqual(axis_result.returncode, 1)

    def test_quantitative_chart_gate_checks_declared_series_and_points(self) -> None:
        contracts = self.directory / "quantitative-charts.json"
        contracts.write_text(json.dumps({"charts": [{"slide": 1, "chart": 0, "seriesCount": 1, "minPointsPerSeries": 2}]}))
        passed = self._run("native_quantitative_chart_gate.py", "--input", str(self.source), "--contracts", str(contracts))
        self.assertEqual(passed.returncode, 0, passed.stderr)
        contracts.write_text(json.dumps({"charts": [{"slide": 1, "chart": 0, "seriesCount": 1, "minPointsPerSeries": 3}]}))
        failed = self._run("native_quantitative_chart_gate.py", "--input", str(self.source), "--contracts", str(contracts))
        self.assertEqual(failed.returncode, 1)

        deck = Presentation(self.source)
        chart = deck.slides[0].shapes[2].chart
        chart_node = chart._element.find("{http://schemas.openxmlformats.org/drawingml/2006/chart}chart")
        plot_area = chart_node.find("{http://schemas.openxmlformats.org/drawingml/2006/chart}plotArea")
        chart_type = next(child for child in plot_area if child.tag.endswith("barChart"))
        for series in chart_type.findall("{http://schemas.openxmlformats.org/drawingml/2006/chart}ser"):
            chart_type.remove(series)
        empty_path = self.directory / "empty-chart.pptx"
        deck.save(empty_path)
        contracts.write_text(json.dumps({"charts": [{"slide": 1, "minPointsPerSeries": 2}]}))
        empty = self._run("native_quantitative_chart_gate.py", "--input", str(empty_path), "--contracts", str(contracts))
        self.assertEqual(empty.returncode, 1)

    def test_table_arithmetic_gate_checks_declared_rows_and_reports_blanks(self) -> None:
        contracts = self.directory / "tables.json"
        contracts.write_text(json.dumps({"checks": [{"slide": 1, "table": 0, "row": 3, "column": 1, "sumRows": [1, 2]}]}))
        passed = self._run("native_table_arithmetic_gate.py", "--input", str(self.source), "--contracts", str(contracts))
        self.assertEqual(passed.returncode, 0, passed.stderr)
        self.assertTrue(json.loads(passed.stdout)["valid"])

        deck = Presentation(self.source)
        deck.slides[0].shapes[1].table.cell(3, 1).text = "26"
        mismatched = self.directory / "mismatched.pptx"
        deck.save(mismatched)
        failed = self._run("native_table_arithmetic_gate.py", "--input", str(mismatched), "--contracts", str(contracts))
        self.assertEqual(failed.returncode, 1)

        deck.slides[0].shapes[1].table.cell(2, 1).text = ""
        blank_path = self.directory / "blank-value.pptx"
        deck.save(blank_path)
        skipped = self._run("native_table_arithmetic_gate.py", "--input", str(blank_path), "--contracts", str(contracts))
        self.assertEqual(skipped.returncode, 0, skipped.stderr)
        self.assertEqual(json.loads(skipped.stdout)["results"][0]["status"], "skipped")

    def test_contact_sheet_writes_requested_image(self) -> None:
        from PIL import Image

        image_path = self.directory / "slide.png"
        Image.new("RGB", (160, 90), "white").save(image_path)
        output = self.directory / "contact.png"
        result = self._run("make_contact_sheet.py", "--image", str(image_path), "--output", str(output))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(output.is_file())
        self.assertEqual(json.loads(result.stdout)["imageCount"], 1)

    def test_pptx_renderer_refuses_to_search_host_path_for_tools(self) -> None:
        result = self._run("render_slides.py", "--input", str(self.source), "--output-dir", str(self.directory / "rendered"))
        self.assertEqual(result.returncode, 1)
        self.assertIn("packaged native runtime could not be located", result.stderr)

    def test_pptx_renderer_uses_packaged_tool_paths_and_writes_page_images(self) -> None:
        runtime_root = self.directory / "ruxex-resources"
        bin_dir = runtime_root / "bin/override"
        bin_dir.mkdir(parents=True)
        soffice = bin_dir / "soffice"
        soffice.write_text(
            f"#!{sys.executable}\n"
            "import pathlib, sys\n"
            "args = sys.argv[1:]\n"
            "out = pathlib.Path(args[args.index('--outdir') + 1])\n"
            "source = pathlib.Path(args[-1])\n"
            "(out / (source.stem + '.pdf')).write_bytes(b'%PDF-mock')\n",
        )
        pdftoppm = bin_dir / "pdftoppm"
        pdftoppm.write_text(
            f"#!{sys.executable}\n"
            "import pathlib, struct, sys, zlib\n"
            "def chunk(kind, data):\n"
            "    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)\n"
            "def png(path):\n"
            "    raw = b'\\x00\\xff\\xff\\xff'\n"
            "    data = b'\\x89PNG\\r\\n\\x1a\\n' + chunk(b'IHDR', struct.pack('!2I5B', 1, 1, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')\n"
            "    pathlib.Path(path).write_bytes(data)\n"
            "prefix = pathlib.Path(sys.argv[-1])\n"
            "png(str(prefix) + '-1.png')\n"
            "png(str(prefix) + '-2.png')\n",
        )
        soffice.chmod(0o755)
        pdftoppm.chmod(0o755)
        env = os.environ.copy()
        env["RUXEX_RUNTIME_ROOT"] = str(runtime_root)
        env["RUXEX_RUNTIME_BIN_DIR"] = str(bin_dir)
        output = self.directory / "rendered"
        result = self._run("render_slides.py", "--input", str(self.source), "--output-dir", str(output), env=env)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["slideCount"], 2)
        self.assertTrue((output / "slide-001.png").is_file())
        self.assertTrue((output / "slide-002.png").is_file())


if __name__ == "__main__":
    unittest.main()
