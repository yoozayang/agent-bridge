#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const { dispatch } = require("../lib/dispatch");
const fslog = require("../lib/fslog");
const { loadProjects, resolveProject } = require("../lib/projects");

function reply(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value) }], ...(isError ? { isError } : {}) };
}

function taskFile(id, name) {
  if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))
    throw new Error("invalid task id");
  const dir = fslog.taskDir(id);
  if (!dir) throw new Error("unknown task");
  return path.join(dir, name);
}

async function main() {
  const server = new McpServer({ name: "agent-bridge", version: "0.1.0" }, {
    instructions: "Use bridge_run_readonly only for configured projects. It always uses Codex exec in read-only mode and creates an Agent Bridge task ledger."
  });

  server.registerTool("bridge_ping", { description: "Check whether Agent Bridge MCP is available." },
    async () => reply({ ok: true, transport: "exec", mode: "read-only" }));

  server.registerTool("bridge_projects", { description: "List configured logical project IDs without exposing paths." },
    async () => {
      try { return reply({ projects: Object.keys(loadProjects()).sort() }); }
      catch (error) { return reply({ error: error.message }, true); }
    });

  server.registerTool("bridge_run_readonly", {
    description: "Run a prompt against one configured project through Agent Bridge in read-only mode.",
    inputSchema: { project: z.string().regex(/^[a-z][a-z0-9_-]*$/), prompt: z.string().min(1).max(12000) },
    annotations: { readOnlyHint: true }
  }, async ({ project, prompt }) => {
    try {
      const originalLog = console.log;
      console.log = (...args) => console.error(...args);
      try {
        const run = await dispatch({ agent: "codex", transport: "exec", sandbox: "read-only", cwd: resolveProject(project), prompt });
        return reply({ task_id: run.id, status: run.code === 0 ? "done" : "error", exit_code: run.code });
      } finally { console.log = originalLog; }
    } catch (error) { return reply({ error: error.message }, true); }
  });

  for (const [name, file] of [["bridge_task_status", "status.md"], ["bridge_task_result", "result.md"]]) {
    server.registerTool(name, {
      description: `Read a completed Agent Bridge task's ${file}.`,
      inputSchema: { task_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/) },
      annotations: { readOnlyHint: true }
    }, async ({ task_id }) => {
      try { return reply({ task_id, text: fs.readFileSync(taskFile(task_id, file), "utf8") }); }
      catch (error) { return reply({ error: error.message }, true); }
    });
  }

  await server.connect(new StdioServerTransport());
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
