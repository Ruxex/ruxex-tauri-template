# Desktop Feature Comparison Design

## Intent

Codex Desktop、Claude Desktop、および Ruxex Tauri Template の機能を、公式ドキュメントとリポジトリ内の公開ドキュメントに基づいて比較できるようにする。目的は、各製品の機能範囲とデスクトップ固有の差分を把握し、今後の Ruxex の優先順位付けに使える比較表を残すことである。

## Goals

- Codex Desktop の公式記載機能を日本語 Markdown に整理する。
- Claude Desktop の公式記載機能を日本語 Markdown に整理する。
- Codex／Claude／Ruxex の機能星取り表を作成する。
- 各機能について、出典 URL、OS・プラン・ベータなどの条件、Ruxex 側の根拠を追跡できるようにする。
- 「公式に記載がある機能」と「Ruxex の公開ドキュメントから確認できる機能」を混同しない。

## Non-goals

- CLI、IDE 拡張、Web 版だけの機能を、デスクトップ機能として水増ししない。
- 未公開の実装予定、ソースコードから推測した未文書化機能、製品の品質や優劣を評価しない。
- 料金や利用可能性を網羅した料金比較表を作らない。
- 既存の Ruxex 実装を変更しない。

## Constraints

- 調査時点は 2026-11-04 と明記する。
- Codex は OpenAI の現行デスクトップアプリ文書と OpenAI 公式製品・ヘルプ資料を使用する。
- Claude は Anthropic の Claude Help Center を使用する。
- Ruxex はこのリポジトリの README、AGENTS.md、実装境界文書など、公開ツリー内で確認できる根拠に限定する。
- 公式資料に書かれた機能でも、OS、プラン、ベータ、権限などの条件がある場合は機能名の近くに注記する。

## Approaches

### Approach A: Desktop-first comparison (selected)

`ruxex-tauri-template/docs/` に、Codex、Claude、比較表の3ファイルを置く。比較対象がデスクトップアプリで揃い、Ruxex の Tauri UI と README の capability boundary を直接比較できるため、この依頼に最も適している。

### Approach B: Core-library-first comparison

`ruxex/docs/` に Ruxex core の App Server、provider、MCP、sandbox、persistence を中心に整理する。ライブラリの境界は説明しやすいが、デスクトップアプリの UI・OS・ローカルアクセス比較が分散するため採用しない。

## Deliverables

- `docs/codex-desktop-features.md`
  - Codex Desktop の位置づけ、作業場所、並列エージェント、ファイル出力、ブラウザ／Computer Use、プラグイン、スケジュール、音声、レビュー・権限、対応条件を整理する。
- `docs/claude-desktop-features.md`
  - Claude Desktop の基本機能、Desktop Extensions、Cowork、ローカルファイル、長時間・並列作業、ブラウザ／Computer Use、成果物、Projects、Quick Entry、OS・プラン条件を整理する。
- `docs/codex-claude-ruxex-feature-matrix.md`
  - 共通カテゴリで3製品を比較し、星と短い根拠を示す。

## Star rubric

- `★★★`：対象デスクトップ製品の公式資料、または Ruxex の公開ドキュメントに、機能が明確に記載されている。
- `★★☆`：一部の対応、限定された経路、または機能を支える基盤は確認できるが、比較対象と同等のデスクトップ機能としては限定的である。
- `★☆☆`：関連する低レベル基盤や間接的な入口は確認できるが、完成したデスクトップ機能としての記載はない。
- `☆☆☆`：今回確認した根拠からは該当機能を確認できない。

星は製品全体の優劣ではなく、今回定義した機能項目についての「公開根拠の強さ」と「デスクトップでの直接性」を表す。比較表には、星だけでなく短い判定理由を併記する。

## Source set

### Codex

- [ChatGPT desktop app](https://learn.chatgpt.com/docs/app)
- [ChatGPT Work and Codex](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex)
- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
- [Codex for (almost) everything](https://openai.com/index/codex-for-almost-everything/)
- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)

### Claude

- [Install Claude Desktop](https://support.claude.com/en/articles/10065433-install-claude-desktop)
- [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)
- [Use quick entry with Claude Desktop on Mac](https://support.claude.com/en/articles/12626668-use-quick-entry-with-claude-desktop-on-mac)
- [Let Claude use your computer in Cowork](https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork)

### Ruxex

- [`README.md`](../../../README.md)
- [`AGENTS.md`](../../../AGENTS.md)

## Review checklist

- Each feature in the two product summaries has a source URL.
- Each Ruxex star has a repository path or an explicit `☆☆☆` rationale.
- OS、プラン、ベータ、権限、ローカル／クラウドの条件を落としていない。
- Comparison rows use the same feature wording across all three products.
- The matrix does not claim that an unverified feature is absent from the entire product; it says only that no supporting evidence was found in the chosen scope.
