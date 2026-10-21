.DEFAULT_GOAL := help

.PHONY: help install dev mock-app-server test typecheck lint check build format-check tauri-dev

help:
	@printf '%s\n' '利用可能なターゲット:'
	@printf '%s\n' '  make install            依存関係をインストール'
	@printf '%s\n' '  make dev                Vite開発サーバーを起動'
	@printf '%s\n' '  make mock-app-server    モックApp Server付きでViteを起動'
	@printf '%s\n' '  make test               テストを実行'
	@printf '%s\n' '  make typecheck          TypeScriptの型チェック'
	@printf '%s\n' '  make lint               BiomeとESLintを実行'
	@printf '%s\n' '  make check              型チェックとLintを実行'
	@printf '%s\n' '  make build              フロントエンドをビルド'
	@printf '%s\n' '  make format-check       フォーマット検査'
	@printf '%s\n' '  make tauri-dev          Tauri開発アプリを起動'

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

build:
	pnpm build

format-check:
	pnpm format:check

tauri-dev:
	pnpm tauri dev
