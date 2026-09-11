# Next Local Task — MacBook A

Owner: local agent on MacBook A
Planner/reviewer: ChatGPT

Read first:

- `AGENTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/HANDOFF.md`
- `docs/DECISIONS.md`

## Objective

Implement a **GitHub-relay PoC** so ChatGPT can hand work to the user's Mac without requiring ChatGPT custom MCP / Developer Mode availability and without using the user as a copy/paste relay after initial startup.

This task replaces the blocked ChatGPT custom-MCP connection as the immediate transport PoC. Keep the existing local MCP/tunnel work intact; do not remove it.

Target flow:

`ChatGPT -> GitHub relay files -> local bridge watcher -> Agent Bridge/local deterministic handler -> GitHub result files -> ChatGPT`

ChatGPT already has authenticated read/write access to `yoozayang/agent-bridge`. MacBook A already has authenticated Git/GitHub access. Use that fact rather than introducing another hosted service for this PoC.

## Why this route

The selected upstream `teamnebula-ai/agent-bridge` is intentionally filesystem-ledger based and does not provide ChatGPT-web connectivity by itself. The local MCP adapter and Secure MCP Tunnel were validated locally, but the user's current ChatGPT UI does not expose the custom connector entry required to complete that route.

Other projects confirm that GitHub can act as a control plane for local coding agents, and upstream Agent Bridge already proves the value of durable file-based task state. For this PoC, implement the smallest safe GitHub-backed mailbox around the existing Agent Bridge rather than replacing the ledger or adding a new remote service.

## Human-interaction rule

Do not ask the user anything except for unavoidable authentication/login/SSO/MFA/permission actions.

Do not ask the user to inspect ChatGPT settings, choose architecture, paste logs, decide filenames, or approve normal implementation details. Record implementation facts in the repo and let ChatGPT review them.

If authentication is required, ask for one minimal action only, then resume automatically if possible.

## Scope

### A. Add a GitHub relay inbox/outbox contract

Create a narrow, auditable relay format in this repository. Prefer a dedicated path such as:

- `relay/inbox/<task-id>.json`
- `relay/outbox/<task-id>.json`
- optional `relay/processed/<task-id>.json` or local dedup state

The exact layout may differ if the codebase has a cleaner convention, but the contract must provide:

- unique task ID
- task type
- logical project ID
- bounded payload
- created timestamp
- status/result/error
- deduplication / at-most-once local execution protection

Do not put secrets, credentials, arbitrary absolute paths, or unrestricted shell strings in relay payloads.

### B. Implement a local watcher/worker

Add a local command/service that:

1. polls or fetches the branch of record for new relay tasks at a conservative interval
2. claims/deduplicates a task safely
3. executes only allowlisted task types
4. writes a compact result to the outbox
5. commits/pushes only relay/result state and bridge documentation/code as appropriate
6. continues watching without requiring the user to relay each task

For the first PoC, a foreground process is acceptable. If the repository already has a safe service/autostart mechanism, document but do not overbuild it.

Use authenticated `git`/`gh` already present on the machine. Do not create a GitHub App, webhook server, Redis service, or new cloud dependency for the first PoC.

Handle GitHub races conservatively. Fetch/rebase/retry narrowly; never force-push.

### C. Initial allowlisted task types

Implement only enough deterministic functionality to prove ChatGPT-to-Mac round trip without spending a Codex model turn.

Required initial task types:

1. `bridge_ping`
   - returns bridge/watcher health, version/commit, and current mode

2. `project_git_status`
   - input: configured logical project ID (`iotmart` or `magnolia`)
   - output: branch + porcelain/status summary
   - strictly read-only

3. `azure_work_item_read`
   - input: work item numeric ID only
   - use the machine's existing authenticated Azure DevOps CLI/API capability if available
   - return a compact normalized payload containing at least title, state, description/acceptance criteria or equivalent relevant fields, plus URL/ID metadata if available
   - this is deterministic local retrieval; do NOT invoke Codex merely to read the work item

Do not implement arbitrary shell, write/edit, deploy, or target-repo modification yet.

### D. Azure 47122 is the real PoC target

After the worker implementation is validated locally, prove `azure_work_item_read` against work item **47122**.

Important:

- If Azure auth is already valid, read it without asking the user anything.
- If Azure requires login/SSO/MFA, ask the user for only that authentication action; then continue.
- Do not ask the user to copy the Azure task content manually.
- Do not modify the Azure work item.
- Do not modify IoTMart or Magnolia.

The result for 47122 should be written through the relay outbox in the same format ChatGPT will later read.

### E. Preserve Agent Bridge / Codex role separation

This PoC should establish that deterministic local operations do not need a Codex model turn.

Codex should remain available behind Agent Bridge for future tasks that require:

- broad local codebase exploration where bounded reads are inefficient
- reasoning across substantial uncommitted local-only state
- iterative edit/test/fix loops
- other genuinely model-driven local work

Do not route `bridge_ping`, `project_git_status`, or `azure_work_item_read` through `codex exec`.

## Local validation

Required checks:

1. relay worker starts and remains alive in foreground without user interaction
2. a test `bridge_ping` inbox task produces exactly one outbox result
3. re-reading/restarting does not execute the same task twice
4. `project_git_status` for `iotmart` returns the existing state without changing it
5. IoTMart Git status before/after remains byte-identical
6. `azure_work_item_read` can retrieve 47122, or stops only for unavoidable Azure authentication
7. no Codex model turn is used for the three deterministic task types
8. no secrets/tokens are committed

## Documentation / architecture update

Update `docs/IMPLEMENTATION_PLAN.md` to reflect:

- ChatGPT custom-MCP route remains a future optional route, not the immediate dependency
- GitHub relay is the current Plus-compatible PoC transport
- deterministic local tools precede Codex delegation
- Azure 47122 retrieval result/status

Update `docs/HANDOFF.md` with exact commands needed on MacBook B to start the relay worker after clone/config/auth.

Update `docs/DECISIONS.md` with an ADR for the transport decision:

- why GitHub relay is used for the PoC
- why it does not replace the Agent Bridge durable local ledger
- security/race/latency tradeoffs
- when Secure MCP Tunnel may be revisited

## Do not overbuild

The purpose is to prove the communication loop, not build a production distributed queue.

Avoid:

- new hosted databases
- GitHub App/webhook setup
- public HTTP servers
- arbitrary command execution
- target-repo writes
- Codex turns for deterministic reads

## Before stopping

Commit and push Agent Bridge changes on `feature/chatgpt-codex-bridge`.

Return only:

- GitHub relay implementation result
- watcher command/startup status
- task types implemented
- dedup/race handling summary
- Azure 47122 retrieval status
- IoTMart safety confirmation
- whether any human authentication action was required
- files/modules changed
- pushed commit SHA
- remaining blocker, if any
