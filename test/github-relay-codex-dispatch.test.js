"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-bridge-codex-dispatch-"));
const project = path.join(temp, "fixture");
process.env.AGENT_BRIDGE_PROJECTS_FILE = path.join(temp, "projects.json");
process.env.AGENT_BRIDGE_MACHINE_FILE = path.join(temp, "machine.json");
fs.mkdirSync(project); fs.writeFileSync(process.env.AGENT_BRIDGE_PROJECTS_FILE, JSON.stringify({ projects: { iotmart: project, magnolia: project } }));
fs.writeFileSync(process.env.AGENT_BRIDGE_MACHINE_FILE, JSON.stringify({ id: "mac-fixture" }));
function git(args) { const run = spawnSync("git", args, { cwd: project, encoding: "utf8" }); assert.equal(run.status, 0, run.stderr); return run.stdout; }
git(["init", "-q"]); git(["config", "user.email", "relay@example.invalid"]); git(["config", "user.name", "relay"]);
fs.writeFileSync(path.join(project, "safe.txt"), "safe\n"); git(["add", "."]); git(["commit", "-qm", "fixture"]);
const relay = require("../lib/github-relay");
function task(extra = {}) { return { id: "codex-dispatch-fixture", type: "codex_dispatch", project: "iotmart", mode: "read_only",
  instruction: "Inspect only.", created_at: new Date().toISOString(), ...extra }; }
function response(text = "done") { return { status: 0, stdout: JSON.stringify({ type: "item.completed", item: { type: "agent_message", text } }) + "\n", stderr: "" }; }

assert.equal(relay.validate("codex-dispatch-fixture.json", task()).mode, "read_only");
assert.throws(() => relay.validate("codex-dispatch-fixture.json", task({ project: "elsewhere" })));
assert.throws(() => relay.validate("codex-dispatch-fixture.json", task({ mode: "danger-full-access" })));
assert.throws(() => relay.validate("codex-dispatch-fixture.json", task({ instruction: "x".repeat(4001) })));
assert.throws(() => relay.validate("codex-dispatch-fixture.json", task({ command: "rm -rf" })));

const readOnly = relay.codexDispatch(task(), { spawn: (bin, args) => { assert.equal(bin, "codex"); assert(args.includes("read-only")); return response(); } });
assert(readOnly.ok && readOnly.summary === "done" && !readOnly.preexisting_dirty_state_changed);
const mutation = relay.codexDispatch(task(), { spawn: () => { fs.writeFileSync(path.join(project, "changed.txt"), "changed\n"); return response(); } });
assert(!mutation.ok && mutation.error.includes("read-only"));
fs.unlinkSync(path.join(project, "changed.txt"));

const write = relay.codexDispatch(task({ mode: "workspace_write" }), { spawn: () => {
  fs.writeFileSync(path.join(project, "generated.txt"), "generated\n"); return response("wrote one file");
} });
assert(write.ok && write.diff === "");
fs.unlinkSync(path.join(project, "generated.txt"));

const timeout = relay.codexDispatch(task(), { spawn: () => ({ status: null, stdout: "", stderr: "", error: { code: "ETIMEDOUT" } }) });
assert(!timeout.ok && timeout.timed_out);
const bounded = relay.codexDispatch(task(), { spawn: () => response("x".repeat(13000)) });
assert.equal(bounded.summary.length, 12000);

fs.writeFileSync(path.join(project, "safe.txt"), "pre-existing\n");
const dirty = relay.codexDispatch(task({ mode: "workspace_write" }), { spawn: () => { fs.writeFileSync(path.join(project, "safe.txt"), "changed dirty\n"); return response(); } });
assert(!dirty.ok && dirty.preexisting_dirty_state_changed);
console.log("github relay Codex dispatch fixture: PASS");
