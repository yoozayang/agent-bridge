"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const fslog = require("./fslog");
const { resolveProject } = require("./projects");

const TASK_ID = /^[a-z][a-z0-9-]{2,63}$/;
const TYPES = new Set(["bridge_ping", "project_git_status", "azure_work_item_read"]);
const MAX_PAYLOAD = 16 * 1024;

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
function validate(file, task) {
  const id = path.basename(file, ".json");
  if (!task || Array.isArray(task) || typeof task !== "object" || JSON.stringify(task).length > MAX_PAYLOAD)
    throw new Error("relay task must be a bounded JSON object");
  if (task.id !== id || !TASK_ID.test(id) || !TYPES.has(task.type)) throw new Error("invalid relay task id or type");
  if (typeof task.created_at !== "string" || task.created_at.length > 64) throw new Error("relay task requires created_at");
  const allowed = new Set(["id", "type", "project", "work_item_id", "created_at"]);
  if (Object.keys(task).some((key) => !allowed.has(key))) throw new Error("relay task contains unsupported fields");
  if (task.type === "project_git_status" && !["iotmart", "magnolia"].includes(task.project)) throw new Error("invalid project");
  if (task.type === "azure_work_item_read" && (!Number.isSafeInteger(task.work_item_id) || task.work_item_id < 1))
    throw new Error("work_item_id must be a positive integer");
  return task;
}
function azureOrganization() {
  if (process.env.AGENT_BRIDGE_AZURE_DEVOPS_ORG) return process.env.AGENT_BRIDGE_AZURE_DEVOPS_ORG;
  const config = command("az", ["devops", "configure", "--list"]);
  const match = config.match(/^organization\s*=\s*(\S+)$/m);
  if (!match) throw new Error("Azure DevOps organization is not configured");
  return match[1];
}
function runTask(ctx, task) {
  const prompt = `GitHub relay deterministic task: ${task.type} (${task.id})`;
  const ledger = fslog.newTask({ agent: "relay", transport: "github", sandbox: "read-only", cwd: ctx.cwd, prompt });
  fslog.patchStatus(ledger.dir, { status: "working", progress: 10, summary: "relay handler running" });
  try {
    let result;
    if (task.type === "bridge_ping") {
      result = { ok: true, worker_health: "ready", mode: "github-relay", version: require("../package.json").version,
        commit: command("git", ["rev-parse", `origin/${ctx.branch}`], ctx.cwd) };
    } else if (task.type === "project_git_status") {
      const cwd = resolveProject(task.project);
      result = { project: task.project, branch: command("git", ["-C", cwd, "branch", "--show-current"]),
        porcelain: command("git", ["-C", cwd, "status", "--porcelain=v1", "--branch"]) };
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

module.exports = { context, putJson, remoteJson, runOnce, watch };
