import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
const backupDirectory = process.env.BACKUP_DIR;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!backupDirectory) throw new Error("BACKUP_DIR is required");

const repository = path.resolve(process.cwd());
const destination = path.resolve(backupDirectory);
if (
  destination === repository ||
  destination.startsWith(`${repository}${path.sep}`)
)
  throw new Error("BACKUP_DIR must be outside the repository");

await mkdir(destination, { recursive: true });
const timestamp = new Date().toISOString().replaceAll(":", "-");
const output = path.join(destination, `football-${timestamp}.dump`);
await run(
  "pg_dump",
  ["--format=custom", "--no-owner", "--no-privileges", `--file=${output}`],
  { ...process.env, ...connectionEnvironment(databaseUrl) },
);
process.stdout.write(`Backup created: ${output}\n`);

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
    const child = spawn(command, args, {
      env,
      stdio: ["ignore", "inherit", "inherit"],
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}
