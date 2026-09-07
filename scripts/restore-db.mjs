import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
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
await verifyChecksum(source);
await run("pg_restore", ["--list", source], process.env, { stdout: "ignore" });
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

async function verifyChecksum(source) {
  const sidecar = `${source}.sha256`;
  await access(sidecar);
  const expected = (await readFile(sidecar, "utf8")).trim().split(/\s+/, 1)[0];
  if (!/^[0-9a-f]{64}$/i.test(expected ?? ""))
    throw new Error("Backup checksum file is invalid");
  const actual = await sha256(source);
  if (actual !== expected) throw new Error("Backup checksum mismatch");
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
