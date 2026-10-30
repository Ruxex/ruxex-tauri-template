# Shared Page Container Design

## Intent

プロジェクト一覧、プロジェクト詳細、Plugins/Capabilities、Automation のページ外枠を共通化し、画面ごとに最大幅や縦方向の間隔がずれないようにする。

## Scope

対象は次の4ページとする。

- `ProjectsPage`
- `ProjectHomePage`
- `CapabilitiesPage`
- `SchedulesPage`

## Goals

- 4ページで同じ最大幅、横幅、中央寄せ、セクション間隔を使う。
- ページ固有のヘッダー、ボタン、カード、データ取得、状態表示は維持する。
- レイアウト値を1つの共有コンポーネントで変更できるようにする。
- 既存のアクセシビリティと各ページのルーティング挙動を変えない。

## Non-goals

- 各ページのヘッダー構造や見出しデザインを統合すること。
- Account、Settings、Marketplace settings、New project など他ページの幅を変更すること。
- ブレークポイントやカード内部のレイアウトを変更すること。

## Shared layout contract

`src/components/layout/PageContainer.tsx` に `PageContainer` を追加する。コンポーネントは `children` を受け取り、次のクラスを外側の要素に固定で適用する。

```text
mx-auto w-full max-w-5xl space-y-6
```

4ページの既存トップレベル `<div>` を `PageContainer` に置き換える。共通化の対象外のページは変更しない。

## Approaches

### 1. Shared React PageContainer — chosen

レイアウトの意図と共通値をReactコンポーネントとして表現する。各ページの固有構造を保持したまま、外枠の変更を一箇所に集約できるため採用する。

### 2. Shared Tailwind utility class

CSSに共通クラスを追加して各ページへ適用する。変更量は少ないが、ページ外枠が共通コンポーネントとして見えず、子要素の構造や型と結びつかない。

### 3. Shared page header and container system

外枠だけでなくタイトル、ボタン、下線まで共通化する。4ページのヘッダー構造が異なるため、過剰な抽象化になり、今回の目的を超える。

## Verification

- `PageContainer` のクラス契約をコンポーネントテストで確認する。
- 4ページが同じコンテナクラスを使うことを各ページテストで確認する。
- フロントエンド全体の型チェック、Lint、テスト、ビルドを実行する。
- `git diff --check` を実行する。
