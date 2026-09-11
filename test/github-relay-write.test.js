"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-bridge-relay-write-"));
const project = path.join(temp, "fixture");
process.env.AGENT_BRIDGE_HOME = path.join(temp, "ledger");
process.env.AGENT_BRIDGE_PROJECTS_FILE = path.join(temp, "projects.json");
fs.mkdirSync(project);
fs.writeFileSync(process.env.AGENT_BRIDGE_PROJECTS_FILE, JSON.stringify({ projects: { iotmart: project, magnolia: project } }));
const relay = require("../lib/github-relay");

function run(args) {
  const result = spawnSync("git", args, { cwd: project, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function task(type, extra) { return { id: "fixture-task", type, created_at: new Date().toISOString(), ...extra }; }
function outcome(value) { return relay.runTask({ cwd: project, branch: "fixture" }, value); }

run(["init", "-q"]); run(["config", "user.email", "relay@example.invalid"]); run(["config", "user.name", "relay"]);
fs.writeFileSync(path.join(project, "comments.txt"), "// 简体说明\nconst safe = true;\n");
fs.writeFileSync(path.join(project, "repeat.txt"), "// 简体重复\n// 简体重复\n");
fs.writeFileSync(path.join(project, "dirty.txt"), "// 简体脏\n");
fs.writeFileSync(path.join(project, "literal.txt"), "const label = \"// 简体说明\";\n");
run(["add", "."]); run(["commit", "-qm", "fixture"]);

const search = outcome(task("project_text_search", { project: "iotmart", query: "简体", max_results: 10 }));
assert.equal(search.status, "done");
assert(search.result.results.some((result) => result.relative_path === "comments.txt" && result.line === 1));
const read = outcome(task("project_file_read", { project: "iotmart", relative_path: "comments.txt", start_line: 1, end_line: 2 }));
assert.equal(read.status, "done");
assert.equal(read.result.lines[0].text, "// 简体说明");
assert.equal(outcome(task("project_file_read", { project: "iotmart", relative_path: "../outside", start_line: 1, end_line: 1 })).status, "error");

const replace = outcome(task("project_comment_replace", { project: "iotmart", relative_path: "comments.txt", old_text: "// 简体说明", new_text: "// 繁體說明", expected_count: 1 }));
assert.equal(replace.status, "done");
assert.equal(fs.readFileSync(path.join(project, "comments.txt"), "utf8"), "// 繁體說明\nconst safe = true;\n");
assert(replace.result.diff.includes("-// 简体说明"));
assert(outcome(task("project_git_diff", { project: "iotmart", relative_path: "comments.txt" })).result.diff.includes("+// 繁體說明"));

const literalBefore = fs.readFileSync(path.join(project, "literal.txt"));
assert.equal(outcome(task("project_comment_replace", { project: "iotmart", relative_path: "literal.txt", old_text: "// 简体说明", new_text: "// 繁體說明", expected_count: 1 })).status, "error");
assert(fs.readFileSync(path.join(project, "literal.txt")).equals(literalBefore));

fs.writeFileSync(path.join(project, "dirty.txt"), "// 简体脏\n// existing local change\n");
const dirtyBefore = fs.readFileSync(path.join(project, "dirty.txt"));
assert.equal(outcome(task("project_comment_replace", { project: "iotmart", relative_path: "dirty.txt", old_text: "// 简体脏", new_text: "// 繁體髒", expected_count: 1 })).status, "error");
assert(fs.readFileSync(path.join(project, "dirty.txt")).equals(dirtyBefore));
const repeatBefore = fs.readFileSync(path.join(project, "repeat.txt"));
assert.equal(outcome(task("project_comment_replace", { project: "iotmart", relative_path: "repeat.txt", old_text: "// 简体重复", new_text: "// 繁體重複", expected_count: 1 })).status, "error");
assert(fs.readFileSync(path.join(project, "repeat.txt")).equals(repeatBefore));
assert.throws(() => relay.validate("fixture-task.json", task("project_comment_replace", { project: "iotmart", relative_path: "comments.txt", old_text: "// a", new_text: "// b", expected_count: 2 })));
console.log("github relay controlled-write fixture: PASS");
