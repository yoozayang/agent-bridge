# Architecture Decisions

## ADR-001 — Use `teamnebula-ai/agent-bridge` as the base

Status: Accepted

Reason:

The upstream project already provides a durable filesystem task ledger, Codex MCP transport, named session continuity, sandbox modes, telemetry, and warm-session support. Reusing these is preferable to rebuilding task/session infrastructure from scratch.

## ADR-002 — Preserve Agent Bridge as the control plane

Status: Accepted

ChatGPT should not call local Codex directly as the canonical path.

Canonical target path:

```text
ChatGPT -> ChatGPT-facing MCP -> Agent Bridge -> Codex MCP -> target repo
```

This preserves task/status/result/session history and makes cross-machine handoff inspectable.

## ADR-003 — Add a ChatGPT-facing MCP layer instead of replacing existing Codex transport

Status: Accepted in principle; implementation pending

Upstream is designed around Claude Code as the host/orchestrator. The fork should add a small MCP server in front of existing Agent Bridge lifecycle functions. Existing Codex MCP remains an internal execution transport.

The implementation should prefer direct reuse of dispatcher/fslog/session modules over spawning opaque shell commands where practical.

## ADR-004 — Read-only first

Status: Accepted

The initial ChatGPT tool surface must be read-only with respect to IoTMart3.0 and Magnolia. Write-capable delegation is deferred until the end-to-end read-only path is proven and reviewed.

## ADR-005 — No arbitrary shell MCP tool in v1

Status: Accepted

ChatGPT should receive explicit bridge operations, not unrestricted local shell access. This keeps the trust boundary understandable and makes task history meaningful.

## ADR-006 — Git is the cross-machine project source of truth

Status: Accepted

Shared architecture, plan, decisions, configuration examples, and takeover instructions live in this fork. Machine secrets and machine-specific runtime state do not.

`docs/IMPLEMENTATION_PLAN.md` is the current-status source of truth and must be updated as work progresses.

## ADR-007 — `agy` is optional for this project

Status: Accepted

Upstream supports Antigravity, but the current project is specifically ChatGPT ↔ Codex. Missing `agy` must not block the PoC.

## ADR-008 — Use the upstream `codex exec --json` fallback for the read-only PoC

Status: Accepted

The current official Codex CLI does not expose `codex mcp-server`. The PoC will use Agent Bridge's existing `codex exec --json` process transport, which preserves the task ledger and telemetry without downgrading Codex. Do not use `mcp-server` or `app-server` in this PoC.

## ADR-009 — Phase 2 MCP is a local stdio adapter

Status: Accepted

The first ChatGPT-facing surface is a local stdio MCP server using the standard MCP SDK. It exposes only the five explicit read-only bridge tools and resolves target paths through ignored machine-local configuration. Secure MCP Tunnel and remote HTTP transport remain out of scope.
