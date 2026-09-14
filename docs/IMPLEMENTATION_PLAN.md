# ChatGPT ↔ Agent Bridge ↔ Codex Implementation Plan

Last updated: 2026-09-14

## 1. Goal

Adapt this fork of `teamnebula-ai/agent-bridge` so ChatGPT can delegate auditable tasks to Codex running on one of the user's Macs, while keeping Agent Bridge's existing durable task ledger, session continuity, telemetry, and safety model.

Primary target repositories:

- IoTMart3.0
- Magnolia

The bridge must be easy to set up on MacBook A and MacBook B from the same Git repository.

## 2. Target architecture

```text
ChatGPT
  |
  | GitHub relay files (current PoC)
  v
local bridge watcher
  |
  v
deterministic handler / Agent Bridge control plane
  |
  v
durable task ledger / sessions / telemetry
  |
  v
Codex transport adapter
  |
  v
codex exec --json (PoC)
  |
  v
IoTMart3.0 or Magnolia
```

The local stdio MCP adapter and Secure MCP Tunnel remain optional future transport work. GitHub relay is the current Plus-compatible path. Important: ChatGPT reaches Agent Bridge rather than Codex directly, so task/status/result/session history remains available.

## 3. Why this fork

Upstream already provides the parts we want to preserve:

- filesystem task ledger (`task.md`, `status.md`, `result.md`, events/telemetry)
- Codex CLI `exec --json` fallback transport for the PoC
- named session continuity via Codex `threadId`
- read-only/workspace-write sandbox modes
- warm Codex MCP support
- task status/result inspection

The gap is that upstream is directional from Claude Code to Agent Bridge. This fork adds narrow ChatGPT-facing transports in front of the existing bridge control plane; the current PoC uses a GitHub-backed mailbox because it does not depend on custom-MCP account access.

## 4. Current repositories and machine state

### MacBook A

Environment observed on 2026-09-11:

| Item | State |
|---|---|
| macOS | 27.0 |
| git | 2.52.0 |
| gh | 2.98.0 |
| node | v25.5.0 |
| npm | 11.8.0 |
| GitHub auth | authenticated as `yoozayang` |
| Codex CLI | repaired: `/opt/homebrew/bin/codex`, `codex-cli 0.154.0` |
| Codex auth | logged in using ChatGPT |
| PoC transport | `codex exec --json`, verified read-only with durable task ledger |
| `agy` | not installed; optional and not needed for this PoC |

Bridge working copy:

`/Users/yoozayang/Development/ChatGPT-CodexAgent-Bridge`

Git remotes:

- origin: `git@github.com:yoozayang/agent-bridge.git`
- upstream: `https://github.com/teamnebula-ai/agent-bridge.git`
- branch: `feature/chatgpt-codex-bridge`
- bootstrap HEAD reported before documentation commits: `7fa44e48d18618faeabbff836318c602413a61cb`

### Target repositories

IoTMart3.0:

- path: `/Users/yoozayang/Development/IoTMart3.0`
- valid Git repository: yes
- observed branch: `Matthew/bugfix/46919_Referral_Click_Tracking_UAT_Gap`
- working tree: dirty
- two modified Apex files were reported
- bridge PoC must not touch these files
- Phase 1 read-only validation passed through Agent Bridge task `20260911091629-read-only-inspection-only-3261`; branch and both modified-file names were identical before and after, and ledger telemetry recorded zero file changes

Magnolia:

- workspace path: `/Users/yoozayang/Magnolia`
- valid Git repository at that exact root: no
- discovered Git roots (read-only inventory):
  - `/Users/yoozayang/Magnolia/base` — `main`, dirty (five untracked files), origin `ssh://git@gitlab.advantech.ap-southeast.magnolia-platform.asia:9022/magnolia/base.git`
  - `/Users/yoozayang/Magnolia/light-modules` — `Matthew/bugfix/46919_Referral_Click_Tracking_UAT_Gap_A`, dirty (one modified file), origin `ssh://git@gitlab.advantech.ap-southeast.magnolia-platform.asia:9022/magnolia/light-modules.git`
  - `/Users/yoozayang/Magnolia/.wt_PhushyaMithra_43494_Bundle_Product_Light_A` — `Matthew/deploy/PhushyaMithra_43494_Bundle_Product_Light_A`, clean worktree, origin `ssh://git@gitlab.advantech.ap-southeast.magnolia-platform.asia:9022/magnolia/light-modules.git`
- Phase 1 selected `light-modules` and passed read-only validation through Agent Bridge task `20260911091717-read-only-inspection-only-4ff4`; branch and its one modified-file name were identical before and after, and ledger telemetry recorded zero file changes

### MacBook B

Not set up yet. It must be able to clone this fork and follow `docs/HANDOFF.md` without relying on prior chat/session context.

## 5. Current blockers

### Phase 0 blocker — resolved with the upstream exec fallback

The current official CLI (`@openai/codex@0.154.0`) does not expose `codex mcp-server`. Per ChatGPT's PoC decision, do not downgrade Codex or use `mcp-server`/`app-server`; Agent Bridge now uses its existing `codex exec --json` transport for the read-only PoC.

On 2026-09-11, a temporary read-only workspace and isolated `AGENT_BRIDGE_HOME` completed task `20260911091147-smoke-test-for-agent-a53d` with exit code 0 and result `AGENT_BRIDGE_CODEX_EXEC_SMOKE_OK`. Its durable ledger contains `task.md`, `status.md`, `result.md`, `events.jsonl`, `telemetry.jsonl`, and `telemetry.json`; telemetry recorded zero commands and zero file changes.

### Non-blocker — `agy` missing

Antigravity is unrelated to the first ChatGPT ↔ Codex PoC. Do not install it merely to make `doctor` fully green.

## 6. Implementation phases

### Phase 0 — Stabilize local prerequisites

Status: **COMPLETE**

Tasks:

- repair Codex CLI on MacBook A — complete (`codex-cli 0.154.0`)
- verify Codex account login without creating a new API key — complete (ChatGPT login)
- select and validate a supported Codex transport — complete (`codex exec --json`, read-only smoke passed)
- identify Magnolia Git repo root(s) — complete; three roots recorded above
- leave IoTMart3.0 untouched

Exit criteria:

- `codex --version` works
- authentication status is known
- read-only Codex smoke test works outside project repos — complete
- Magnolia repo mapping is known

### Phase 1 — Validate upstream Agent Bridge unchanged

Status: **COMPLETE**

Use upstream behavior before custom code.

Run a read-only smoke test in a temporary directory and confirm the ledger contains:

- `task.md`
- `status.md`
- `result.md`
- `events.jsonl`
- telemetry files

Then run read-only inspection against each configured target repository.

Acceptance criteria:

- Codex reported IoTMart3.0 branch/status without modifying it — complete
- Codex reported Magnolia `light-modules` branch/status without modifying it — complete
- Agent Bridge recorded both runs with complete, internally consistent durable ledgers — complete

### Phase 2 — Add ChatGPT-facing MCP surface

Status: **COMPLETE**

Add the smallest possible MCP server that wraps existing Agent Bridge operations.

Initial proposed tool surface:

- `bridge_ping()`
- `bridge_projects()`
- `bridge_run_readonly(project, prompt)`
- `bridge_task_status(task_id)`
- `bridge_task_result(task_id)`

Design requirements:

- reuse existing dispatcher/task ledger/session machinery
- do not shell arbitrary user input directly
- resolve project IDs through configuration rather than absolute paths supplied by ChatGPT
- default to read-only
- no write-capable ChatGPT tool in this phase

Acceptance criteria:

- a local stdio MCP client called all five tools successfully
- `bridge_projects` exposes only the configured `iotmart` and `magnolia` IDs; `bridge_run_readonly` resolves the target through the ignored local config file
- `bridge_run_readonly("iotmart", ...)` completed task `20260911092600-read-only-inspection-only-9610` through the existing `dispatch()` lifecycle with `transport: exec` and `sandbox: read-only`
- resulting ledger contains the normal six files, and telemetry recorded `fileChanges: 0`; IoTMart Git status was byte-identical before and after

Implementation:

- added `bin/agent-bridge-mcp.js` (stdio MCP entry point), `lib/projects.js` (logical project resolver), `config/projects.json.example`, and `test/mcp-smoke.js`
- added the standard `@modelcontextprotocol/sdk` dependency
- `bridge_run_readonly` is the only execution tool; it fixes agent, transport, and sandbox to `codex`, `exec`, and `read-only`

### Phase 3 — Cross-machine configuration

Status: **COMPLETE**

Introduce machine-local project path configuration with committed examples only.

Suggested logical project IDs:

- `iotmart`
- `magnolia`

No source file should hard-code `/Users/yoozayang`.

Create a bootstrap/doctor path that checks local dependencies and project mappings on each Mac.

Acceptance criteria:

- MacBook B can clone the fork — complete
- configure only local paths/auth — complete through ignored `config/projects.json` and `config/machine.json`
- run the same read-only tests without code edits — complete; the default relay smoke uses only `bridge_ping` and `project_git_status`

The local machine identity is an opaque, non-secret ID. It is returned by `bridge_ping` and may be supplied as `machine_id` to route a task to one watcher without changing the untargeted claim behavior.

### Phase 4 — Secure MCP Tunnel / ChatGPT connection

Status: **BLOCKED — ChatGPT custom connector UI must be verified**

After the local ChatGPT-facing MCP server works:

- install/verify OpenAI Secure MCP Tunnel
- connect private local MCP to ChatGPT
- require human intervention for OpenAI/ChatGPT account UI, tunnel creation, credentials, or permissions

Acceptance criteria:

ChatGPT can invoke:

1. ping
2. project list
3. read-only IoTMart investigation
4. read-only Magnolia investigation
5. task status/result retrieval

Local setup evidence (2026-09-11):

- official `tunnel-client` 0.0.14 was installed and its `doctor --profile agent-bridge --explain` checks passed
- managed runtime health, readiness, and a successful control-plane poll passed; the runtime launches `bin/agent-bridge-mcp.js` over stdio
- a local MCP client completed initialization and `bridge_ping`; the tunnel client has no tunnel-facing tool-discovery probe for this stdio target
- the user opened ChatGPT Settings → Apps; it showed only preconfigured apps, with no custom-connector add action or `chatgpt-codex` entry
- this is an observed UI blocker, not a conclusion about plan entitlement; ChatGPT or the workspace administrator must verify whether custom MCP connectors are available
- the managed runtime was stopped after the UI check; no target repository tool was invoked

### Phase 5 — GitHub relay PoC

Status: **COMPLETE**

GitHub is the current ChatGPT-to-Mac transport. The watcher reads bounded inbox files, creates a remote claim before execution, writes an outbox result, and creates a local Agent Bridge ledger task for each deterministic operation.

Implemented allowlist:

- `bridge_ping`
- `project_git_status` for configured `iotmart` or `magnolia`
- `azure_work_item_read` for numeric work item IDs

Acceptance evidence (2026-09-11):

- smoke tasks for all three types produced one outbox result each; a second worker pass skipped the already-completed ping task
- `azure_work_item_read(47122)` succeeded through the relay with existing Azure CLI authentication and returned its ID, title, `Task` type, `To Do` state, and description
- no Codex model turn was used, and IoTMart Git status was byte-identical before and after `project_git_status`
- a per-user macOS LaunchAgent runs the existing watcher at login and restarts it after an unexpected exit
- the default relay smoke no longer reads Azure DevOps; testing `azure_work_item_read` requires an explicitly approved `AGENT_BRIDGE_SMOKE_AZURE_WORK_ITEM`

### Phase 6 — Controlled comment-write PoC

Status: **IN PROGRESS — primitives implemented; 47122 selection/review pending ChatGPT**

The relay now exposes only four bounded project primitives: literal `project_text_search`, bounded `project_file_read`, exact `project_comment_replace`, and bounded `project_git_diff`. Comment replacement is restricted to a clean IoTMart file, an exact once-only same-line recognizable comment, and post-write diff verification; it never commits the target repository. Fixture tests cover traversal, dirty files, repeated text, and a successful replacement. No 47122 target candidate was selected or changed during implementation.

After ChatGPT reviews the real 47122 diff, a separate task may introduce a similarly bounded deployment gate for Salesforce sandbox alias `ccdev01`. No deployment capability or Salesforce action is included in this phase.

### Phase 7 — Controlled Azure work-item metadata update

Status: **COMPLETE — 47151 English update verified**

The relay adds `azure_work_item_update` for the already-configured `IoTMart 3.0` Azure DevOps project. It accepts only a work item ID and one or more of title, description, and acceptance criteria. The handler reads the existing item, records the three target fields, writes only supplied values with Azure CLI, then reads it back for exact verification. It cannot modify workflow state, ownership, tags, links, attachments, or any target repository.

Acceptance evidence (2026-09-14):

- `azure-47151-english-update-20260914` wrote the ChatGPT-authored English title, description, and acceptance criteria to work item 47151.
- Azure DevOps canonicalized whitespace immediately before HTML closing `h3`, `p`, and `li` tags. The bounded handler records this explicitly and compares the known canonical representation on read-back.
- `azure-47151-english-verify-20260914` completed as a verified no-op: before and after fields were identical, `verified: true`, and the result links to the IoTMart 3.0 work item.
- No IoTMart or Magnolia repository operation occurred.

### Phase 8 — ChatGPT-to-Codex CLI dispatch

Status: **COMPLETE**

`codex_dispatch` is a bounded relay task for intentionally invoking the already-installed Codex CLI on a configured project. It has fixed `read_only` or `workspace_write` sandbox modes, captures before/after Git state, and preserves pre-existing dirty files. It is not a shell endpoint, deployment path, or session-management subsystem.

Acceptance evidence (2026-09-14):

- `codex-relay-readonly-smoke-20260914` was claimed automatically by the LaunchAgent watcher and ran `codex exec --json` on `iotmart` without a user-operated Codex conversation.
- Codex returned branch `Matthew/feature/OPMailChange` and confirmed the read-only relay smoke; exit status was 0 in 26 seconds.
- IoTMart Git status before and after was byte-identical, including its pre-existing untracked Excel temporary file; `preexisting_dirty_state_changed` was false.
- Fixture coverage validates project/mode/payload allowlisting, bounded output, timeout/non-zero handling, read-only mutation detection, and workspace-write dirty-state protection.

## 7. Immediate next actions

The next local-machine handoff should do only these things:

1. have ChatGPT issue 47122 search/read/review relay tasks, then one exact clean-file comment replacement and diff request
2. preserve `codex exec --json` for future model-driven work; do not introduce `mcp-server` or `app-server`
3. do not commit, deploy, or otherwise modify target repositories beyond the separately reviewed one-comment IoTMart change

Once Phase 0 succeeds, ChatGPT should review the result and design the MCP wrapper against the actual current Agent Bridge code.

## 8. Working protocol

- GitHub branch of record: `feature/chatgpt-codex-bridge`
- every meaningful step updates this file
- machine-local findings that affect setup also update `docs/HANDOFF.md`
- architecture changes update `docs/DECISIONS.md`
- no secrets in Git
- target repos remain read-only until this plan explicitly changes
