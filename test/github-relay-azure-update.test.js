"use strict";
const assert = require("assert");
const relay = require("../lib/github-relay");

function task(extra = {}) { return { id: "azure-update-fixture", type: "azure_work_item_update", work_item_id: 42,
  title: "English title", description: "<p>English description</p>", acceptance_criteria: "<ol><li>Verified</li></ol>", created_at: new Date().toISOString(), ...extra }; }
function item(values = {}) { return JSON.stringify({ id: 42, fields: { "System.TeamProject": "IoTMart 3.0", "System.Title": "Old",
  "System.Description": "<p>Old</p>", "Microsoft.VSTS.Common.AcceptanceCriteria": "<ol><li>Old</li></ol>", ...values } }); }

assert.throws(() => relay.validate("azure-update-fixture.json", task({ work_item_id: 0 })));
assert.throws(() => relay.validate("azure-update-fixture.json", task({ unexpected: "field" })));
assert.throws(() => relay.validate("azure-update-fixture.json", task({ title: undefined, description: undefined, acceptance_criteria: undefined })));
assert.throws(() => relay.validate("azure-update-fixture.json", task({ description: "x".repeat(12001) })));

let reads = 0;
const calls = [];
const requested = task();
const updated = relay.azureWorkItemUpdate(requested, (bin, args) => {
  calls.push([bin, args]);
  if (args[2] === "show") return reads++ ? item({ "System.Title": requested.title, "System.Description": requested.description,
    "Microsoft.VSTS.Common.AcceptanceCriteria": requested.acceptance_criteria }) : item();
  return item();
}, "https://dev.azure.com/fixture");
assert(updated.verified && !updated.no_op);
assert(calls.some(([, args]) => args[2] === "update" && args.includes("--title") && args.includes("--description") && args.includes("--fields")));

reads = 0;
const unchanged = task({ title: "Old", description: "<p>Old</p>", acceptance_criteria: "<ol><li>Old</li></ol>" });
const noOp = relay.azureWorkItemUpdate(unchanged, (bin, args) => {
  assert.equal(args[2], "show");
  reads++;
  return item();
}, "https://dev.azure.com/fixture");
assert(noOp.verified && noOp.no_op && reads === 2);

reads = 0;
const mismatch = relay.azureWorkItemUpdate(requested, (bin, args) => args[2] === "show" ? (++reads === 1 ? item() : item()) : item(), "https://dev.azure.com/fixture");
assert(!mismatch.verified);
console.log("github relay Azure update fixture: PASS");
