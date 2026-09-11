"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const relay = require("../lib/github-relay");
const { resolveProject } = require("../lib/projects");

function git(cwd) { return spawnSync("git", ["-C", cwd, "status", "--porcelain=v1"], { encoding: "utf8" }).stdout; }
function task(id, type, extra = {}) { return { id, type, created_at: new Date().toISOString(), ...extra }; }
function put(ctx, value) {
  const result = relay.putJson(ctx, `relay/inbox/${value.id}.json`, value, `relay: inbox ${value.id}`);
  assert(result.ok, result.error);
}
function outbox(ctx, id) {
  const result = relay.remoteJson(ctx, `relay/outbox/${id}.json`);
  assert(result, `missing outbox for ${id}`);
  return result.value;
}

const ctx = relay.context(process.cwd());
const suffix = Date.now().toString(36);
const iotmart = resolveProject("iotmart");
const before = git(iotmart);
const ping = task(`smoke-ping-${suffix}`, "bridge_ping");
put(ctx, ping);
const first = relay.runOnce();
assert(first.results.some((result) => result.id === ping.id && result.status === "done"));
assert.equal(outbox(ctx, ping.id).result.ok, true);
const second = relay.runOnce();
assert(second.results.some((result) => result.id === ping.id && result.status === "skipped"));

const status = task(`smoke-status-${suffix}`, "project_git_status", { project: "iotmart" });
put(ctx, status);
assert(relay.runOnce().results.some((result) => result.id === status.id && result.status === "done"));
assert.equal(outbox(ctx, status.id).result.project, "iotmart");

const azure = task(`smoke-azure-${suffix}`, "azure_work_item_read", { work_item_id: 47122 });
put(ctx, azure);
assert(relay.runOnce().results.some((result) => result.id === azure.id && result.status === "done"));
assert.equal(outbox(ctx, azure.id).result.id, 47122);
assert.equal(git(iotmart), before);
console.log(JSON.stringify({ ping: ping.id, project_status: status.id, azure: azure.id, result: "PASS" }));
