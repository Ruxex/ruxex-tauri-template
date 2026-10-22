.DEFAULT_GOAL := help

.PHONY: help install dev mock-app-server test typecheck lint check check-tests package-test rust-test build fmt-check format-check verify run tauri-dev

help:
	@printf '%s\n' '利用可能なターゲット:'
	@printf '%s\n' '  make install            依存関係をインストール'
	@printf '%s\n' '  make dev                Vite開発サーバーを起動'
	@printf '%s\n' '  make mock-app-server    モックApp Server付きでViteを起動'
	@printf '%s\n' '  make test               テストを実行'
	@printf '%s\n' '  make typecheck          TypeScriptの型チェック'
	@printf '%s\n' '  make lint               BiomeとESLintを実行'
	@printf '%s\n' '  make check              型チェックとLintを実行'
	@printf '%s\n' '  make check-tests        型チェック、Lint、フロントエンドテストを実行'
	@printf '%s\n' '  make package-test       ランタイムパッケージのテストを実行'
	@printf '%s\n' '  make rust-test          Rust/Tauriのテストを実行'
	@printf '%s\n' '  make build              フロントエンドをビルド'
	@printf '%s\n' '  make verify             全検証とビルドを実行'
	@printf '%s\n' '  make format-check       フォーマット検査'
	@printf '%s\n' '  make run                Tauri開発アプリを起動'

install:
	pnpm install --frozen-lockfile

dev:
	pnpm dev

mock-app-server:
	VITE_MOCK_APP_SERVER=1 pnpm dev

test:
	pnpm test

typecheck:
	pnpm typecheck

lint:
	pnpm lint

check: typecheck lint

check-tests: check test

package-test:
	python3 -m unittest discover -s scripts -p 'test_*.py' -v

rust-test:
	cargo test --locked --manifest-path src-tauri/Cargo.toml

build:
	pnpm build

format-check:
	pnpm format:check

fmt-check:
	python3 scripts/check_changed_format.py

verify: check-tests package-test build

run:
	pnpm tauri dev

tauri-dev: run
