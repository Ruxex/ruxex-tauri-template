set shell := ["bash", "-euo", "pipefail", "-c"]

fmt-check:
    python3 scripts/check_changed_format.py

check:
    pnpm check

check-tests:
    pnpm check
    pnpm test

package-test:
    python3 -m unittest discover -s scripts -p 'test_*.py' -v

rust-test:
    cargo test --locked --manifest-path src-tauri/Cargo.toml

build:
    pnpm build

verify: check-tests package-test build
