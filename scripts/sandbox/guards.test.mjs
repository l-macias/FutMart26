import assert from "node:assert/strict";
import test from "node:test";

import {
  deterministicUuid,
  requireResetConfirmation,
  sandboxChildProcessEnvironment,
  sandboxDatabaseUrl,
} from "./config.mjs";

test("sandbox URL accepts only an explicitly named _sandbox database", () => {
  assert.equal(
    sandboxDatabaseUrl({
      SANDBOX_DATABASE_URL: "postgresql://localhost/football_sandbox",
    }).databaseName,
    "football_sandbox",
  );
  for (const databaseName of [
    "football_dev",
    "football_test",
    "football_e2e",
    "football_perf",
    "football",
    "postgres",
    "production_sandbox",
    "football_dev_sandbox",
  ]) {
    assert.throws(() =>
      sandboxDatabaseUrl({
        SANDBOX_DATABASE_URL: `postgresql://localhost/${databaseName}`,
      }),
    );
  }
});

test("sandbox URL is mandatory", () => {
  assert.throws(() => sandboxDatabaseUrl({}), /required/);
});

test("sandbox reset requires the exact destructive confirmation", () => {
  assert.throws(() => requireResetConfirmation({}), /requires/);
  assert.throws(() => requireResetConfirmation({ SANDBOX_CONFIRM: "yes" }));
  assert.doesNotThrow(() =>
    requireResetConfirmation({ SANDBOX_CONFIRM: "RESET" }),
  );
});

test("scenario identifiers are stable for a fixed seed", () => {
  const first = deterministicUuid(20260902, "match", 3);
  assert.equal(first, deterministicUuid(20260902, "match", 3));
  assert.notEqual(first, deterministicUuid(20260903, "match", 3));
  assert.match(
    first,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("sandbox child environment overrides development without mutating its parent", () => {
  const parent = {
    DATABASE_URL: "postgresql://localhost/football_dev",
    SANDBOX_DATABASE_URL: "postgresql://localhost/football_sandbox",
  };
  const { databaseName, environment } = sandboxChildProcessEnvironment(parent);

  assert.equal(databaseName, "football_sandbox");
  assert.equal(new URL(environment.DATABASE_URL).pathname, "/football_sandbox");
  assert.equal(environment.FOOTBALL_SANDBOX, "true");
  assert.equal(parent.DATABASE_URL, "postgresql://localhost/football_dev");
});
