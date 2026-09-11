# Next Local Task — MacBook A

Owner: local agent on MacBook A
Planner/reviewer: ChatGPT

Read first:

- `AGENTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/HANDOFF.md`
- `docs/DECISIONS.md`

## Objective

Extend the already-working GitHub relay just enough for ChatGPT to complete Azure work item **47122** end-to-end without a Codex model turn for the project operation itself.

47122 requirement already retrieved through the relay:

- title: `[Matthew][test] 註解簡體轉繁體`
- description: `找出任何一個檔案，有簡體註解的，修改成繁體註解，不可影響任何其他程式碼`
- final deployment target: **Salesforce sandbox alias `ccdev01`**

The desired flow is:

`ChatGPT -> relay search/read -> ChatGPT selects one safe candidate -> relay exact comment edit -> relay diff/status -> ChatGPT reviews -> deploy gate -> deploy only this change to ccdev01 -> verify deployment`

This is the first intentionally write-capable target-repository PoC, but the write surface must be extremely narrow and deterministic.

Important: this implementation task is still only to add the bounded search/read/edit/diff primitives. Do **not** deploy anything yet. After ChatGPT reviews the actual 47122 diff, ChatGPT will issue the next task to add/use a bounded Salesforce deployment capability for `ccdev01`.

## Human-interaction rule

Do not ask the user anything except unavoidable authentication/login/SSO/MFA/permission actions.

Do not ask the user to choose files, inspect diffs, decide implementation details, paste logs, restart things manually, or decide deployment mechanics. Record facts in the repo; ChatGPT will review them.

For the later `ccdev01` deployment phase, use existing authenticated Salesforce CLI state if valid. Only involve the user if Salesforce login/MFA/passkey/permission is actually required.

## Current relay

Keep the existing GitHub inbox/outbox/processed contract and durable local ledger.

Existing task types remain unchanged:

- `bridge_ping`
- `project_git_status`
- `azure_work_item_read`

The current foreground watcher is expected to be running as:

`node bin/agent-bridge-relay.js --interval 30`

After implementing the new handlers, restart the watcher yourself so it loads the new code. Do not ask the user to restart it unless process ownership/permissions make that impossible.

## Add four bounded task types

### 1. `project_text_search`

Purpose: read-only search for candidate Simplified-Chinese comments.

Input:

- `project`: allowlisted logical project ID; this PoC needs `iotmart`
- `query`: bounded UTF-8 literal string only, no shell/regex injection
- optional bounded `max_results`

Behavior:

- search only inside the configured project root
- no arbitrary absolute path
- return relative path, line number, and a short line/context excerpt
- skip `.git`, generated/build/vendor dependency directories where practical
- must not modify the repository
- do not invoke Codex

This primitive may be called several times by ChatGPT with likely Simplified-Chinese characters/phrases. Do not try to make the worker itself semantically decide Chinese variants.

### 2. `project_file_read`

Purpose: let ChatGPT inspect a selected candidate before editing.

Input:

- `project`
- `relative_path`
- bounded start/end line or equivalent bounded context window

Behavior:

- resolve strictly beneath the configured project root
- reject traversal, absolute paths, and symlink escape
- bounded output only
- read-only, no Codex

### 3. `project_comment_replace`

Purpose: one exact comment-only replacement selected by ChatGPT.

Input:

- `project`
- `relative_path`
- `old_text`
- `new_text`
- `expected_count`: must be exactly `1`

Required safety gates before writing:

1. path resolves strictly beneath configured project root; reject traversal/absolute path/symlink escape
2. target file must be **clean before this relay edit** (`git status --porcelain -- <path>` empty); this prevents touching either of IoTMart's two pre-existing modified Apex files
3. `old_text` must occur exactly once in the file
4. replacement must be same-line / comment-only: old and new values must preserve the same recognizable comment prefix/context (`//`, `/*`, `*`, `#`, `<!--`/`-->`, or another explicitly implemented safe comment form). If this cannot be proved deterministically, reject rather than guess
5. no newline-count change
6. write only that exact occurrence; no formatter, no whole-file normalization, no line-ending conversion
7. immediately obtain `git diff -- <path>` and verify exactly one target file changed
8. if any safety check fails after write, restore only this worker's exact edit to the pre-write bytes; never reset/checkout unrelated files

Return:

- relative path
- replacement count
- before/after hashes
- compact diff
- repository porcelain/status summary

Do not commit the IoTMart change. Leave the single reviewed working-tree comment change uncommitted for ChatGPT/user review.

### 4. `project_git_diff`

Purpose: deterministic review after the edit.

Input:

- `project`
- optional `relative_path`

Behavior:

- bounded `git diff` output
- read-only
- no Codex

## 47122 execution strategy

Do **not** autonomously choose and edit a candidate during implementation.

Implement/test the new relay handlers using safe bridge fixtures or non-target temporary data where possible. Then restart the live watcher and stop.

ChatGPT will drive the actual 47122 sequence through inbox tasks:

1. search for likely Simplified-Chinese comment text
2. read candidate context
3. select a clean, low-risk file that is not one of the two pre-existing modified IoTMart files
4. issue one exact comment replacement
5. request diff/status and review it
6. only after review, perform a separate deploy phase targeting **`ccdev01`**
7. verify the deployment result and report it back through the relay

The deploy phase must be separately gated. Do not create a broad arbitrary-shell deployment path as part of this task.

This separation is intentional: ChatGPT owns the engineering and deployment decision; the Mac worker is the deterministic execution layer.

## Security / validation

- no arbitrary shell task
- no arbitrary command strings in relay payloads
- payload size remains bounded
- logical project IDs only
- strict path containment
- target write only through `project_comment_replace`
- no Codex model turn for search/read/edit/diff
- existing dedup/claim behavior remains intact
- preserve the two pre-existing IoTMart modified files byte-for-byte
- do not commit/push IoTMart or Magnolia
- do not deploy to `ccdev01` during this implementation task

Add focused tests for validation, path traversal rejection, dirty-target rejection, exact-count rejection, and a successful comment-only fixture replacement.

## Documentation

Update:

- `relay/README.md` with the four new task contracts
- `docs/IMPLEMENTATION_PLAN.md` with the controlled-write PoC status and the final 47122 deployment target `ccdev01`
- `docs/HANDOFF.md` if watcher startup/restart instructions change
- `docs/DECISIONS.md` only if a material architecture decision changed

Commit and push only the Agent Bridge repository changes on `feature/chatgpt-codex-bridge`.

## Before stopping

Restart the foreground relay watcher with the new code and confirm a new `bridge_ping` works after restart.

Return only:

- new deterministic task types implemented
- tests/results
- watcher restart/health
- confirmation that IoTMart was not modified during implementation
- confirmation the two existing dirty files remain byte-identical
- pushed Agent Bridge commit SHA
- blocker, if any

Then stop. ChatGPT will issue the actual 47122 search/edit/review tasks through the relay, followed by a separately gated `ccdev01` deploy phase.
