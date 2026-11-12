#!/usr/bin/env python3
"""Run the Git diff UI fixture with a short-lived temporary repository."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from prepare_git_diff_workspace import prepare


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dummy-home",
        action="store_true",
        help="reset and seed the persistent fixture home before running",
    )
    arguments = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="ruxex-git-diff-workspace-") as temp:
        workspace = Path(temp)
        prepare(workspace)
        environment = os.environ.copy()
        environment["RUXEX_E2E_GIT_DIFF_WORKSPACE"] = str(workspace)
        command = [
            sys.executable,
            str(REPOSITORY_ROOT / "scripts" / "tauri_e2e_runner.py"),
            "--dummy-home" if arguments.dummy_home else "--dummy-events",
            "--spec",
            "fixtures/dummy-home/git-diff-review.spec.ts",
        ]
        return subprocess.run(
            command,
            cwd=REPOSITORY_ROOT,
            env=environment,
            check=False,
        ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
