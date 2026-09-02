import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const target = process.env.RESTORE_DATABASE_URL;
const current = process.env.DATABASE_URL;
const dumpFile = process.env.RESTORE_DUMP_FILE;
if (!target) throw new Error("RESTORE_DATABASE_URL is required");
if (!dumpFile) throw new Error("RESTORE_DUMP_FILE is required");
if (process.env.RESTORE_CONFIRM !== "RESTORE_NON_PRODUCTION")
  throw new Error("RESTORE_CONFIRM=RESTORE_NON_PRODUCTION is required");
if (current && normalize(current) === normalize(target))
  throw new Error("Restore target must not equal DATABASE_URL");

const source = path.resolve(dumpFile);
await access(source);
await run(
  "pg_restore",
  [
    "--exit-on-error",
    "--no-owner",
    "--no-privileges",
    `--dbname=${new URL(target).pathname.slice(1)}`,
    source,
  ],
  { ...process.env, ...connectionEnvironment(target) },
);
process.stdout.write(
  "Restore completed. Run migrations and readiness checks next.\n",
);

function normalize(value) {
  const url = new URL(value);
  url.password = "";
  return url.toString();
}

function connectionEnvironment(value) {
  const url = new URL(value);
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
    ...(url.searchParams.get("sslmode")
      ? { PGSSLMODE: url.searchParams.get("sslmode") }
      : {}),
  };
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}
