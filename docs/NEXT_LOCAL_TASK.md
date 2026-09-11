# Next Local Task — MacBook A

Owner: local agent on MacBook A
Planner/reviewer: ChatGPT

Read first:

- `AGENTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/HANDOFF.md`

## Objective

Clear Phase 0 blockers only. Do not implement the ChatGPT-facing MCP server yet.

## Task A — Repair Codex CLI

Current failure:

The installed Codex launcher expects:

`/opt/homebrew/lib/node_modules/@openai/codex/vendor/aarch64-apple-darwin/codex/codex`

but that native binary is missing.

Investigate the current installation and repair/reinstall the official Codex CLI using the safest supported local method.

After repair, verify:

```bash
which codex
codex --version
```

Then verify the current authentication/login state using commands supported by the installed version. Do not create a new OpenAI API key. If interactive account login is required, stop and tell the user exactly what to do.

Verify that the MCP server command is present/startable:

```bash
codex mcp-server
```

Do not leave an orphaned background process; a short startup/protocol sanity check is sufficient.

## Task B — Find Magnolia Git roots, read-only

`/Users/yoozayang/Magnolia` is a workspace but not a Git repository at its root.

Perform a read-only inventory beneath that directory to identify relevant `.git` roots/repositories. Keep the search bounded and avoid changing files.

Report for each likely Magnolia repository:

- absolute path
- current branch
- clean/dirty status
- origin remote if available

Do not checkout, reset, clean, stash, branch, commit, or push.

## Task C — Preserve IoTMart working tree

Do not alter:

`/Users/yoozayang/Development/IoTMart3.0`

It was observed dirty on:

`Matthew/bugfix/46919_Referral_Click_Tracking_UAT_Gap`

with two modified Apex files.

You may only re-check branch/status read-only if needed.

## Before stopping

Update `docs/IMPLEMENTATION_PLAN.md` with:

- repaired Codex version/path
- Codex auth status
- whether `codex mcp-server` starts
- Magnolia repository root(s)
- any remaining blocker
- updated Phase 0 status

Update `docs/HANDOFF.md` if setup instructions changed.

Commit and push only changes in the Agent Bridge repository on:

`feature/chatgpt-codex-bridge`

Do not commit or modify either target repository.

## Final response

Return only:

- Codex repair result
- Codex version/path
- auth status
- MCP server status
- Magnolia Git roots found
- target repo safety check
- Agent Bridge commit SHA pushed
- remaining blocker, if any
