# Next Local Task — Add ChatGPT → Codex CLI Dispatch

Owner: local agent on `mac-cd134ffbc7aa2eb9`
Planner/reviewer: ChatGPT

Status: **READY**

## Goal

Remove the remaining human relay between ChatGPT and Codex.

After this task is complete, normal usage must be:

```text
User → ChatGPT → GitHub relay inbox → Mac LaunchAgent watcher
                                  → deterministic handler, when sufficient
                                  → Codex CLI, when local AI reasoning/editing is required
                                  → relay outbox → ChatGPT review
```

The user must **not** need to open a Codex conversation, paste prompts, or tell Codex to read `NEXT_LOCAL_TASK.md` for ordinary future work.

The existing GitHub relay, machine routing, LaunchAgent, Azure handlers, and bounded project tools are already working. Do not redesign transport, MCP, tunnel, or connectors.

## Objective

Add one bounded relay task that lets ChatGPT deliberately launch the already-installed local Codex CLI on a known configured project.

Preferred task name: `codex_dispatch`.

This is a controlled Codex entry point, **not** an arbitrary shell endpoint.

## Required contract

`codex_dispatch` must accept only bounded structured fields such as:

- `project`: known logical project ID only (`iotmart`, `magnolia`, optionally `agent-bridge` if useful for self-maintenance)
- `instruction`: bounded UTF-8 natural-language task from ChatGPT
- `mode`: `read_only` or `workspace_write`
- optional bounded execution timeout / effort field only if the existing Codex CLI supports it safely
- `machine_id`: existing routing field

Do **not** accept:

- absolute paths
- arbitrary cwd
- arbitrary executable/command/shell strings
- environment-variable injection
- arbitrary Codex CLI flags
- deployment target
- secrets/tokens
- `danger-full-access` or an equivalent unrestricted mode

Use the configured logical project root from local ignored config. Never trust a path from the relay payload.

## Codex execution

Use the currently installed official Codex CLI. Inspect the local `codex --help` / `codex exec --help` and use the supported non-interactive JSON/event mode; do not downgrade Codex and do not restore the removed `codex mcp-server` path.

The existing known-good direction is `codex exec --json` (or the current equivalent if CLI help shows a renamed supported form).

The worker must spawn Codex itself. No Terminal UI and no separate Codex conversation may be required.

For `read_only`:

- Codex must not modify project files.
- Capture git status before and after and fail verification if Codex introduced a project change.

For `workspace_write`:

- Codex may edit files under the selected configured project root only.
- Preserve all pre-existing dirty/untracked state.
- Do not run git reset/clean/stash/checkout/switch/rebase.
- Do not commit or push the target project.
- Do not deploy to Salesforce, Azure, Magnolia, Production, UAT, or any remote environment.
- Record git status/diff before and after so ChatGPT can review the actual local result.
- Existing unrelated dirty files must remain untouched. If reliable enforcement is possible without overengineering, compare before/after hashes or diffs for pre-existing dirty files and return an error if Codex altered them.

Deployment remains a separate explicitly approved capability and must **not** be smuggled through `codex_dispatch`.

## Result contract

Write the normal `relay/outbox/<task-id>.json` with a bounded result containing at least:

- task id / status
- project
- mode
- machine_id
- Codex exit status
- bounded final Codex response/summary
- elapsed time
- git status before
- git status after
- bounded project diff after execution (for `workspace_write`; preferably only changes attributable to this run)
- whether pre-existing dirty state changed
- error/blocker details when execution fails

Do not put secrets or full environment dumps in the result.

If Codex times out or exits non-zero, preserve the working tree as-is, report the failure clearly, and do not try destructive recovery.

## Multi-turn behavior

A persistent interactive Codex chat is **not required** for this milestone.

It is acceptable and preferred initially for ChatGPT to orchestrate multiple bounded turns:

```text
ChatGPT → codex_dispatch #1 → outbox → review
ChatGPT → codex_dispatch #2 → outbox → review
```

If the current Codex CLI provides a safe stable resume/thread identifier essentially for free, you may return it and optionally accept a bounded `resume_id` in a later dispatch. Do not delay the task or introduce a large session-management subsystem just to support this.

## Safety / compatibility requirements

1. Keep all existing relay task types working unchanged.
2. Respect existing `machine_id` routing and atomic claim behavior.
3. Do not expose arbitrary shell execution.
4. Do not expose arbitrary filesystem paths.
5. Do not expose unrestricted Codex sandbox modes.
6. No source deployment, commit, push, branch switch, reset, clean, or stash through this task.
7. No target repo modification while implementing this Bridge capability itself.
8. Do not modify IoTMart/Magnolia as part of implementation testing; use read-only smoke or a safe temporary/fixture project for write-mode tests.
9. Do not ask the user anything except unavoidable login/SSO/MFA/permission actions.

## Tests

Add focused automated/fixture coverage for at least:

- valid read-only dispatch
- invalid project rejected
- invalid mode rejected
- oversized instruction rejected
- unknown fields / command-injection-shaped fields rejected as contract violations
- machine routing still respected
- read-only post-run mutation detection
- timeout/non-zero result handling
- bounded output
- write-mode safety contract without touching the real target repos

Run the existing relay tests plus the new tests.

## Documentation

Update at least:

- `relay/README.md` — document `codex_dispatch` contract and explicit non-goals
- `docs/HANDOFF.md` / `docs/IMPLEMENTATION_PLAN.md` / `docs/DECISIONS.md` as appropriate
- this file with completion evidence

The docs must state clearly:

> ChatGPT can now launch Codex CLI through the relay without the user opening or operating a Codex conversation. Codex remains a delegated local sub-agent; deterministic handlers remain preferred for fixed operations.

## LaunchAgent reload

After implementation:

1. commit and push Agent Bridge changes to `feature/chatgpt-codex-bridge`
2. reload/restart the existing user LaunchAgent yourself so it runs the new handler
3. verify watcher health on `mac-cd134ffbc7aa2eb9`

Do not require the user to reopen Terminal.

## Acceptance smoke — prove ChatGPT can launch Codex without a Codex conversation

After the new handler is live, create/execute a safe `codex_dispatch` smoke task targeted at `mac-cd134ffbc7aa2eb9`:

- `project`: `iotmart`
- `mode`: `read_only`
- instruction: inspect the repository at a very high level and return the current Git branch plus a short statement that this was a read-only Codex CLI relay smoke test; do not modify any file

Acceptance requires:

- watcher receives it automatically
- local worker launches Codex CLI automatically
- no user interaction / separate Codex conversation
- outbox reports success
- IoTMart git state before and after is unchanged
- existing dirty/untracked files are preserved exactly

Then stop. Do not perform any unrelated business-code task.

## Completion report

Record and push:

- implementation commit SHA
- exact supported `codex_dispatch` contract
- tests run/result
- LaunchAgent reload/health result
- smoke task ID
- Codex execution success/result summary
- before/after git-state verification
- confirmation no target repo was modified
- blocker, if any

Once this is complete, future workflow should be:

```text
User: "你幫我改這個"
ChatGPT decides whether deterministic tools are enough.
If local AI work is needed, ChatGPT sends `codex_dispatch` itself.
Codex CLI runs locally and writes the result to relay outbox.
User may later ask ChatGPT "改完了嗎？"
ChatGPT reads/reviews the result.
```

No additional Codex conversation should be required for ordinary work.
