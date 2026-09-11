# Next Local Task — MacBook A

Owner: local agent on MacBook A
Planner/reviewer: ChatGPT

Read first:

- `AGENTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/HANDOFF.md`
- `docs/DECISIONS.md`

## Objective

Connect the already-working local stdio ChatGPT-facing MCP server to ChatGPT using OpenAI Secure MCP Tunnel.

This task is about connectivity only. Do not modify IoTMart3.0 or Magnolia, do not add write-capable MCP tools, and do not investigate Azure work item 47122 yet.

The desired first end-to-end proof is:

`ChatGPT -> Secure MCP Tunnel -> local agent-bridge MCP -> bridge_ping()`

Once that works, stop. ChatGPT will then drive the first real PoC (Azure work item 47122) through the connected bridge.

## Current local MCP entrypoint

Use the MCP server already implemented in this branch:

`bin/agent-bridge-mcp.js`

Preserve its current read-only tool surface and `codex exec --json` internal transport.

## Task A — Install / verify official tunnel client

Use the current official OpenAI Secure MCP Tunnel client and documentation. Do not invent flags from old examples if the installed version differs.

On macOS, prefer the official Homebrew installation path if not already installed:

`brew install openai/tools/tunnel-client`

Verify the installed version and inspect its current help/quickstart before configuring anything.

Do not commit credentials, tokens, tunnel IDs, generated secrets, or machine-local auth state.

## Task B — Configure the local stdio MCP behind the tunnel

Configure a tunnel/profile that launches this repository's stdio MCP entrypoint from the Agent Bridge working copy.

Working copy on MacBook A:

`/Users/yoozayang/Development/ChatGPT-CodexAgent-Bridge`

MCP command should ultimately launch:

`node /Users/yoozayang/Development/ChatGPT-CodexAgent-Bridge/bin/agent-bridge-mcp.js`

Use the current tunnel-client syntax discovered from its own help/current official documentation.

If creating/authorizing the tunnel requires the user to perform an OpenAI/ChatGPT web UI action, STOP at that exact point and return the shortest possible user instruction: what screen/action is needed and what non-secret identifier (if any) must be provided back to the local agent. Do not try to bypass interactive authorization.

## Task C — Local diagnostics only

Before asking ChatGPT to connect, run the tunnel client's supported diagnostics/doctor checks and confirm:

- tunnel client can launch the local stdio MCP server
- MCP initialization succeeds
- `bridge_ping` is discoverable through the tunnel-facing MCP connection if the diagnostic tooling supports tool discovery
- no target repository is modified

Do not run a target-repository Codex task merely to validate the tunnel.

## Stop conditions

Stop and report instead of improvising if:

- ChatGPT/OpenAI account UI must create or authorize the tunnel
- the user's current ChatGPT plan/account does not expose the required MCP/tunnel connection UI
- tunnel-client reports an auth/reconnect loop
- the current official tunnel flow differs materially from the expected stdio-local setup
- any step would require exposing a credential or secret in Git

When stopped for an interactive action, return only the minimum action the user must perform. ChatGPT will decide the next step.

## After successful local tunnel setup

Do not start Azure 47122 yet.

Update:

- `docs/IMPLEMENTATION_PLAN.md` with tunnel setup/diagnostic status
- `docs/HANDOFF.md` with reproducible MacBook-B setup steps, excluding secrets and machine-specific credentials
- `docs/DECISIONS.md` only if a material architecture decision changed

Commit and push Agent Bridge documentation/config-template changes only if they are safe and portable. Keep generated local tunnel config/auth ignored/uncommitted.

Then stop and return:

- tunnel-client version
- tunnel/profile setup status
- local diagnostic result
- whether user UI action is required
- exact next user action, if required
- Agent Bridge commit SHA if anything was pushed
- blocker, if any

## Safety

IoTMart3.0 and Magnolia remain read-only and must be byte-for-byte untouched by this connectivity task.
