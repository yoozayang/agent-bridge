# Next Local Task — MacBook A

Owner: local agent on MacBook A
Planner/reviewer: ChatGPT

Read first:

- `AGENTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/HANDOFF.md`

## Objective

Complete Phase 1 target-repository read-only validation using the already-verified `codex exec --json` transport through Agent Bridge.

Do not implement the ChatGPT-facing MCP server yet.

## Selected Magnolia target

Use:

`/Users/yoozayang/Magnolia/light-modules`

Reason: this is the active Magnolia source repository on branch `Matthew/bugfix/46919_Referral_Click_Tracking_UAT_Gap_A`, matching the current IoTMart 46919 work context. Do not use the clean deployment worktree or `base` for this first target validation.

## Task A — Read-only IoTMart inspection

Target:

`/Users/yoozayang/Development/IoTMart3.0`

Use Agent Bridge with `codex exec --json` in read-only mode.

Ask Codex only to report:

- current branch
- concise Git working-tree status
- names of currently modified/untracked files
- confirmation that no files were changed by the task

Do not ask Codex to analyze or change the business logic yet.

Before and after the task, capture read-only Git status so the pre-existing dirty state can be compared.

Do not checkout, reset, clean, stash, branch, commit, push, or edit anything in IoTMart.

## Task B — Read-only Magnolia inspection

Target:

`/Users/yoozayang/Magnolia/light-modules`

Use Agent Bridge with `codex exec --json` in read-only mode.

Ask Codex only to report:

- current branch
- concise Git working-tree status
- names of currently modified/untracked files
- confirmation that no files were changed by the task

Before and after the task, capture read-only Git status so the pre-existing dirty state can be compared.

Do not checkout, reset, clean, stash, branch, commit, push, or edit anything in Magnolia.

## Task C — Validate Agent Bridge ledger

For both target runs, verify the durable ledger records exist and are internally consistent, including:

- `task.md`
- `status.md`
- `result.md`
- `events.jsonl`
- `telemetry.jsonl`
- `telemetry.json`

Confirm each task completed successfully and telemetry shows no target file changes.

## Before stopping

Update `docs/IMPLEMENTATION_PLAN.md` with:

- IoTMart read-only validation result
- Magnolia `light-modules` read-only validation result
- before/after working-tree safety confirmation
- ledger validation result
- Phase 1 status
- any remaining blocker before Phase 2

Update `docs/HANDOFF.md` only if setup/continuation instructions materially changed.

Commit and push only Agent Bridge documentation changes on:

`feature/chatgpt-codex-bridge`

Do not modify or commit either target repository.

## Final response

Return only:

- IoTMart inspection result
- Magnolia inspection result
- target repository before/after safety confirmation
- Agent Bridge ledger result
- Agent Bridge commit SHA pushed
- remaining blocker, if any
