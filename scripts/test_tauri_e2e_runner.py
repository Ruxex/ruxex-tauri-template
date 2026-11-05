import json
import os
import tempfile
import unittest
from pathlib import Path

from scripts import tauri_e2e_runner


class TauriE2ERunnerTests(unittest.TestCase):
    def test_build_environment_isolates_home_provider_and_display_backend(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            home = Path(temp_dir) / "home"
            artifacts = Path(temp_dir) / "artifacts"
            base_env = {
                "HOME": "/home/developer",
                "RUXEX_HOME": "/home/developer/.ruxex",
                "RUXEX_PROVIDER": "cloudflare",
                "RUXEX_APP_SERVER_MODE": "inprocess",
                "OPENAI_API_KEY": "do-not-copy",
                "WAYLAND_DISPLAY": "wayland-0",
                "DISPLAY": ":0",
            }

            environment = tauri_e2e_runner.build_environment(
                base_env, home, artifacts
            )

            self.assertEqual(environment["HOME"], str(home))
            self.assertEqual(environment["RUXEX_HOME"], str(home / ".ruxex_desktop"))
            self.assertNotIn("RUXEX_PROVIDER", environment)
            self.assertEqual(environment["RUXEX_APP_SERVER_MODE"], "daemon")
            self.assertEqual(environment["GDK_BACKEND"], "x11")
            for name in (
                "XDG_CONFIG_HOME",
                "XDG_DATA_HOME",
                "XDG_CACHE_HOME",
                "XDG_STATE_HOME",
            ):
                self.assertTrue(environment[name].startswith(str(home)))
            self.assertEqual(environment["RUXEX_E2E_ARTIFACTS"], str(artifacts))

            auth_file = tauri_e2e_runner.prepare_dummy_provider_home(environment)
            self.assertEqual(
                json.loads(auth_file.read_text())["api_key"], "ruxex-e2e-dummy"
            )

    def test_build_wdio_command_adds_spec_only_when_requested(self):
        self.assertEqual(
            tauri_e2e_runner.build_wdio_command(),
            ["pnpm", "exec", "wdio", "run", "wdio.conf.ts"],
        )
        self.assertEqual(
            tauri_e2e_runner.build_wdio_command("e2e/desktop-smoke.spec.ts"),
            [
                "pnpm",
                "exec",
                "wdio",
                "run",
                "wdio.conf.ts",
                "--spec",
                "e2e/desktop-smoke.spec.ts",
            ],
        )

    def test_headless_command_is_wrapped_only_for_headless_runs(self):
        command = ["pnpm", "exec", "wdio", "run", "wdio.conf.ts"]
        self.assertEqual(tauri_e2e_runner.wrap_headless(command, False), command)
        self.assertEqual(
            tauri_e2e_runner.wrap_headless(command, True),
            [
                "xvfb-run",
                "--auto-servernum",
                "--server-args=-screen 0 1280x800x24",
                *command,
            ],
        )

    def test_safe_environment_metadata_excludes_credentials(self):
        metadata = tauri_e2e_runner.safe_environment_metadata(
            {
                "HOME": "/tmp/e2e-home",
                "RUXEX_PROVIDER": "dummy",
                "DISPLAY": ":0",
                "OPENAI_API_KEY": "secret",
                "CLOUDFLARE_API_TOKEN": "secret",
                "PASSWORD": "secret",
            }
        )

        self.assertEqual(metadata["HOME"], "/tmp/e2e-home")
        self.assertEqual(metadata["RUXEX_PROVIDER"], "dummy")
        self.assertNotIn("OPENAI_API_KEY", metadata)
        self.assertNotIn("CLOUDFLARE_API_TOKEN", metadata)
        self.assertNotIn("PASSWORD", metadata)
        self.assertNotIn("secret", json.dumps(metadata))

    def test_process_output_preview_limits_terminal_output_to_the_tail(self):
        output = "header\n" + ("x" * 120)

        preview = tauri_e2e_runner.process_output_preview(output, max_chars=40)

        self.assertTrue(preview.startswith("[...truncated...]\n"))
        self.assertTrue(preview.endswith("x" * 40))


if __name__ == "__main__":
    unittest.main()
