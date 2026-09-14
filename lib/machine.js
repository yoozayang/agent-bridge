"use strict";
const fs = require("fs");
const path = require("path");

function configPath() {
  return process.env.AGENT_BRIDGE_MACHINE_FILE || path.join(__dirname, "..", "config", "machine.json");
}

function loadMachine() {
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(configPath(), "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`machine config not found or invalid: ${configPath()}`);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object" || !/^[a-z][a-z0-9-]{2,63}$/.test(parsed.id))
    throw new Error("machine config requires a safe id");
  return { id: parsed.id };
}

function matchesMachine(task) {
  return !task.machine_id || loadMachine()?.id === task.machine_id;
}

module.exports = { configPath, loadMachine, matchesMachine };
