import { spawnSync } from "node:child_process";

const turbo = spawnSync(
  process.execPath,
  ["./node_modules/turbo/bin/turbo", "test", ...process.argv.slice(2)],
  { cwd: process.cwd(), env: process.env, stdio: "inherit" },
);
if (turbo.error) throw turbo.error;
if (turbo.status !== 0) process.exit(turbo.status ?? 1);

const sandboxGuards = spawnSync(
  process.execPath,
  ["--test", "scripts/sandbox/guards.test.mjs"],
  { cwd: process.cwd(), env: process.env, stdio: "inherit" },
);
if (sandboxGuards.error) throw sandboxGuards.error;
if (sandboxGuards.status !== 0) process.exit(sandboxGuards.status ?? 1);
