# Next Local Task — MacBook A

Owner: local agent on MacBook A
Planner/reviewer: ChatGPT

Read first:

- `AGENTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/HANDOFF.md`
- `docs/DECISIONS.md`

## Objective

Start Phase 2 by implementing the smallest local ChatGPT-facing MCP server that wraps the existing Agent Bridge control plane.

The goal of this task is only to prove a **local MCP client -> Agent Bridge -> `codex exec --json` -> durable ledger** path. Do not configure OpenAI Secure MCP Tunnel yet.

Do not modify IoTMart3.0 or Magnolia. They remain read-only targets.

## Required design

Preserve the already-verified internal transport:

`codex exec --json`

Do not downgrade Codex. Do not add `codex mcp-server`. Do not migrate to `app-server` in this phase.

The MCP server must reuse the existing Agent Bridge dispatcher/task-ledger/session modules wherever practical rather than duplicating task lifecycle logic.

Do not expose arbitrary shell execution.

## Initial MCP tool surface

Implement only these tools unless the existing code structure makes a slightly smaller surface clearly preferable:

- `bridge_ping()`
- `bridge_projects()`
- `bridge_run_readonly(project, prompt)`
- `bridge_task_status(task_id)`
- `bridge_task_result(task_id)`

`bridge_run_readonly` must:

- accept a logical project ID, not an arbitrary filesystem path
- force read-only execution
- dispatch through the existing Agent Bridge task lifecycle
- use the existing `codex exec --json` transport
- return a task identifier / concise completion metadata
- preserve the normal durable ledger

Do not add write-capable tools.

## Project mapping for MacBook A

Use machine-local configuration, not hard-coded source constants.

Logical mappings for this machine:

- `iotmart` -> `/Users/yoozayang/Development/IoTMart3.0`
- `magnolia` -> `/Users/yoozayang/Magnolia/light-modules`

Committed source should contain only an example/template or configuration loader. Do not commit user-specific secrets. If a local config file is needed, keep the actual machine-local file ignored by Git and commit only its example.

## Implementation expectations

Before editing, inspect the current source to identify:

- dispatcher/task creation entry points
- fslog / task ledger APIs
- existing project/workspace resolution behavior
- current `exec --json` transport invocation

Prefer a narrow adapter around those APIs.

Keep dependencies minimal. If the repo already has an MCP SDK/dependency, use it. If not, add only the minimum supported dependency needed for a stdio MCP server and document the reason.

## Local validation

Validate using a local MCP client or protocol-level stdio test only. Secure MCP Tunnel is explicitly out of scope for this task.

Required checks:

1. `bridge_ping()` responds successfully.
2. `bridge_projects()` reports at least `iotmart` and `magnolia` logical IDs without exposing arbitrary path execution.
3. `bridge_run_readonly("iotmart", <status-only prompt>)` completes through Agent Bridge.
4. The resulting durable ledger contains the normal six files:
   - `task.md`
   - `status.md`
   - `result.md`
   - `events.jsonl`
   - `telemetry.jsonl`
   - `telemetry.json`
5. IoTMart before/after Git state is identical and telemetry reports zero file changes.
6. `bridge_task_status(task_id)` can read the created task.
7. `bridge_task_result(task_id)` can return the created task result.

If the MCP implementation itself needs test fixtures, use temporary directories or Agent Bridge repo-local test files only. Do not create or edit files in target repositories.

## Stop conditions

Stop and report instead of improvising if:

- existing Agent Bridge internals cannot be reused without a substantial redesign
- adding the MCP layer would require weakening read-only guarantees
- the MCP SDK/stdio transport conflicts with the current Node/runtime setup
- a decision is needed about public tool semantics or security boundaries

Record the exact blocker and evidence in the repo before stopping.

## Before stopping

Update `docs/IMPLEMENTATION_PLAN.md` with:

- Phase 2 implementation status
- files/modules added or changed
- MCP tool surface actually implemented
- local MCP validation results
- target-repo safety result
- remaining blocker, if any

Update `docs/HANDOFF.md` with any new install/start/config steps needed for another Mac.

Update `docs/DECISIONS.md` only for material architecture decisions.

Commit and push Agent Bridge changes on:

`feature/chatgpt-codex-bridge`

Do not commit or modify either target repository.

## Final response

Return only:

- MCP server implementation result
- tool surface implemented
- local MCP validation result
- IoTMart safety confirmation
- files/modules changed in Agent Bridge
- Agent Bridge commit SHA pushed
- remaining blocker, if any
