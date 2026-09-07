import { createHash } from "node:crypto";

export const SANDBOX_PASSWORD = "Sandbox123!";

export function deterministicUuid(seed, scope, index) {
  const hex = createHash("sha256")
    .update(`${seed}:${scope}:${index}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function sandboxDatabaseUrl(environment = process.env) {
  const value = environment.SANDBOX_DATABASE_URL;
  if (!value)
    throw new Error("SANDBOX_DATABASE_URL is required for sandbox commands");
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z0-9][a-z0-9_-]*_sandbox$/i.test(databaseName))
    throw new Error(
      "Sandbox database name must end with _sandbox (recommended: football_sandbox)",
    );
  if (
    /(^|_)(prod|production|dev|test|e2e|perf|postgres)(_|$)/i.test(databaseName)
  )
    throw new Error(
      "Sandbox database name contains a forbidden environment label",
    );
  return { databaseName, url };
}

export function requireResetConfirmation(environment = process.env) {
  if (environment.SANDBOX_CONFIRM !== "RESET")
    throw new Error(
      "Sandbox reset requires SANDBOX_CONFIRM=RESET; no database was changed",
    );
}

export function sandboxChildProcessEnvironment(environment = process.env) {
  const { databaseName, url } = sandboxDatabaseUrl(environment);
  return {
    databaseName,
    environment: {
      ...environment,
      DATABASE_URL: url.toString(),
      FOOTBALL_SANDBOX: "true",
    },
  };
}
