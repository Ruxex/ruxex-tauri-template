# Persistent left sidebar design

## Intent

ページ遷移後もワークスペースの左アイコンレールを常に表示し、ページに不要な右側のコンテキストペインだけを非表示にする。ナビゲーションへのアクセスを維持しながら、プロジェクト詳細やアカウント画面の横幅を確保する。

## Scope

- `ProjectSidebar` は `/projects`、`/projects/:projectId`、`/settings/account` を含む全ルートで描画する。
- `/projects*` と `/settings/account` では左アイコンレールだけを表示し、右コンテキストペインは表示しない。
- その他のルートでは現在の `sidebarCollapsed` に応じた左レール・右ペインの表示を維持する。
- プロジェクト・アカウントページでは、右ペインがないためサイドバー用オーバーレイも表示しない。

## Non-goals

- 左レールのアイコン、順序、クリック遷移は変更しない。
- `sidebarCollapsed` の保存形式やキーボード操作は変更しない。
- ページ本体のレイアウトや右ペインの内容は変更しない。

## Approach

`AppLayout` は `ProjectSidebar` を常に描画し、右ペインを表示するかどうかだけを `showContextPanel` として渡す。`ProjectSidebar` は左レールを常に描画し、`showContextPanel` が true かつ未折りたたみのときだけ `SidebarContextPanel` を描画する。これにより、現在のサイドバー制御を保ったまま、ページ単位で右ペインだけを外せる。

## Verification

- `/projects`、`/projects/project-1`、`/settings/account` で左レールが存在し、右コンテキストペインが存在しないことを UI テストで確認する。
- `/` など通常ページでは `ProjectSidebar` と右ペインが従来どおり表示されることを確認する。
