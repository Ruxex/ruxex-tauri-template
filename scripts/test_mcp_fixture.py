from __future__ import annotations

import json
import os
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class McpFixtureOwnershipTests(unittest.TestCase):
    def test_tauri_template_owns_stdio_and_http_fixture_sources(self) -> None:
        self.assertTrue(
            (ROOT / "src-tauri/src/bin/ruxex-mcp-fixture.rs").is_file()
        )
        self.assertTrue(
            (ROOT / "src-tauri/src/bin/ruxex-mcp-http-fixture.rs").is_file()
        )

    def test_makefile_builds_fixtures_from_tauri_template(self) -> None:
        makefile = (ROOT / "Makefile").read_text()
        self.assertIn("mcp-fixture-build:", makefile)
        self.assertIn("--bin ruxex-mcp-fixture", makefile)
        self.assertIn("--bin ruxex-mcp-http-fixture", makefile)

    def test_stdio_fixture_lists_echo_tool(self) -> None:
        binary = Path(
            os.environ.get(
                "MCP_FIXTURE_BIN", ROOT / "target/debug/ruxex-mcp-fixture"
            )
        )
        if not binary.is_file():
            self.skipTest("build with `make mcp-fixture-build` first")

        messages = [
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "fixture-check", "version": "0.1.0"},
                },
            },
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
        ]
        completed = subprocess.run(
            [str(binary)],
            input="".join(json.dumps(message) + "\n" for message in messages),
            text=True,
            capture_output=True,
            timeout=5,
            check=True,
        )
        responses = [json.loads(line) for line in completed.stdout.splitlines()]
        tools = responses[-1]["result"]["tools"]
        self.assertEqual([tool["name"] for tool in tools], ["echo"])


if __name__ == "__main__":
    unittest.main()
