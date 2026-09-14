#!/usr/bin/env node
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadProjects } = require("../lib/projects");
const { loadMachine } = require("../lib/machine");

const label = "com.agentbridge.github-relay";
const root = path.resolve(__dirname, "..");
const plist = path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
const domain = `gui/${process.getuid()}`;
const service = `${domain}/${label}`;
const log = path.join(root, ".agent-bridge", "relay-watcher.log");
const launchPath = process.env.PATH || "/usr/bin:/bin:/usr/sbin:/sbin";

function command(args, allowFailure = false) {
  const result = spawnSync("launchctl", args, { encoding: "utf8" });
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || result.stdout || `launchctl exited ${result.status}`);
  return result;
}
function xml(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function content() {
  const args = [process.execPath, path.join(root, "bin", "agent-bridge-relay.js"), "--interval", "30"];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${label}</string>\n<key>ProgramArguments</key><array>${args.map((arg) => `<string>${xml(arg)}</string>`).join("")}</array>\n<key>WorkingDirectory</key><string>${xml(root)}</string>\n<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(launchPath)}</string></dict>\n<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>\n<key>ThrottleInterval</key><integer>10</integer>\n<key>StandardOutPath</key><string>${xml(log)}</string>\n<key>StandardErrorPath</key><string>${xml(log)}</string>\n</dict></plist>\n`;
}
function install() {
  loadProjects();
  if (!loadMachine()) throw new Error("machine config is required before installing the relay service");
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  fs.mkdirSync(path.dirname(log), { recursive: true });
  command(["bootout", service], true);
  fs.writeFileSync(plist, content());
  command(["bootstrap", domain, plist]);
  command(["kickstart", "-k", service]);
  console.log(JSON.stringify({ status: "installed", label, plist, log }));
}
function uninstall() {
  command(["bootout", service], true);
  if (fs.existsSync(plist)) fs.unlinkSync(plist);
  console.log(JSON.stringify({ status: "uninstalled", label, plist }));
}
function status() {
  const result = command(["print", service], true);
  console.log(result.status === 0 ? result.stdout : JSON.stringify({ status: "not-loaded", label, plist }));
  process.exitCode = result.status === 0 ? 0 : 1;
}

const action = process.argv[2];
if (action === "install") install();
else if (action === "uninstall") uninstall();
else if (action === "status") status();
else throw new Error("usage: agent-bridge-relay-service.js <install|uninstall|status>");
