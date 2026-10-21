#!/usr/bin/env python3
"""Check formatting only for tracked changes and untracked project files."""

from __future__ import annotations

import subprocess
from pathlib import Path


def git_files(*args: str) -> set[str]:
    result = subprocess.run(["git", *args], check=True, capture_output=True, text=True)
    return {line for line in result.stdout.splitlines() if line}


files = {
    file
    for file in git_files("diff", "--name-only", "--diff-filter=ACMR")
    | git_files("ls-files", "--others", "--exclude-standard")
    if Path(file).suffix in {".ts", ".tsx"}
}

if files:
    subprocess.run(["pnpm", "exec", "biome", "format", *sorted(files)], check=True)
