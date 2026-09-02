import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { FootballAuth } from "@football/auth";
import {
  REQUIRED_MIGRATION_TIMESTAMP,
  type Database,
} from "@football/database";
import { createLoggerOptions } from "@football/observability";

import { buildApp } from "../app.js";
import { loadConfig, type ApiConfig } from "../config.js";
import { InMemoryStorageProvider } from "../modules/media/storage-provider.js";
import { ReadinessService } from "./readiness.js";
import { createShutdownController } from "./shutdown.js";

const productionEnvironment = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/football_test",
  WEB_URL: "https://app.example.test",
  ADMIN_URL: "https://admin.example.test",
  BETTER_AUTH_SECRET: "production-secret-with-at-least-32-characters",
  BETTER_AUTH_URL: "https://api.example.test",
  SUPPORT_EMAIL: "support@example.test",
  NODE_ENV: "production",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  MAIL_FROM: "F5 Groups <no-reply@example.test>",
  OBJECT_STORAGE_ENABLED: "true",
  OBJECT_STORAGE_ENDPOINT: "https://storage.example.test",
  OBJECT_STORAGE_BUCKET: "football-media",
  OBJECT_STORAGE_ACCESS_KEY: "access-key",
  OBJECT_STORAGE_SECRET_KEY: "secret-key",
} satisfies NodeJS.ProcessEnv;

void test("production environment validation is strict and provider-agnostic", () => {
  assert.throws(() =>
    loadConfig({ ...productionEnvironment, BETTER_AUTH_SECRET: "" }),
  );
  assert.throws(() => loadConfig({ ...productionEnvironment, SMTP_HOST: "" }));
  assert.throws(() =>
    loadConfig({ ...productionEnvironment, OBJECT_STORAGE_ENABLED: "false" }),
  );
  assert.throws(() =>
    loadConfig({
      ...productionEnvironment,
      BETTER_AUTH_URL: "http://api.example.test",
    }),
  );
  assert.throws(() =>
    loadConfig({
      ...productionEnvironment,
      AUTH_REQUIRE_EMAIL_VERIFICATION: "false",
    }),
  );
  const config = loadConfig(productionEnvironment);
  assert.equal(config.DB_POOL_MAX, 10);
  assert.equal(config.DB_IDLE_TIMEOUT_MS, 20_000);
  assert.equal(config.DB_CONNECTION_TIMEOUT_MS, 10_000);
  assert.equal(config.SMTP_HOST, "smtp.example.test");

  const development = loadConfig({
    ...productionEnvironment,
    NODE_ENV: "development",
    WEB_URL: "http://localhost:3000",
    ADMIN_URL: "http://localhost:3001",
    BETTER_AUTH_URL: "http://localhost:4000",
    SMTP_HOST: "",
    MAIL_FROM: "",
    OBJECT_STORAGE_ENABLED: "false",
  });
  assert.equal(development.OBJECT_STORAGE_ENABLED, false);
});

void test("runtime migration requirement matches the repository journal", async () => {
  const journal = JSON.parse(
    await readFile(
      path.resolve(
        process.cwd(),
        "../../packages/database/drizzle/meta/_journal.json",
      ),
      "utf8",
    ),
  ) as { entries: Array<{ when: number }> };
  assert.equal(journal.entries.at(-1)?.when, REQUIRED_MIGRATION_TIMESTAMP);
});

void test("health is independent while readiness fails closed without DB", async () => {
  const config = testConfig();
  const database = {
    execute: () => Promise.reject(new Error("database unavailable")),
  } as unknown as Database;
  const app = buildApp(config, {
    database,
    storage: new InMemoryStorageProvider(),
    auth: anonymousAuth(),
  });
  assert.equal((await app.inject("/health")).statusCode, 200);
  const ready = await app.inject("/ready");
  assert.equal(ready.statusCode, 503);
  assert.deepEqual(ready.json(), {
    status: "not_ready",
    database: "unavailable",
    migrations: "unavailable",
    mail: "configured",
    storage: "disabled",
    version: null,
    gitSha: null,
  });
  assert.doesNotMatch(ready.body, /postgres|password|secret-key/i);
  await app.close();
});

void test("readiness rejects migration drift and accepts the repository migration", async () => {
  let calls = 0;
  const mismatchDatabase = {
    execute: () => Promise.resolve(++calls === 1 ? [] : [{ created_at: "1" }]),
  } as unknown as Database;
  const mismatch = await new ReadinessService(
    mismatchDatabase,
    testConfig(),
    new InMemoryStorageProvider(),
  ).check();
  assert.equal(mismatch.database, "ready");
  assert.equal(mismatch.migrations, "mismatch");
  assert.equal(mismatch.status, "not_ready");

  calls = 0;
  const readyDatabase = {
    execute: () =>
      Promise.resolve(
        ++calls === 1
          ? []
          : [{ created_at: String(REQUIRED_MIGRATION_TIMESTAMP) }],
      ),
  } as unknown as Database;
  const ready = await new ReadinessService(
    readyDatabase,
    testConfig(),
    new InMemoryStorageProvider(),
  ).check();
  assert.equal(ready.status, "ready");
  assert.equal(ready.migrations, "ready");
});

void test("graceful shutdown is idempotent and closes once", async () => {
  let closes = 0;
  const messages: string[] = [];
  const controller = createShutdownController({
    close: () => {
      closes += 1;
      return Promise.resolve();
    },
    timeoutMs: 1_000,
    logger: {
      info: (_metadata, message) => messages.push(message),
      warn: (_metadata, message) => messages.push(message),
    },
    forceExit: () => assert.fail("shutdown must not force exit"),
  });
  const first = controller.run("SIGTERM");
  const second = controller.run("SIGINT");
  assert.equal(first, second);
  await first;
  assert.equal(closes, 1);
  assert.deepEqual(messages, [
    "graceful shutdown started",
    "graceful shutdown completed",
  ]);
});

void test("structured logging redacts credentials and recovery material", () => {
  const logger = createLoggerOptions({ level: "info", service: "api" });
  for (const sensitive of [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers.set-cookie",
    "body.password",
    "body.token",
  ])
    assert.ok(logger.redact.paths.includes(sensitive));
});

void test("backup and restore scripts enforce destructive-operation guardrails", () => {
  const root = path.resolve(process.cwd(), "../..");
  const backup = spawnSync(
    process.execPath,
    [path.join(root, "scripts/backup-db.mjs")],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: productionEnvironment.DATABASE_URL },
      encoding: "utf8",
    },
  );
  assert.notEqual(backup.status, 0);
  assert.match(`${backup.stderr}${backup.stdout}`, /BACKUP_DIR is required/);

  const restore = spawnSync(
    process.execPath,
    [path.join(root, "scripts/restore-db.mjs")],
    {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: productionEnvironment.DATABASE_URL,
        RESTORE_DATABASE_URL: productionEnvironment.DATABASE_URL,
        RESTORE_DUMP_FILE: "missing.dump",
        RESTORE_CONFIRM: "RESTORE_NON_PRODUCTION",
      },
      encoding: "utf8",
    },
  );
  assert.notEqual(restore.status, 0);
  assert.match(
    `${restore.stderr}${restore.stdout}`,
    /must not equal DATABASE_URL/,
  );
});

function testConfig(): ApiConfig {
  return loadConfig({
    ...productionEnvironment,
    NODE_ENV: "test",
    WEB_URL: "http://localhost:3000",
    ADMIN_URL: "http://localhost:3001",
    BETTER_AUTH_URL: "http://localhost:4000",
    SMTP_HOST: "",
    MAIL_FROM: "",
    OBJECT_STORAGE_ENABLED: "false",
    OBJECT_STORAGE_READINESS_CHECK: "false",
    LOG_LEVEL: "silent",
  });
}

function anonymousAuth() {
  return {
    api: { getSession: () => Promise.resolve(null) },
    handler: () => Promise.resolve(new Response(null, { status: 404 })),
  } as unknown as FootballAuth;
}
