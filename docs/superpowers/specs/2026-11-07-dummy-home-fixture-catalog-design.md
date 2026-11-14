# Dummy Home Fixture Catalog Design

## Intent

Expand the repository-local DummyProvider home so UI screenshots and manual
visual checks can cover realistic list, conversation, project, archive, error,
and activity states. The fixture must be created through the real Tauri UI and
WDIO operations, not by inserting rows directly into SQLite.

The fixture has two independent outputs:

1. A persistent home at `/.d/` containing durable threads, projects, goals,
   archived chats, and completed or failed history.
2. A volatile event scenario runner that starts from the persistent home and
   leaves server requests or in-progress work in memory for screenshots.

## Goals

- Make the first persistent fixture broad enough for everyday UI review.
- Give every scenario a stable semantic name and an explicit default count.
- Keep the number of generated records easy to adjust without changing the
  runner architecture.
- Preserve idempotence: each persistent run resets only `/.d/` and recreates
  the catalog from scratch.
- Verify the important post-run states after restarting the app, especially
  that durable history can be rendered without the original event stream.
- Keep provider behavior deterministic by using the existing DummyProvider
  scenario markers.

## Non-goals

- Direct SQLite writes, SQL snapshots, or hand-authored database fixtures.
- Committing the generated home or absolute workspace paths.
- Reproducing pending approvals, user-input cards, or streaming spinners in the
  persistent database. Those states are connection-local and belong to the
  volatile runner.
- Covering every DummyProvider scenario in the first catalog.
- Adding new DummyProvider behavior as part of this fixture expansion.

## Constraints

- All durable data is created by the real desktop app through WDIO.
- The persistent home remains the short ignored path `/.d/` because the App
  Server Unix socket path includes `RUXEX_HOME`.
- The fixture is headful for now; headless execution can be added when the
  environment provides `xvfb-run`.
- Projects are created without workspace roots. A project root is an absolute
  path and would make the generated home machine-specific.
- Scenario labels and generated titles must be human-readable so list and
  search screenshots are meaningful.
- Counts below are defaults, not schema. They should be represented by a
  catalog or options object so a later screenshot pass can scale them up or
  down.

## Approaches considered

### Single large WDIO spec

One ordered spec would create every record. This is simple initially, but a
failure in one scenario would hide later failures and changing counts would
require editing a long procedural script.

### Screen-specific specs

Separate specs for threads, projects, archive, and conversation activities make
individual checks easy. They also require duplicate reset/setup logic and make
the final home depend on execution order.

### Scenario catalog with persistent and volatile suites — chosen

Define scenario records with stable IDs, counts, message markers, and expected
outcomes. Shared WDIO helpers execute those records. The persistent suite
creates durable state and the volatile suite creates connection-local states.
This matches the actual lifetime of the data, keeps counts adjustable, and
allows the two suites to evolve independently.

## Persistent catalog

The catalog contains 19 threads. Two of them are archived after their
history is created, leaving 17 active threads for the normal Chats view.

| Scenario ID | Count | Durable state | Main UI purpose |
| --- | ---: | --- | --- |
| `basic` | 2 | Completed user/assistant conversation | Baseline chat rows and normal conversation rendering |
| `long-markdown` | 1 | Completed long Markdown response | Headings, list, code block, wrapping, and scroll behavior |
| `multi-turn` | 1 | Three completed user/assistant turns | Turn grouping, repeated composer use, and timeline density |
| `command-success` | 1 | Completed command activity and response | Activity card, command metadata, and successful output |
| `command-list` | 1 | Completed `ls` command activity and response | Directory output and compact command activity |
| `command-large` | 1 | Completed command with many output lines | Long activity output and overflow behavior |
| `command-fail` | 1 | Failed command turn | Error output, non-zero exit status, and failed-turn treatment |
| `approval-accepted` | 1 | Approval request resolved as accepted, then completed | Durable approval-related history after the request disappears |
| `approval-denied` | 1 | Approval request resolved as denied | Denied outcome and continuation message |
| `provider-error` | 1 | Failed turn from a provider error | Error banner and failed thread history |
| `rate-limit` | 1 | Failed turn from a rate-limit response | Retry/error presentation |
| `disconnect` | 1 | Partial response followed by transport failure | Recovery/error presentation and partial content |
| `goal-only` | 1 | Persistent thread goal without a normal turn | Goal-related persisted state |
| `plan` | 1 | Completed `update_plan` tool activity | Plan activity and completion rendering |
| `reasoning` | 1 | Reasoning summary followed by a fixed answer | Reasoning activity, usage, and answer rendering |
| `markdown` | 1 | Completed rich Markdown response | Markdown, code, table, task list, and Mermaid rendering |
| `subagent` | 1 | Completed single `spawn_agent` activity | Agent collaboration activity and completion rendering |
| `parallel-subagents` | 1 | Completed parallel `spawn_agent` activities | Parallel agent activity and completion rendering |

The `approval-*` scenarios resolve the request during preparation so the final
home is restartable. The current standard approval UI exposes Allow and Deny,
but not Cancel, so the DummyProvider `approval:cancel` contract is intentionally
not part of the UI-created persistent catalog. The corresponding pending card
is covered separately by the volatile suite.

### Persistent organization states

Organization states are applied to the catalog records rather than creating
extra duplicate threads:

- Archive the second `basic` thread and the `provider-error` thread: 2 archived
  threads.
- Keep the remaining 17 threads active.
- Create 3 rootless projects with distinct metadata:
  - `Product planning`: blue / briefcase, 2 assigned threads.
  - `Design review`: violet / globe, 1 assigned thread.
  - `Empty project`: orange / folder, no assigned threads.
- Assign existing `basic`, `multi-turn`, and `command-success` records to the
  projects. No project needs an absolute workspace root.

This gives the Projects page both populated and empty project details without
inflating the conversation count.

## Volatile event catalog

The volatile suite does not promise to leave additional durable rows. It starts
the app with the prepared home, performs one operation, and pauses at the state
needed for a screenshot or manual inspection.

| Scenario ID | Count | Pause state | Main UI purpose |
| --- | ---: | --- | --- |
| `pending-approval` | 1 | Command approval card visible | Approval card layout and command/permission details |
| `pending-user-input` | 1 | User input card visible | Question form and answer controls |
| `pending-permissions` | 1 | Permissions approval card visible | File-system/network permission presentation |
| `slow-stream` | 1 | Assistant response actively streaming | Working indicator, incremental layout, and stop action |
| `queued-message` | 1 | Active turn plus queued next message | Queue presentation and composer mode |
| `pending-mcp-elicitation` | 0 initially | MCP elicitation card visible | Reserved until the fixture MCP tool setup is deterministic |
| `disconnect-recovery` | 1 | Partial output followed by recovery state | Resynchronization and error handling |

The initial volatile run therefore has 6 active scenarios. The MCP scenario is
explicitly reserved rather than silently omitted from the design because it
needs deterministic MCP setup in addition to DummyProvider.

## Scenario execution model

The persistent runner will:

1. Reset `/.d/` and start the real Tauri binary with DummyProvider.
2. Create projects through the Projects UI, leaving roots empty.
3. Create each catalog thread through the normal composer, using the explicit
   marker in its first user message.
4. Wait for the expected durable outcome before continuing.
5. Resolve approval scenarios through the visible request card, then wait for
   the fixed continuation response.
6. Apply archive and project assignment through normal UI controls.
7. Reopen representative active, archived, project, and failed threads before
   exiting to prove the final state is readable from persisted history.

The volatile runner will use a separate spec and will never be invoked as part
of the persistent preparation command. It may start from the prepared home,
but it must not reset it unless explicitly asked to rebuild the persistent
fixture.

## Idempotence and scaling

The catalog is the source of truth for counts. Each record needs a stable
scenario ID and an occurrence number, which together form deterministic titles
such as `Fixture command success 01`. The runner must fail if an expected
scenario outcome is not reached; it must not silently continue with partial
data.

Changing a count should only change the catalog value and the corresponding
assertion of expected totals. The default catalog is intentionally small enough
for a local headful run while covering the major UI surfaces.

## Verification targets

After a successful persistent run, verify through the UI and, only for
diagnostics, read-only inspection that:

- active Chats contains 17 records;
- Archived chats contains 2 records;
- Projects contains 3 records, with project thread counts 2, 1, and 0;
- the persistent goal exists for the goal-only thread;
- representative Example provider Markdown, reasoning, plan, subagent,
  command, failed, and multi-turn threads render
  after a fresh app start;
- no generated files appear as Git changes because `/.d/` remains ignored.

The read-only database inspection is a verification aid only. It is not part
of fixture creation and must never be used to repair or populate the home.
