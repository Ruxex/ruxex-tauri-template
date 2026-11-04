# ローカル複数エージェントのApp Server境界

監査日: 2026-11-05

## 実装した範囲

- `useForkThread` を追加し、既存の `thread/fork` を使って親Threadからローカル子Threadを作れるようにした。成功時は既存のThread session/cache規約に従う。
- `collaborationMode/list` のpresetをComposer設定に表示し、選択時は `thread/settings/update.collaborationMode` に保存する。
- 次の `turn/start` にも同じ `CollaborationMode` を渡す。`mode` または `model` が欠けるpresetは `null` として扱い、必須フィールド欠落のオブジェクトを送らない。
- 既存の `collabAgentToolCall` と会話イベント表示はそのまま利用し、App Serverが生成した協調イベントを既存Timelineへ流す。

## App Serverに既にあるもの

- `thread/fork` と親Thread情報を持つ `Thread.parentThreadId`／`forkedFromId`。
- `collaborationMode/list`、`thread/settings/update.collaborationMode`、`turn/start.collaborationMode`。
- `collabAgentToolCall`、`subAgentActivity` のイベント／アイテム型。
- `thread/interrupt`、`turn/steer` などThread／Turn単位の操作。
- Tauri側のGit worktree一覧・作成・削除・オープン基盤。

## 今回の停止点

生成済みのクライアント要求には、個別Sub-agentの停止／再開／キャンセル、親Coordinatorへの子Agent一覧・状態・質問の集約、AgentごとのCPU／メモリ／同時数／ツール権限上限、子変更のReview採用ゲートを表す権威契約がない。`subagentStop` はHookイベント名であり、Agent lifecycle APIではない。

したがって、preset選択・fork入口・既存イベント表示までは実装したが、個別Agentの管理状態やResource controlsをデスクトップ側で推測・二重管理しない。Coordinator UIの完全版は、App Server側にAgent lifecycle、aggregation、resource、review契約が追加された段階で再開する。
