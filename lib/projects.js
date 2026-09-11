"use strict";
const fs = require("fs");
const path = require("path");

function configPath() {
  return process.env.AGENT_BRIDGE_PROJECTS_FILE
    || path.join(__dirname, "..", "config", "projects.json");
}

function loadProjects() {
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(configPath(), "utf8")); }
  catch { throw new Error(`project config not found or invalid: ${configPath()}`); }
  const projects = parsed.projects;
  if (!projects || Array.isArray(projects) || typeof projects !== "object")
    throw new Error("project config requires a projects object");
  return Object.fromEntries(Object.entries(projects).map(([id, cwd]) => {
    if (!/^[a-z][a-z0-9_-]*$/.test(id) || typeof cwd !== "string")
      throw new Error("project config contains an invalid mapping");
    const resolved = path.resolve(cwd);
    if (!fs.statSync(resolved, { throwIfNoEntry: false })?.isDirectory())
      throw new Error(`configured project is unavailable: ${id}`);
    return [id, resolved];
  }));
}

function resolveProject(id) {
  if (typeof id !== "string" || !/^[a-z][a-z0-9_-]*$/.test(id))
    throw new Error("invalid project id");
  const cwd = loadProjects()[id];
  if (!cwd) throw new Error(`unknown project: ${id}`);
  return cwd;
}

module.exports = { loadProjects, resolveProject };
