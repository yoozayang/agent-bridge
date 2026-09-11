# ChatGPT-Codex Agent Bridge Working Rules

This fork is being adapted so ChatGPT can act as the planner/orchestrator and delegate work to the user's Mac only when local execution is required, while preserving Agent Bridge's durable task ledger.

## Source of truth

Before doing any project work, read:

1. `docs/IMPLEMENTATION_PLAN.md`
2. `docs/HANDOFF.md`
3. `docs/DECISIONS.md`
4. `docs/NEXT_LOCAL_TASK.md`
5. upstream architecture docs relevant to the code being changed

After every meaningful implementation step, update `docs/IMPLEMENTATION_PLAN.md` before stopping. If a design choice changes, also update `docs/DECISIONS.md`. If machine setup or takeover instructions change, update `docs/HANDOFF.md`.

## Roles

- ChatGPT owns architecture, planning, review, shared documentation, GitHub-side changes, and the decision about whether Codex is needed.
- The local bridge owns deterministic local operations when they can be done without a model turn.
- Codex is a local executor/sub-agent only when the task actually needs local code reasoning, broad repo exploration, or an iterative edit/test loop.
- The local agent must not redesign the architecture independently unless the current plan is demonstrably blocked. Record the evidence first.

## Human-interaction policy

The user is temporarily acting only as a relay that tells the local agent to sync the branch and read `docs/NEXT_LOCAL_TASK.md`.

Do not repeatedly ask the user to choose implementation details, inspect product UI, search settings, copy logs, or decide technical next steps. ChatGPT is the planner/reviewer and should receive those facts through the repository or bridge.

Only interrupt the user when human action is genuinely required, such as:

- authentication/login/SSO/MFA or granting an external permission
- an OS/browser security confirmation that cannot be completed programmatically
- an irreversible/destructive action requiring explicit approval
- a missing secret/credential that must be supplied by the user

When user action is unavoidable, ask for exactly one minimal action and stop. Do not chain multiple speculative UI steps. Do not infer that a product feature is unavailable merely because a UI control was not found; record the observed evidence and let ChatGPT decide.

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

Upstream Agent Bridge is Claude-Code-facing and calls Codex internally. This fork preserves its durable task ledger and local execution machinery, but the ChatGPT-to-Mac transport must not depend on a ChatGPT custom-MCP feature that is unavailable to the user's current account.

The local MCP adapter already exists and remains useful, but the next transport PoC may use GitHub as the command/result relay because ChatGPT already has authenticated write/read access to this repository and the Mac already has authenticated Git/GitHub access.

Do not expose arbitrary shell execution. Prefer narrow task types and configured logical project IDs.

## Stop conditions

Stop and report instead of improvising if work requires:

- creating or changing OpenAI credentials/API keys
- destructive commands
- force-push
- write access to target repositories before the read-only PoC is accepted
- architecture changes that discard the Agent Bridge durable ledger without a documented reason
