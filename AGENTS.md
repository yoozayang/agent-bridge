# ChatGPT-Codex Agent Bridge Working Rules

This fork is being adapted so ChatGPT can act as the planner/orchestrator and delegate work to local Codex through Agent Bridge while preserving Agent Bridge's durable task ledger.

## Source of truth

Before doing any project work, read:

1. `docs/IMPLEMENTATION_PLAN.md`
2. `docs/HANDOFF.md`
3. `docs/DECISIONS.md`
4. upstream architecture docs relevant to the code being changed

After every meaningful implementation step, update `docs/IMPLEMENTATION_PLAN.md` before stopping. If a design choice changes, also update `docs/DECISIONS.md`. If machine setup or takeover instructions change, update `docs/HANDOFF.md`.

## Roles

- ChatGPT owns architecture, planning, review, shared documentation, and GitHub-side changes when possible.
- The local agent/Codex owns operations that require the user's Mac filesystem, local CLIs, localhost services, or local repository inspection.
- Do not redesign the architecture independently unless the current plan is demonstrably blocked. Record the blocker first.

## Repositories

Bridge working copy on the user's Mac:

`/Users/yoozayang/Development/ChatGPT-CodexAgent-Bridge`

Target repositories on MacBook A:

- IoTMart3.0: `/Users/yoozayang/Development/IoTMart3.0`
- Magnolia workspace: `/Users/yoozayang/Magnolia`

Paths are machine-specific. New bridge code must not hard-code `/Users/yoozayang`; use configuration/environment overrides.

## Safety until explicitly changed

IoTMart3.0 and Magnolia are READ ONLY during the bridge PoC.

Do not modify, commit, push, reset, clean, stash, create branches, or change checkout state in either target repository.

The bridge fork itself may be modified on `feature/chatgpt-codex-bridge`.

Never commit credentials, `.env`, API keys, access tokens, cookies, or machine-specific secrets.

## Current design constraint

Upstream Agent Bridge is Claude-Code-facing and calls Codex internally. This fork must preserve its task ledger/session/transport machinery but add a ChatGPT-facing MCP surface rather than bypassing Agent Bridge and calling Codex directly.

The first ChatGPT-facing surface should be deliberately narrow and auditable. Initial candidate tools are:

- `bridge_ping`
- `bridge_projects`
- `bridge_run_readonly`
- `bridge_task_status`
- `bridge_task_result`
- `bridge_sessions`

Do not expose arbitrary shell execution to ChatGPT in v1.

## Stop conditions

Stop and report instead of improvising if work requires:

- creating or changing OpenAI credentials/API keys
- changing ChatGPT account/connector settings
- destructive commands
- force-push
- write access to target repositories before the read-only PoC is accepted
- architecture changes that bypass the Agent Bridge task ledger
