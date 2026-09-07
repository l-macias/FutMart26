import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL;
const backupDirectory = process.env.BACKUP_DIR;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!backupDirectory) throw new Error("BACKUP_DIR is required");

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
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
const metadata = await stat(output);
if (metadata.size === 0) throw new Error("pg_dump produced an empty backup");
await run("pg_restore", ["--list", output], process.env, {
  stdout: "ignore",
});
const checksum = await sha256(output);
await writeFile(`${output}.sha256`, `${checksum}  ${path.basename(output)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
if (process.env.BACKUP_OFFSITE_REQUIRED === "true") {
  const packageManager = process.env.npm_execpath;
  if (!packageManager)
    throw new Error("Run off-host backup through pnpm db:backup");
  await run(process.execPath, [packageManager, "db:backup:offsite"], {
    ...process.env,
    BACKUP_FILE: output,
  });
}
process.stdout.write(
  `Backup verified: ${output} (${metadata.size} bytes, SHA-256 ${checksum})\n`,
);

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

function run(command, args, env, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ["ignore", options.stdout ?? "inherit", "inherit"],
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

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
