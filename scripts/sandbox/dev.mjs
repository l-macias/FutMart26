import { spawn } from "node:child_process";

import { sandboxChildProcessEnvironment } from "./config.mjs";

const { databaseName, environment } = sandboxChildProcessEnvironment();
const pnpmEntry = process.env.npm_execpath;
if (!pnpmEntry) throw new Error("pnpm executable path is unavailable");

console.info("SANDBOX MODE");
console.info(`Database: ${databaseName}`);
const child = spawn(process.execPath, [pnpmEntry, "exec", "turbo", "dev"], {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
