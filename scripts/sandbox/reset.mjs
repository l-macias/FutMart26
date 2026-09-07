import { spawnSync } from "node:child_process";

import postgres from "postgres";

import { requireResetConfirmation, sandboxDatabaseUrl } from "./config.mjs";

requireResetConfirmation();
const { databaseName, url } = sandboxDatabaseUrl();
const maintenanceUrl = new URL(url);
maintenanceUrl.pathname = "/postgres";

const maintenance = postgres(maintenanceUrl.toString(), { max: 1 });
try {
  const existing = await maintenance`
    select 1 from pg_database where datname = ${databaseName}
  `;
  if (existing.length === 0)
    await maintenance.unsafe(`create database "${databaseName}"`);
} finally {
  await maintenance.end();
}

const sandbox = postgres(url.toString(), { max: 1 });
try {
  await sandbox.begin(async (tx) => {
    await tx.unsafe("drop schema if exists drizzle cascade");
    await tx.unsafe("drop schema if exists public cascade");
    await tx.unsafe("create schema public authorization current_user");
    await tx.unsafe("grant all on schema public to public");
  });
} finally {
  await sandbox.end();
}

const pnpmEntry = process.env.npm_execpath;
if (!pnpmEntry) throw new Error("pnpm executable path is unavailable");
const migration = spawnSync(
  process.execPath,
  [pnpmEntry, "--filter", "@football/database", "db:migrate"],
  {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "inherit",
  },
);
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);

console.info(`Sandbox reset complete: ${databaseName}`);
