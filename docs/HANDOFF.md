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
2. `docs/HANDOFF.md`
3. `docs/IMPLEMENTATION_PLAN.md`
4. `docs/DECISIONS.md`
5. `docs/NEXT_LOCAL_TASK.md`

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
- Phase 2 local stdio MCP validation passed; its five read-only tools reuse the normal Agent Bridge dispatcher and ledger
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
codex login status
```

Do not create API keys merely to satisfy setup. If Codex requires login, prefer the user's existing supported ChatGPT/Codex account login path unless the implementation plan explicitly changes.

If the installed `codex` launcher exists but cannot start its native executable, repair the standard CLI package and rerun the two Codex checks:

```bash
npm install --global @openai/codex@latest
```

## Project paths

Logical projects must eventually be mapped locally rather than hard-coded in source.

MacBook A currently reports:

```text
iotmart  -> /Users/yoozayang/Development/IoTMart3.0
magnolia -> select one of the read-only discovered roots: `base`, `light-modules`, or the `light-modules` worktree under `/Users/yoozayang/Magnolia`
```

MacBook B should provide its own equivalents in the ignored `config/projects.json`; do not put machine paths in source or commit this file.

## Local MCP PoC

Install dependencies, then create the ignored machine-local mapping from the committed example:

```bash
npm ci
cp config/projects.json.example config/projects.json
# edit the two paths for this Mac
node bin/agent-bridge-mcp.js
```

The MCP server communicates only over stdio. `AGENT_BRIDGE_PROJECTS_FILE` may override the default `config/projects.json` path. Validate it with:

```bash
AGENT_BRIDGE_HOME="$(mktemp -d)/ledger" node test/mcp-smoke.js
```

The smoke test requires a valid local project mapping and a logged-in Codex CLI. It runs a read-only IoTMart status inspection and must leave that target unchanged.

## Secure MCP Tunnel

Install the official client, then create an organization tunnel and a separate Runtime API key with Tunnel Read + Use. Keep the key in a local `600`-permission file; never put it in Git or chat.

```bash
brew install openai/tools/tunnel-client
tunnel-client init --sample sample_mcp_stdio_local --profile agent-bridge \
  --tunnel-id tunnel_<your-id> \
  --mcp-command "node $PWD/bin/agent-bridge-mcp.js" \
  --control-plane-api-key-ref file:$HOME/.config/tunnel-client/control-plane-api-key
tunnel-client doctor --profile agent-bridge --explain
tunnel-client runtimes connect --alias agent-bridge --profile agent-bridge \
  --tunnel-id tunnel_<your-id> \
  --mcp-command "node $PWD/bin/agent-bridge-mcp.js" \
  --runtime-api-key file:$HOME/.config/tunnel-client/control-plane-api-key
```

Confirm `tunnel-client runtimes status agent-bridge --json` reports `process_running`, `healthy`, and `ready` as true. Only then create or verify the ChatGPT connector in Settings → Connectors, while the runtime remains running.

If ChatGPT Settings shows only preconfigured apps and no custom-connector add action, do not enable an unrelated app. Record that observed UI blocker for ChatGPT or the workspace administrator to verify. Stop the managed runtime until connector access is confirmed.

## GitHub relay (current transport)

The current ChatGPT-to-Mac transport is GitHub relay, not the optional MCP tunnel. Set a stable, opaque, non-secret identity in the ignored config before installing the watcher:

```bash
cp config/machine.json.example config/machine.json
# replace the example value with a unique opaque ID, e.g. mac-<random-hex>
```

ChatGPT may include an optional `machine_id` in a relay task. Only the watcher whose local `config/machine.json` matches it claims the task; untargeted tasks retain the existing first-claimer behavior. `bridge_ping` returns the active `machine_id`.

Install the required per-user macOS LaunchAgent. It uses the existing watcher and fixed 30-second interval, starts at login, and restarts after an unexpected exit:

```bash
node bin/agent-bridge-relay-service.js install
node bin/agent-bridge-relay-service.js status
```

The installer derives its own repository path and Node executable, writes `~/Library/LaunchAgents/com.agentbridge.github-relay.plist`, and logs to `.agent-bridge/relay-watcher.log`. It does not store credentials in the plist.

Diagnose or remove it with:

```bash
node bin/agent-bridge-relay-service.js status
launchctl print gui/$(id -u)/com.agentbridge.github-relay
tail -n 100 .agent-bridge/relay-watcher.log
node bin/agent-bridge-relay-service.js uninstall
```

ChatGPT writes bounded files under `relay/inbox/`; the worker creates `relay/processed/` claim records and `relay/outbox/` results through authenticated GitHub commits. Run the real smoke check with an isolated local ledger:

```bash
AGENT_BRIDGE_HOME="$(mktemp -d)/ledger" node test/github-relay-smoke.js
```

The default smoke uses only `bridge_ping` and read-only project status. It never reads Azure DevOps. Azure smoke coverage requires an explicitly approved work item:

```bash
AGENT_BRIDGE_SMOKE_AZURE_WORK_ITEM=<approved-id> \
  AGENT_BRIDGE_HOME="$(mktemp -d)/ledger" node test/github-relay-smoke.js
```

The allowlist is `bridge_ping`, read-only `project_git_status`/`azure_work_item_read`, the constrained `azure_work_item_update`, plus bounded `project_text_search`, `project_file_read`, `project_git_diff`, and the IoTMart-only `project_comment_replace`. Azure update accepts only title, description, and acceptance criteria for an existing work item in the configured `IoTMart 3.0` project; it records the before values, reads back after the update, and requires exact verification. It cannot alter state, ownership, tags, links, attachments, or source repositories. Comment replacement requires a clean regular file below the configured project root, an exact once-only same-line comment replacement, and post-write diff verification; it never commits the target repository. Validate the write gates without touching a target repo:

```bash
node test/github-relay-write.test.js
node test/github-relay-azure-update.test.js
```

No payload may contain absolute paths, shell commands, or secrets. Salesforce deployment is separately gated and is not part of the relay comment-edit primitive.

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
