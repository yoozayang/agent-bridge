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
codex mcp-server
  |
  v
IoTMart3.0 or Magnolia
```

Important: ChatGPT must call Agent Bridge, not Codex directly, so task/status/result/session history remains available.

## 3. Why this fork

Upstream already provides the parts we want to preserve:

- filesystem task ledger (`task.md`, `status.md`, `result.md`, events/telemetry)
- Codex MCP transport
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
| Codex CLI | BLOCKED: launcher exists but native binary is missing |
| Codex auth | unknown until CLI repaired |
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

Magnolia:

- workspace path: `/Users/yoozayang/Magnolia`
- valid Git repository at that exact root: no
- next investigation: identify repository/repositories beneath this workspace without modifying anything

### MacBook B

Not set up yet. It must be able to clone this fork and follow `docs/HANDOFF.md` without relying on prior chat/session context.

## 5. Current blockers

### Blocker A — Codex CLI installation is broken

Observed missing path:

`/opt/homebrew/lib/node_modules/@openai/codex/vendor/aarch64-apple-darwin/codex/codex`

Until repaired we cannot validate:

- `codex --version`
- Codex login/authentication
- `codex mcp-server`
- Agent Bridge → Codex transport

Repair should be treated as a local-machine task and verified before changing bridge source code.

### Blocker B — Magnolia repo location is unresolved

`/Users/yoozayang/Magnolia` is a workspace but not itself a Git repository. We need a read-only inventory of immediate/nested Git repos and then configure the actual repository roots.

### Non-blocker — `agy` missing

Antigravity is unrelated to the first ChatGPT ↔ Codex PoC. Do not install it merely to make `doctor` fully green.

## 6. Implementation phases

### Phase 0 — Stabilize local prerequisites

Status: **IN PROGRESS / BLOCKED**

Tasks:

- repair Codex CLI on MacBook A
- verify Codex account login without creating a new API key if existing ChatGPT/Codex account login works
- verify `codex mcp-server` starts
- identify Magnolia Git repo root(s)
- leave IoTMart3.0 untouched

Exit criteria:

- `codex --version` works
- authentication status is known
- read-only Codex smoke test works outside project repos
- Magnolia repo mapping is known

### Phase 1 — Validate upstream Agent Bridge unchanged

Status: **PENDING**

Use upstream behavior before custom code.

Run a read-only smoke test in a temporary directory and confirm the ledger contains:

- `task.md`
- `status.md`
- `result.md`
- `events.jsonl`
- telemetry files

Then run read-only inspection against each configured target repository.

Acceptance criteria:

- Codex can report IoTMart3.0 branch/status without modifying it
- Codex can report Magnolia repository status without modifying it
- Agent Bridge task ledger accurately records both runs

### Phase 2 — Add ChatGPT-facing MCP surface

Status: **PENDING**

Add the smallest possible MCP server that wraps existing Agent Bridge operations.

Initial proposed tool surface:

- `bridge_ping()`
- `bridge_projects()`
- `bridge_run_readonly(project, prompt, session?)`
- `bridge_task_status(task_id|latest)`
- `bridge_task_result(task_id|latest)`
- `bridge_sessions()`

Design requirements:

- reuse existing dispatcher/task ledger/session machinery
- do not shell arbitrary user input directly
- resolve project IDs through configuration rather than absolute paths supplied by ChatGPT
- default to read-only
- no write-capable ChatGPT tool in this phase

Acceptance criteria:

- a local MCP client can call `bridge_ping`
- a local MCP client can ask for read-only investigation in IoTMart3.0/Magnolia
- resulting work appears in the normal Agent Bridge ledger

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

1. repair/reinstall the Codex CLI on MacBook A and verify the native binary actually exists
2. verify `codex --version` and current login/auth state
3. verify `codex mcp-server` can start
4. perform a read-only search beneath `/Users/yoozayang/Magnolia` for Git roots and report them
5. do not modify either target repo
6. update this document with actual results before stopping

Once Phase 0 succeeds, ChatGPT should review the result and design the MCP wrapper against the actual current Agent Bridge code.

## 8. Working protocol

- GitHub branch of record: `feature/chatgpt-codex-bridge`
- every meaningful step updates this file
- machine-local findings that affect setup also update `docs/HANDOFF.md`
- architecture changes update `docs/DECISIONS.md`
- no secrets in Git
- target repos remain read-only until this plan explicitly changes
