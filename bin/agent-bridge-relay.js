#!/usr/bin/env node
"use strict";
const { runOnce, watch } = require("../lib/github-relay");

const args = process.argv.slice(2);
const once = args.includes("--once");
const index = args.indexOf("--interval");
const interval = index >= 0 ? Number(args[index + 1]) : 30;
if (!Number.isFinite(interval) || interval < 10) throw new Error("--interval must be at least 10 seconds");
if (once) console.log(JSON.stringify(runOnce()));
else watch({ interval });
