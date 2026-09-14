"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const fslog = require("./fslog");
const { resolveProject } = require("./projects");
const { loadMachine, matchesMachine } = require("./machine");

const TASK_ID = /^[a-z][a-z0-9-]{2,63}$/;
const TYPES = new Set(["bridge_ping", "project_git_status", "azure_work_item_read",
  "project_text_search", "project_file_read", "project_comment_replace", "project_git_diff"]);
const MAX_PAYLOAD = 16 * 1024;
const MAX_FILE = 1024 * 1024;
const SKIP_DIRS = new Set([".git", "node_modules", "vendor", "build", "dist", "coverage", ".sfdx"]);

function iso() { return new Date().toISOString(); }
function clip(value, length = 12000) { return String(value || "").slice(0, length); }
function command(bin, args, cwd) {
  const run = spawnSync(bin, args, { cwd, encoding: "utf8" });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(clip(run.stderr || run.stdout || `${bin} exited ${run.status}`, 2000));
  return (run.stdout || "").trim();
}
function remoteRepo(cwd) {
  const url = command("git", ["remote", "get-url", "origin"], cwd);
  const match = url.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/);
  if (!match) throw new Error("origin must point to a GitHub repository");
  return match[1];
}
function branch(cwd) { return process.env.AGENT_BRIDGE_RELAY_BRANCH || command("git", ["branch", "--show-current"], cwd); }
function context(cwd = process.cwd()) { return { cwd, repo: remoteRepo(cwd), branch: branch(cwd) }; }
function fetch(ctx) { command("git", ["fetch", "origin", ctx.branch], ctx.cwd); }
function gh(ctx, args) {
  const run = spawnSync("gh", args, { cwd: ctx.cwd, encoding: "utf8" });
  return { ok: run.status === 0, out: run.stdout || "", error: clip(run.stderr || run.stdout || "gh failed", 2000) };
}
function remoteJson(ctx, file) {
  const result = gh(ctx, ["api", `repos/${ctx.repo}/contents/${file}?ref=${encodeURIComponent(ctx.branch)}`]);
  if (!result.ok) {
    if (/404|not found/i.test(result.error)) return null;
    throw new Error(result.error);
  }
  const data = JSON.parse(result.out);
  return { sha: data.sha, value: JSON.parse(Buffer.from(data.content, "base64").toString("utf8")) };
}
function putJson(ctx, file, value, message, sha) {
  const args = ["api", "--method", "PUT", `repos/${ctx.repo}/contents/${file}`,
    "-f", `message=${message}`, "-f", `content=${Buffer.from(JSON.stringify(value, null, 2) + "\n").toString("base64")}`,
    "-f", `branch=${ctx.branch}`];
  if (sha) args.push("-f", `sha=${sha}`);
  return gh(ctx, args);
}
function inboxTasks(ctx) {
  fetch(ctx);
  return command("git", ["ls-tree", "-r", "--name-only", `origin/${ctx.branch}`, "--", "relay/inbox"], ctx.cwd)
    .split("\n").filter((file) => /^relay\/inbox\/[a-z][a-z0-9-]{2,63}\.json$/.test(file));
}
function text(value, name, max) {
  if (typeof value !== "string" || !value || value.length > max || /[\0\r\n]/.test(value)) throw new Error(`invalid ${name}`);
  return value;
}
function projectId(value) {
  if (!["iotmart", "magnolia"].includes(value)) throw new Error("invalid project");
  return value;
}
function validate(file, task) {
  const id = path.basename(file, ".json");
  if (!task || Array.isArray(task) || typeof task !== "object" || JSON.stringify(task).length > MAX_PAYLOAD)
    throw new Error("relay task must be a bounded JSON object");
  if (task.id !== id || !TASK_ID.test(id) || !TYPES.has(task.type)) throw new Error("invalid relay task id or type");
  if (typeof task.created_at !== "string" || task.created_at.length > 64) throw new Error("relay task requires created_at");
  const allowed = {
    bridge_ping: ["id", "type", "created_at"],
    project_git_status: ["id", "type", "project", "created_at"],
    azure_work_item_read: ["id", "type", "work_item_id", "created_at"],
    project_text_search: ["id", "type", "project", "query", "max_results", "created_at"],
    project_file_read: ["id", "type", "project", "relative_path", "start_line", "end_line", "created_at"],
    project_comment_replace: ["id", "type", "project", "relative_path", "old_text", "new_text", "expected_count", "created_at"],
    project_git_diff: ["id", "type", "project", "relative_path", "created_at"]
  }[task.type];
  allowed.push("machine_id");
  if (Object.keys(task).some((key) => !allowed.includes(key))) throw new Error("relay task contains unsupported fields");
  if (task.machine_id != null && !/^[a-z][a-z0-9-]{2,63}$/.test(task.machine_id)) throw new Error("invalid machine_id");
  if (task.type === "project_git_status") projectId(task.project);
  if (task.type === "azure_work_item_read" && (!Number.isSafeInteger(task.work_item_id) || task.work_item_id < 1))
    throw new Error("work_item_id must be a positive integer");
  if (task.type === "project_text_search") {
    projectId(task.project); text(task.query, "query", 240);
    if (task.max_results != null && (!Number.isSafeInteger(task.max_results) || task.max_results < 1 || task.max_results > 100))
      throw new Error("invalid max_results");
  }
  if (task.type === "project_file_read") {
    projectId(task.project); text(task.relative_path, "relative_path", 512);
    if (!Number.isSafeInteger(task.start_line) || !Number.isSafeInteger(task.end_line) || task.start_line < 1 || task.end_line < task.start_line || task.end_line - task.start_line > 200)
      throw new Error("invalid line range");
  }
  if (task.type === "project_comment_replace") {
    if (task.project !== "iotmart") throw new Error("comment replacement is limited to iotmart");
    text(task.relative_path, "relative_path", 512); text(task.old_text, "old_text", 2000); text(task.new_text, "new_text", 2000);
    if (task.expected_count !== 1) throw new Error("expected_count must be exactly 1");
  }
  if (task.type === "project_git_diff") {
    projectId(task.project);
    if (task.relative_path != null) text(task.relative_path, "relative_path", 512);
  }
  return task;
}
function azureOrganization() {
  if (process.env.AGENT_BRIDGE_AZURE_DEVOPS_ORG) return process.env.AGENT_BRIDGE_AZURE_DEVOPS_ORG;
  const config = command("az", ["devops", "configure", "--list"]);
  const match = config.match(/^organization\s*=\s*(\S+)$/m);
  if (!match) throw new Error("Azure DevOps organization is not configured");
  return match[1];
}
function rootFor(project) { return fs.realpathSync(resolveProject(project)); }
function fileFor(project, relativePath) {
  if (path.isAbsolute(relativePath)) throw new Error("absolute paths are not allowed");
  const root = rootFor(project);
  const file = path.resolve(root, relativePath);
  if (!file.startsWith(root + path.sep)) throw new Error("path escapes project root");
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("path must be a regular file");
  const real = fs.realpathSync(file);
  if (!real.startsWith(root + path.sep)) throw new Error("symlink escapes project root");
  return { root, file: real, relative_path: path.relative(root, real).split(path.sep).join("/") };
}
function utf8(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length > MAX_FILE) throw new Error("file exceeds relay size limit");
  const value = bytes.toString("utf8");
  if (!Buffer.from(value, "utf8").equals(bytes) || value.includes("\0")) throw new Error("file is not safe UTF-8 text");
  return { bytes, value };
}
function hash(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function status(root) { return command("git", ["-C", root, "status", "--porcelain=v1", "--branch"]); }
function commentPrefix(value) {
  const match = /^\s*(\/\/|\/\*|\*|#|<!--)/.exec(value);
  if (!match || (match[1] === "<!--" && !value.includes("-->")) || (match[1] === "/*" && !value.includes("*/")))
    throw new Error("replacement must be a recognizable complete comment");
  return match[1];
}
function occurrences(value, needle) {
  let count = 0;
  for (let at = value.indexOf(needle); at >= 0; at = value.indexOf(needle, at + needle.length)) count++;
  return count;
}
function projectTextSearch(task) {
  const root = rootFor(task.project);
  const limit = task.max_results || 20;
  const results = [];
  function visit(dir) {
    if (results.length >= limit) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (results.length >= limit || entry.isSymbolicLink() || SKIP_DIRS.has(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!entry.isFile()) continue;
      let content;
      try { content = utf8(file).value; } catch { continue; }
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length && results.length < limit; index++) {
        if (lines[index].includes(task.query)) results.push({
          relative_path: path.relative(root, file).split(path.sep).join("/"), line: index + 1, excerpt: clip(lines[index], 320)
        });
      }
    }
  }
  visit(root);
  return { project: task.project, query: task.query, results };
}
function projectFileRead(task) {
  const target = fileFor(task.project, task.relative_path);
  const lines = utf8(target.file).value.split(/\r?\n/);
  return { project: task.project, relative_path: target.relative_path, start_line: task.start_line, end_line: task.end_line,
    lines: lines.slice(task.start_line - 1, task.end_line).map((text, index) => ({ line: task.start_line + index, text: clip(text, 800) })) };
}
function projectCommentReplace(task) {
  const target = fileFor(task.project, task.relative_path);
  if (command("git", ["-C", target.root, "status", "--porcelain=v1", "--", target.relative_path]))
    throw new Error("target file is not clean");
  if (commentPrefix(task.old_text) !== commentPrefix(task.new_text)) throw new Error("comment prefix changed");
  const before = utf8(target.file);
  if (occurrences(before.value, task.old_text) !== 1) throw new Error("old_text must occur exactly once");
  const at = before.value.indexOf(task.old_text);
  const lineStart = before.value.lastIndexOf("\n", at - 1) + 1;
  const lineEnd = before.value.indexOf("\n", at);
  const line = before.value.slice(lineStart, lineEnd < 0 ? before.value.length : lineEnd).replace(/\r$/, "");
  if (line !== task.old_text) throw new Error("replacement must cover one complete comment-only line");
  const after = Buffer.from(before.value.replace(task.old_text, task.new_text), "utf8");
  let wrote = false;
  try {
    fs.writeFileSync(target.file, after); wrote = true;
    const diff = command("git", ["-C", target.root, "diff", "--", target.relative_path]);
    const changed = command("git", ["-C", target.root, "diff", "--name-only", "--", target.relative_path]);
    if (!diff || changed !== target.relative_path) throw new Error("post-write diff did not contain exactly the target file");
    return { project: task.project, relative_path: target.relative_path, replacement_count: 1,
      before_hash: hash(before.bytes), after_hash: hash(after), diff: clip(diff), porcelain: status(target.root) };
  } catch (error) {
    if (wrote) fs.writeFileSync(target.file, before.bytes);
    throw error;
  }
}
function projectGitDiff(task) {
  const target = task.relative_path == null ? null : fileFor(task.project, task.relative_path);
  const root = target ? target.root : rootFor(task.project);
  const args = ["-C", root, "diff"];
  if (target) args.push("--", target.relative_path);
  return { project: task.project, ...(target ? { relative_path: target.relative_path } : {}), diff: clip(command("git", args)), porcelain: status(root) };
}
function runTask(ctx, task) {
  const prompt = `GitHub relay deterministic task: ${task.type} (${task.id})`;
  const ledger = fslog.newTask({ agent: "relay", transport: "github", sandbox: task.type === "project_comment_replace" ? "workspace-write" : "read-only", cwd: ctx.cwd, prompt });
  fslog.patchStatus(ledger.dir, { status: "working", progress: 10, summary: "relay handler running" });
  try {
    let result;
    if (task.type === "bridge_ping") {
      result = { ok: true, worker_health: "ready", mode: "github-relay", version: require("../package.json").version,
        commit: command("git", ["rev-parse", `origin/${ctx.branch}`], ctx.cwd), ...(loadMachine() ? { machine_id: loadMachine().id } : {}) };
    } else if (task.type === "project_git_status") {
      const cwd = resolveProject(task.project);
      result = { project: task.project, branch: command("git", ["-C", cwd, "branch", "--show-current"]),
        porcelain: command("git", ["-C", cwd, "status", "--porcelain=v1", "--branch"]) };
    } else if (task.type === "project_text_search") {
      result = projectTextSearch(task);
    } else if (task.type === "project_file_read") {
      result = projectFileRead(task);
    } else if (task.type === "project_comment_replace") {
      result = projectCommentReplace(task);
    } else if (task.type === "project_git_diff") {
      result = projectGitDiff(task);
    } else {
      const organization = azureOrganization();
      const item = JSON.parse(command("az", ["boards", "work-item", "show", "--id", String(task.work_item_id), "--organization", organization, "--output", "json"]));
      const fields = item.fields || {};
      const project = fields["System.TeamProject"] || "";
      result = { id: item.id, title: fields["System.Title"] || "", state: fields["System.State"] || "",
        work_item_type: fields["System.WorkItemType"] || "", project,
        description: clip(fields["System.Description"]), acceptance_criteria: clip(fields["Microsoft.VSTS.Common.AcceptanceCriteria"]),
        api_url: item.url || "", web_url: project ? `${organization}/${encodeURIComponent(project)}/_workitems/edit/${item.id}` : "" };
    }
    fslog.writeResult(ledger.dir, JSON.stringify(result, null, 2));
    fslog.patchStatus(ledger.dir, { status: "done", progress: 100, summary: "relay handler completed" });
    return { status: "done", result, ledger_task_id: ledger.id };
  } catch (error) {
    const message = clip(error.message, 2000);
    fslog.writeResult(ledger.dir, message);
    fslog.patchStatus(ledger.dir, { status: "error", progress: 100, summary: message });
    return { status: "error", error: message, ledger_task_id: ledger.id };
  }
}
function processFile(ctx, file) {
  const id = path.basename(file, ".json");
  const outboxFile = `relay/outbox/${id}.json`;
  const processedFile = `relay/processed/${id}.json`;
  if (remoteJson(ctx, outboxFile) || remoteJson(ctx, processedFile)) return { id, status: "skipped" };
  const raw = command("git", ["show", `origin/${ctx.branch}:${file}`], ctx.cwd);
  let task;
  try { task = validate(file, JSON.parse(raw)); }
  catch (error) { return { id, status: "rejected", error: clip(error.message, 1000) }; }
  if (!matchesMachine(task)) return { id, status: "skipped", reason: "task addressed to another machine" };
  const claim = { id, status: "claimed", claimed_at: iso(), task_type: task.type };
  const claimed = putJson(ctx, processedFile, claim, `relay: claim ${id}`);
  if (!claimed.ok) return { id, status: "skipped", error: claimed.error };
  const outcome = runTask(ctx, task);
  const outbox = { id, type: task.type, status: outcome.status, created_at: task.created_at, completed_at: iso(),
    ledger_task_id: outcome.ledger_task_id, ...(outcome.result ? { result: outcome.result } : {}), ...(outcome.error ? { error: outcome.error } : {}) };
  const written = putJson(ctx, outboxFile, outbox, `relay: result ${id}`);
  if (!written.ok) return { id, status: "error", error: written.error };
  const current = remoteJson(ctx, processedFile);
  if (current) putJson(ctx, processedFile, { ...claim, status: outcome.status, completed_at: iso(), ledger_task_id: outcome.ledger_task_id },
    `relay: complete ${id}`, current.sha);
  return { id, status: outcome.status, ledger_task_id: outcome.ledger_task_id };
}
function runOnce(options = {}) {
  const ctx = context(options.cwd);
  const results = [];
  for (const file of inboxTasks(ctx)) results.push(processFile(ctx, file));
  return { branch: ctx.branch, results };
}
async function watch(options = {}) {
  const interval = Math.max(10, Number(options.interval || 30));
  for (;;) {
    try { console.log(JSON.stringify(runOnce(options))); }
    catch (error) { console.error(`relay worker error: ${error.message}`); }
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
  }
}

module.exports = { context, putJson, remoteJson, runOnce, watch, runTask, validate, matchesMachine };
