# 画面・部品の参照パターン

ここにあるコードは設計判断を伝えるための抜粋です。プロダクト実装へコピーする完成部品ではありません。各機能に必要な状態、検証、アクセシビリティ、データ取得を実装し、既存の共通部品が担う責務を重複させないでください。

## ページ見出しと主要操作

```tsx
<PageContainer>
  <header className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
    </div>
    <button className="btn btn-primary min-h-11 gap-2" type="button">
      <PlusIcon aria-hidden="true" className="size-4" />
      New project
    </button>
  </header>
  <section className="space-y-4">...</section>
</PageContainer>
```

ページコンテナが最大幅と縦方向のセクション間隔を持つため、ページ要素へ同じ余白を重ねません。幅が狭くなれば見出しと操作は折り返します。

## フォーム項目とエラー

```tsx
<div className="form-control w-full">
  <label className="label" htmlFor="project-name">
    <span className="label-text">Project name</span>
  </label>
  <input
    aria-describedby={error ? "project-name-error" : undefined}
    aria-invalid={error || undefined}
    className="input input-bordered w-full"
    id="project-name"
    name="projectName"
    required
  />
  {error && (
    <p className="mt-1 text-sm text-error" id="project-name-error" role="alert">
      Enter a project name.
    </p>
  )}
</div>
```

実際にはフォームの送信時検証、最初の不正項目へのフォーカス、サーバー側エラーの対応を含めます。説明が不要なら補助文を増やさず、ラベルと操作だけで理解できるようにします。

## 空・読み込み・エラー状態

```tsx
{isLoading ? (
  <p role="status">Loading projects…</p>
) : error ? (
  <div className="alert alert-error" role="alert">
    <p>Projects could not be loaded.</p>
    <button className="btn btn-sm" onClick={retry} type="button">
      Retry
    </button>
  </div>
) : projects.length === 0 ? (
  <div className="rounded-box border border-dashed border-base-300 p-6">
    <p>No projects yet.</p>
    <button className="btn btn-primary btn-sm mt-3" onClick={create} type="button">
      Create project
    </button>
  </div>
) : (
  <ProjectList projects={projects} />
)}
```

読み込み失敗を空状態として表示せず、空状態は存在しないデータを作るための行動につなげます。長い作業が続く場合はスピナーだけでなく対象コンテンツの形を保ちます。

## 確認ダイアログ

```tsx
<dialog aria-labelledby="archive-title" className="modal" ref={dialogRef}>
  <div className="modal-box w-full max-w-lg p-5">
    <h2 className="text-xl font-semibold" id="archive-title">Archive project?</h2>
    <p className="mt-3 text-sm leading-relaxed">
      The project will leave the active list. Its existing threads remain available in the archive.
    </p>
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>
      <button className="btn btn-error" type="button" onClick={onConfirm}>Archive project</button>
    </div>
  </div>
</dialog>
```

この抜粋には開閉、フォーカス管理、背面の不活性化を含めていません。実装では [`DialogShell`](../../src/components/common/DialogShell.tsx) またはネイティブ`<dialog>`の既存パターンを使い、削除・アーカイブの実際の結果を対象に合わせて説明します。

## 参照パターンを更新するとき

- 例は必ず関連する基礎ガイドとコンポーネント規則に一致させます。
- 断片コードには、見た目だけでなくラベル、役割、状態、フォーカスなど意図が分かる属性を含めます。
- 外部サービス状態やプロトコルに関する例は、存在しない状態や振る舞いを作りません。
- コード例のクラスが実際のTailwind／DaisyUIで成立するかを確認し、現在の依存バージョンを前提にします。
- 例の中に特別な例外を使う場合、その理由を本文で説明します。
