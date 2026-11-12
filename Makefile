.DEFAULT_GOAL := help

# Optional local configuration. .env.local overrides .env when both exist.
-include .env .env.local
export CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_MODEL

.PHONY: help install dev mock-app-server test typecheck lint check check-tests package-test rust-test mcp-fixture-build mcp-fixture-test build fmt-check format-check verify run tauri-dev local-cloudflare local-cloudflare-inprocess e2e-build e2e-plugin-build e2e e2e-headless e2e-diagnostics e2e-diagnostics-headless ui-fixtures prepare-dummy-home dummy-home-events dummy-home-pages prepare-marketplace-home

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
	@printf '%s\n' '  make mcp-fixture-build  テスト用MCPサーバーをビルド'
	@printf '%s\n' '  make mcp-fixture-test   テスト用MCPサーバーの疎通を確認'
	@printf '%s\n' '  make build              フロントエンドをビルド'
	@printf '%s\n' '  make verify             全検証とビルドを実行'
	@printf '%s\n' '  make format-check       フォーマット検査'
	@printf '%s\n' '  make run                Tauri開発アプリを起動'
	@printf '%s\n' '  make e2e-build         E2E用debugバイナリを生成'
	@printf '%s\n' '  make e2e               Wayland/XWayland上でTauri E2Eを実行'
	@printf '%s\n' '  make e2e-headless      Xvfb上でTauri E2Eを実行'
	@printf '%s\n' '  make e2e-diagnostics   E2Eプラグイン付き診断を実行'
	@printf '%s\n' '  make e2e-diagnostics-headless Xvfb上でE2E診断を実行'
	@printf '%s\n' '  make ui-fixtures        データ投入とUIスクリーンショットを一括実行'
	@printf '%s\n' '  make prepare-dummy-home  UI操作でDummyProviderのホームを生成'
	@printf '%s\n' '  make dummy-home-events   準備済みホームで揮発イベントのUIを表示'
	@printf '%s\n' '  make dummy-home-pages    準備済みホームの未撮影ページをキャプチャ'
	@printf '%s\n' '  make prepare-marketplace-home  実物Marketplaceのホームを生成'
	@printf '%s\n' '  make local-cloudflare     ローカルCloudflareプロバイダをデーモンモードで起動'

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

mcp-fixture-build:
	cargo build --locked --manifest-path src-tauri/Cargo.toml \
		--bin ruxex-mcp-fixture --bin ruxex-mcp-http-fixture

mcp-fixture-test: mcp-fixture-build
	MCP_FIXTURE_BIN=target/debug/ruxex-mcp-fixture \
		python3 -m unittest scripts/test_mcp_fixture.py -v

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

local-cloudflare:
	RUXEX_PROVIDER=cloudflare RUXEX_APP_SERVER_MODE=daemon pnpm tauri dev

# Keep the old entrypoint working while routing it through the safer daemon mode.
local-cloudflare-inprocess: local-cloudflare

e2e-build:
	VITE_E2E=1 pnpm tauri build --debug --no-bundle --features e2e --config src-tauri/tauri.e2e.conf.json
	test -x target/debug/ruxex-desktop

e2e-plugin-build:
	VITE_E2E=1 VITE_E2E_PLUGIN=1 pnpm tauri build --debug --no-bundle --features e2e --config src-tauri/tauri.e2e.conf.json
	test -x target/debug/ruxex-desktop
	cp target/debug/ruxex-desktop target/debug/ruxex-desktop-e2e-plugin

e2e: e2e-build
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --spec e2e/desktop-smoke.spec.ts

e2e-headless: e2e-build
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --headless --spec e2e/desktop-smoke.spec.ts

e2e-diagnostics: e2e-plugin-build
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=1 python3 scripts/tauri_e2e_runner.py --binary target/debug/ruxex-desktop-e2e-plugin --spec e2e/diagnostics.spec.ts

e2e-diagnostics-headless: e2e-plugin-build
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=1 python3 scripts/tauri_e2e_runner.py --headless --binary target/debug/ruxex-desktop-e2e-plugin --spec e2e/diagnostics.spec.ts

ui-fixtures: mcp-fixture-build e2e-build
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --dummy-home --spec fixtures/dummy-home/persistent.spec.ts
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --dummy-events --spec fixtures/dummy-home/pages.spec.ts
	MCP_STREAMABLE_HTTP_BIND_ADDR=127.0.0.1:3920 target/debug/ruxex-mcp-http-fixture >/dev/null 2>&1 & \
		mcp_fixture_pid=$$!; \
		trap 'kill $$mcp_fixture_pid 2>/dev/null || true' EXIT; \
		sleep 1; \
		GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --dummy-events --spec fixtures/dummy-home/unshot.spec.ts
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --dummy-events --spec fixtures/dummy-home/volatile.spec.ts
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --marketplace-home --spec fixtures/marketplace-home/persistent.spec.ts
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/run_git_diff_ui_fixture.py

prepare-dummy-home: e2e-build
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --dummy-home --spec fixtures/dummy-home/persistent.spec.ts

dummy-home-events: e2e-build
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --dummy-events --spec fixtures/dummy-home/volatile.spec.ts

dummy-home-pages: e2e-build
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --dummy-events --spec fixtures/dummy-home/pages.spec.ts

prepare-marketplace-home: e2e-build
	GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --marketplace-home --spec fixtures/marketplace-home/persistent.spec.ts
