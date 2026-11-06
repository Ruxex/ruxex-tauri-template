import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ReleaseBoundaryTests(unittest.TestCase):
    def test_normal_config_selects_only_default_capability(self):
        config = json.loads((ROOT / "src-tauri/tauri.conf.json").read_text())
        self.assertEqual(config["app"]["security"]["capabilities"], ["default"])
        self.assertNotIn("withGlobalTauri", config["app"])

    def test_e2e_overlay_selects_e2e_capability_and_global_api(self):
        overlay = json.loads((ROOT / "src-tauri/tauri.e2e.conf.json").read_text())
        self.assertTrue(overlay["app"]["withGlobalTauri"])
        self.assertEqual(
            overlay["app"]["security"]["capabilities"], ["default", "e2e"]
        )

        capability = json.loads((ROOT / "src-tauri/capabilities/e2e.json").read_text())
        self.assertEqual(capability["identifier"], "e2e")
        self.assertIn("wdio:allow-execute", capability["permissions"])
        self.assertIn("wdio:allow-log-frontend", capability["permissions"])
        self.assertNotIn("shell:default", capability["permissions"])

    def test_rust_plugin_is_debug_only(self):
        cargo = (ROOT / "src-tauri/Cargo.toml").read_text()
        self.assertRegex(
            cargo,
            r"e2e\s*=\s*\[[^\]]*dep:tauri-plugin-wdio",
        )
        self.assertRegex(cargo, r"tauri-plugin-wdio\s*=\s*\{[^}]*optional\s*=\s*true")

        source = (ROOT / "src-tauri/src/lib.rs").read_text()
        self.assertRegex(
            source,
            r"#\[cfg\(feature\s*=\s*\"e2e\"\)\][\s\S]*?tauri_plugin_wdio::init\(\)",
        )

    def test_cargo_run_defaults_to_the_desktop_binary(self):
        cargo = (ROOT / "src-tauri/Cargo.toml").read_text()
        self.assertRegex(cargo, r"default-run\s*=\s*\"ruxex-desktop\"")

    def test_frontend_plugin_import_is_guarded_by_e2e_flag(self):
        source = (ROOT / "src/main.tsx").read_text()
        self.assertRegex(source, r"VITE_E2E_PLUGIN\s*===\s*[\"']1[\"']")
        self.assertIn("@wdio/tauri-plugin", source)


if __name__ == "__main__":
    unittest.main()
