"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

const root = path.resolve(__dirname, "..");
const home = process.env.AGENT_BRIDGE_HOME;
const config = process.env.AGENT_BRIDGE_PROJECTS_FILE || path.join(root, "config", "projects.json");
assert(home, "set AGENT_BRIDGE_HOME");

function text(result) { return JSON.parse(result.content[0].text); }

(async () => {
  const client = new Client({ name: "agent-bridge-smoke", version: "1.0.0" });
  const transport = new StdioClientTransport({ command: process.execPath, args: ["bin/agent-bridge-mcp.js"], cwd: root,
    env: { ...process.env, AGENT_BRIDGE_HOME: home, AGENT_BRIDGE_PROJECTS_FILE: config }, stderr: "pipe" });
  await client.connect(transport);
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(), [
    "bridge_ping", "bridge_projects", "bridge_run_readonly", "bridge_task_result", "bridge_task_status"
  ]);
  assert.equal(text(await client.callTool({ name: "bridge_ping", arguments: {} })).ok, true);
  assert.deepEqual(text(await client.callTool({ name: "bridge_projects", arguments: {} })).projects, ["iotmart", "magnolia"]);
  const run = text(await client.callTool({ name: "bridge_run_readonly", arguments: { project: "iotmart",
    prompt: "Read-only inspection only. Report the current Git branch and modified/untracked file names. Do not modify files." } }));
  assert.equal(run.status, "done");
  for (const file of ["task.md", "status.md", "result.md", "events.jsonl", "telemetry.jsonl", "telemetry.json"])
    assert(fs.existsSync(path.join(home, "tasks", run.task_id, file)), `missing ${file}`);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, "tasks", run.task_id, "telemetry.json"))).fileChanges, 0);
  assert(text(await client.callTool({ name: "bridge_task_status", arguments: { task_id: run.task_id } })).text.includes("status: done"));
  assert(text(await client.callTool({ name: "bridge_task_result", arguments: { task_id: run.task_id } })).text.length > 0);
  await client.close();
  console.log(run.task_id);
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
