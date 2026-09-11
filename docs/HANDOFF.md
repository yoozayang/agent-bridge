# Cross-Mac Handoff Guide

This file is for taking over the ChatGPT ↔ Agent Bridge ↔ Codex project on another Mac without relying on previous chat/session context.

## Repository

Fork:

`git@github.com:yoozayang/agent-bridge.git`

Working branch:

`feature/chatgpt-codex-bridge`

Recommended local path:

`~/Development/ChatGPT-CodexAgent-Bridge`

## Before doing work

Read, in order:

1. `AGENTS.md`
2. `docs/IMPLEMENTATION_PLAN.md`
3. `docs/DECISIONS.md`

Do not assume another machine has the same absolute project paths.

## MacBook A known state

As of 2026-09-11:

- bridge repo cloned to `/Users/yoozayang/Development/ChatGPT-CodexAgent-Bridge`
- origin/upstream are configured
- local branch exists
- Codex CLI is repaired at `/opt/homebrew/bin/codex` (`codex-cli 0.154.0`) and authenticated using ChatGPT
- Current Codex CLI has no `mcp-server` command; the PoC transport is the upstream `codex exec --json` fallback (do not downgrade Codex or use `app-server`)
- A temporary read-only `codex exec --json` smoke test passed and produced the full Agent Bridge durable ledger with zero file changes
- Phase 1 read-only inspections of IoTMart3.0 and Magnolia `light-modules` passed; both target working trees remained unchanged and both task ledgers were complete
- IoTMart3.0 is a valid Git repo and currently dirty; keep it read-only
- `/Users/yoozayang/Magnolia` is not itself a Git repo; its `base`, `light-modules`, and `light-modules` worktree roots have been identified and remain read-only

## MacBook B bootstrap target

The intended takeover flow is approximately:

```bash
git clone git@github.com:yoozayang/agent-bridge.git ~/Development/ChatGPT-CodexAgent-Bridge
cd ~/Development/ChatGPT-CodexAgent-Bridge
git checkout feature/chatgpt-codex-bridge
git remote add upstream https://github.com/teamnebula-ai/agent-bridge.git
```

Then verify local prerequisites rather than assuming them:

```bash
git --version
gh --version
node --version
npm --version
codex --version
```

Do not create API keys merely to satisfy setup. If Codex requires login, prefer the user's existing supported ChatGPT/Codex account login path unless the implementation plan explicitly changes.

## Project paths

Logical projects must eventually be mapped locally rather than hard-coded in source.

MacBook A currently reports:

```text
iotmart  -> /Users/yoozayang/Development/IoTMart3.0
magnolia -> select one of the read-only discovered roots: `base`, `light-modules`, or the `light-modules` worktree under `/Users/yoozayang/Magnolia`
```

MacBook B should provide its own equivalents.

## Safety

Until `docs/IMPLEMENTATION_PLAN.md` says otherwise:

- target repositories are read-only
- do not clean/restore the dirty IoTMart working tree
- do not make branches in target repositories
- do not commit target-repo changes
- bridge fork changes belong on `feature/chatgpt-codex-bridge`

## How to finish a handoff

Before stopping work on either Mac:

1. update the current status/blockers/next action in `docs/IMPLEMENTATION_PLAN.md`
2. update this file if setup/takeover instructions changed
3. update `docs/DECISIONS.md` if an architectural choice changed
4. commit/push bridge-repo documentation/code changes
5. report the final bridge branch and commit SHA

The next machine/agent should be able to continue from Git alone.
