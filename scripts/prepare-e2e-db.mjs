import { spawnSync } from "node:child_process";
import postgres from "postgres";

import { e2eDatabaseUrl } from "./e2e-database-url.mjs";

const targetUrl = new URL(e2eDatabaseUrl());
const databaseName = decodeURIComponent(targetUrl.pathname.slice(1));
const maintenanceUrl = new URL(targetUrl);
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

const pnpmEntry = process.env.npm_execpath;
if (!pnpmEntry) throw new Error("pnpm executable path is unavailable");
const migration = spawnSync(
  process.execPath,
  [pnpmEntry, "--filter", "@football/database", "db:migrate"],
  {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: targetUrl.toString() },
    stdio: "inherit",
  },
);
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);

const database = postgres(targetUrl.toString(), { max: 1 });
try {
  const tables = await database`
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not in ('__drizzle_migrations', 'progression_config_versions')
    order by tablename
  `;
  if (tables.length > 0) {
    const identifiers = tables
      .map(({ tablename }) => `"${String(tablename).replaceAll('"', '""')}"`)
      .join(", ");
    await database.unsafe(
      `truncate table ${identifiers} restart identity cascade`,
    );
  }
  const [progressionConfig] = await database`
    select count(*)::int as count from progression_config_versions
  `;
  if (progressionConfig.count < 1)
    throw new Error(
      "E2E progression configuration is missing; recreate football_e2e with official migrations.",
    );
} finally {
  await database.end();
}

console.info(`E2E database ready: ${databaseName}`);
