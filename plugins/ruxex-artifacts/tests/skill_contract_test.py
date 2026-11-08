import json
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
MANIFEST = ROOT / ".ruxex-plugin/plugin.json"
SKILL = ROOT / "skills/ruxex-artifacts/SKILL.md"


class ArtifactSkillContractTest(unittest.TestCase):
    def test_manifest_declares_the_artifact_plugin(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(manifest["name"], "ruxex-artifacts")
        self.assertIn("skills", manifest)

    def test_skill_uses_the_bundled_command_and_validates_xlsx(self) -> None:
        skill = SKILL.read_text(encoding="utf-8")
        self.assertIn("ruxex-artifacts", skill)
        self.assertIn("ruxex-artifacts run", skill)
        self.assertIn("@ruxex/artifact-tool", skill)
        self.assertIn("Workbook.create", skill)
        self.assertIn("recalculate", skill)
        self.assertIn("inspect", skill)
        self.assertIn("exportXlsx", skill)
        self.assertIn("xlsx validate", skill)

    def test_skill_does_not_require_user_runtime_installations(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        for forbidden in ("python", "pip", "npm", "excel"):
            self.assertNotIn(forbidden, skill)


if __name__ == "__main__":
    unittest.main()
