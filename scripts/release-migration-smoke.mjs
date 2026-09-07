import { spawn } from "node:child_process";

import postgres from "postgres";

const targetValue = process.env.RELEASE_SMOKE_DATABASE_URL;
if (!targetValue) throw new Error("RELEASE_SMOKE_DATABASE_URL is required");
const target = new URL(targetValue);
const databaseName = target.pathname.slice(1);
if (!/^[a-z0-9_]+$/.test(databaseName))
  throw new Error(
    "Release migration smoke database name may contain only lowercase letters, numbers and underscores",
  );
if (!databaseName.endsWith("_release_smoke"))
  throw new Error(
    "Release migration smoke database name must end with _release_smoke",
  );
if (
  process.env.DATABASE_URL &&
  normalize(process.env.DATABASE_URL) === normalize(targetValue)
)
  throw new Error("Release migration smoke target must not equal DATABASE_URL");

const adminUrl = new URL(target);
adminUrl.pathname = "/postgres";
const admin = postgres(adminUrl.toString(), { max: 1, prepare: false });
let created = false;
try {
  const [existing] =
    await admin`select 1 as present from pg_database where datname = ${databaseName}`;
  if (existing)
    throw new Error(
      "Release migration smoke target already exists; choose a new unique _release_smoke name",
    );
  await admin.unsafe(`create database "${databaseName}"`);
  created = true;
  await migrate(targetValue);
  await migrate(targetValue);

  const database = postgres(targetValue, { max: 1, prepare: false });
  try {
    const [migration] =
      await database`select created_at::text from drizzle.__drizzle_migrations order by created_at desc limit 1`;
    const [tables] =
      await database`select count(*)::text as count from information_schema.tables where table_schema = 'public'`;
    process.stdout.write(
      `Migration smoke passed: ${tables?.count ?? "0"} public tables, latest timestamp ${migration?.created_at ?? "missing"}.\n`,
    );
  } finally {
    await database.end();
  }
} finally {
  if (created)
    await admin.unsafe(`drop database "${databaseName}" with (force)`);
  await admin.end();
}

function migrate(databaseUrl) {
  return new Promise((resolve, reject) => {
    const packageManager = process.env.npm_execpath;
    if (!packageManager)
      throw new Error("Run migration smoke through pnpm db:migrate:smoke");
    const child = spawn(process.execPath, [packageManager, "db:migrate"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Migration command exited with ${code}`)),
    );
  });
}

function normalize(value) {
  const url = new URL(value);
  url.password = "";
  return url.toString();
}
