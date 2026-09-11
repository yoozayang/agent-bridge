# Cross-Mac Continuity Requirement

A second MacBook must be able to clone this repository, read the repository documentation, and understand how to finish or continue the setup with only minimal additional explanation from the user.

The repository is the shared source of truth. Important setup knowledge must not live only in ChatGPT conversation history, a Codex session, or one machine's local state.

## Required handoff behavior

A new Mac should be able to:

1. Clone `yoozayang/agent-bridge`.
2. Checkout the active integration branch while development is ongoing.
3. Read `AGENTS.md`, `docs/IMPLEMENTATION_PLAN.md`, and this file.
4. Run the documented bootstrap / doctor steps.
5. Supply only machine-specific values that cannot be committed, such as local repository paths, login/authentication, tunnel identifiers, or secrets.
6. Continue from the current status without repeating investigation already completed on another Mac.

## Design rule

Any implementation change that affects install, configuration, validation, local paths, authentication, tunnel setup, or operational workflow must update the repository documentation in the same work cycle.

If a future agent discovers setup knowledge that exists only on one machine or only in chat history, treat that as a documentation defect and fix it before the task is considered complete.

## Current MacBook A path hints

- Agent Bridge working copy: `/Users/yoozayang/Development/ChatGPT-CodexAgent-Bridge`
- IoTMart3.0: `/Users/yoozayang/Development/IoTMart3.0`
- Magnolia workspace hint: `/Users/yoozayang/Magnolia`

These are current-machine facts only. Product code and shared configuration must not hard-code them.
