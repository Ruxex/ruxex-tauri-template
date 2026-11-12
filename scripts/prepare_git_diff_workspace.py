#!/usr/bin/env python3
"""Create a committed two-file Git workspace with pending review changes."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def run_git(repository: Path, *arguments: str) -> None:
    subprocess.run(
        ["git", *arguments],
        cwd=repository,
        check=True,
        stdout=subprocess.DEVNULL,
    )


def prepare(repository: Path) -> None:
    repository.mkdir(parents=True, exist_ok=True)
    run_git(repository, "init", "--quiet")
    run_git(repository, "config", "user.name", "Ruxex UI Fixtures")
    run_git(repository, "config", "user.email", "ui-fixtures@example.invalid")

    readme = repository / "README.md"
    readme.write_text("# Git diff fixture\nStatus: committed\n", encoding="utf-8")
    source = repository / "src" / "main.ts"
    source.parent.mkdir()
    source.write_text('export const state = "committed";\n', encoding="utf-8")
    run_git(repository, "add", "README.md", "src/main.ts")
    run_git(repository, "commit", "--quiet", "-m", "Add fixture files")

    readme.write_text(
        "# Git diff fixture\nStatus: edited\nAdded line for review\n",
        encoding="utf-8",
    )
    source.write_text(
        'export const state = "edited";\nexport const reviewReady = true;\n',
        encoding="utf-8",
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: prepare_git_diff_workspace.py WORKSPACE")
    prepare(Path(sys.argv[1]).expanduser().resolve())
