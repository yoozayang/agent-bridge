# ChatGPT ↔ Agent Bridge ↔ Codex Implementation Plan

Last updated: 2026-09-11

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
  | custom MCP connector
  v
OpenAI Secure MCP Tunnel
  |
  v
ChatGPT-facing MCP server (this fork)
  |
  v
Agent Bridge control plane
  |
  +--> durable task ledger / sessions / telemetry
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

Important: ChatGPT must call Agent Bridge, not Codex directly, so task/status/result/session history remains available.

## 3. Why this fork

Upstream already provides the parts we want to preserve:

- filesystem task ledger (`task.md`, `status.md`, `result.md`, events/telemetry)
- Codex CLI `exec --json` fallback transport for the PoC
- named session continuity via Codex `threadId`
- read-only/workspace-write sandbox modes
- warm Codex MCP support
- task status/result inspection

The gap is that upstream is directional from Claude Code to Agent Bridge. This fork needs a small ChatGPT-facing MCP server in front of the existing bridge control plane.

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

Status: **PENDING**

Introduce machine-local project path configuration with committed examples only.

Suggested logical project IDs:

- `iotmart`
- `magnolia`

No source file should hard-code `/Users/yoozayang`.

Create a bootstrap/doctor path that checks local dependencies and project mappings on each Mac.

Acceptance criteria:

- MacBook B can clone the fork
- configure only local paths/auth
- run the same read-only tests without code edits

### Phase 4 — Secure MCP Tunnel / ChatGPT connection

Status: **PENDING**

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

### Phase 5 — Controlled write mode

Status: **OUT OF SCOPE UNTIL READ-ONLY POC ACCEPTED**

Only after explicit approval, consider narrow write tools or workspace-write tasks. Do not enable arbitrary shell or unrestricted repo writes.

## 7. Immediate next actions

The next local-machine handoff should do only these things:

1. have ChatGPT review the completed Phase 2 local MCP evidence and provide the next task
2. preserve `codex exec --json` as the internal PoC transport; do not introduce `mcp-server` or `app-server`
3. keep both target repositories read-only until explicit approval changes the plan

Once Phase 0 succeeds, ChatGPT should review the result and design the MCP wrapper against the actual current Agent Bridge code.

## 8. Working protocol

- GitHub branch of record: `feature/chatgpt-codex-bridge`
- every meaningful step updates this file
- machine-local findings that affect setup also update `docs/HANDOFF.md`
- architecture changes update `docs/DECISIONS.md`
- no secrets in Git
- target repos remain read-only until this plan explicitly changes
