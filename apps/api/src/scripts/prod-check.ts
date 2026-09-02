import { readFile } from "node:fs/promises";

import {
  createDatabase,
  REQUIRED_MIGRATION_TIMESTAMP,
} from "@football/database";

import { loadConfig } from "../config.js";
import { S3CompatibleStorageProvider } from "../modules/media/s3-storage-provider.js";
import { UnavailableStorageProvider } from "../modules/media/storage-provider.js";
import { ReadinessService } from "../runtime/readiness.js";

const config = loadConfig(process.env);
if (config.NODE_ENV !== "production")
  throw new Error("prod:check requires NODE_ENV=production");
if (!process.env.NEXT_PUBLIC_API_URL?.startsWith("https://"))
  throw new Error("NEXT_PUBLIC_API_URL must use HTTPS in production");
if (process.env.NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION !== "true")
  throw new Error(
    "NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION must be true in production",
  );

const journalUrl = new URL(
  "../../../../packages/database/drizzle/meta/_journal.json",
  import.meta.url,
);
const journal = JSON.parse(await readFile(journalUrl, "utf8")) as {
  entries?: Array<{ when: number; tag: string }>;
};
const latest = journal.entries?.at(-1);
if (!latest || latest.when !== REQUIRED_MIGRATION_TIMESTAMP)
  throw new Error(
    "Repository migration metadata is inconsistent with the runtime requirement",
  );

const connection = createDatabase(config.DATABASE_URL, {
  max: 1,
  idleTimeoutSeconds: 5,
  connectTimeoutSeconds: Math.ceil(config.DB_CONNECTION_TIMEOUT_MS / 1_000),
});
const storage = config.OBJECT_STORAGE_ENABLED
  ? new S3CompatibleStorageProvider(config.OBJECT_STORAGE_BUCKET!, {
      endpoint: config.OBJECT_STORAGE_ENDPOINT!,
      region: config.OBJECT_STORAGE_REGION,
      accessKey: config.OBJECT_STORAGE_ACCESS_KEY!,
      secretKey: config.OBJECT_STORAGE_SECRET_KEY!,
      forcePathStyle: config.OBJECT_STORAGE_FORCE_PATH_STYLE,
    })
  : new UnavailableStorageProvider();

try {
  const readiness = await new ReadinessService(
    connection.db,
    config,
    storage,
  ).check();
  if (readiness.status !== "ready")
    throw new Error("Database or migration readiness check failed");
  if (config.OBJECT_STORAGE_READINESS_CHECK && readiness.storage !== "ready")
    throw new Error("Object storage readiness check failed");
  process.stdout.write(
    `Production check passed (migration ${latest.tag}, storage ${readiness.storage}, mail ${readiness.mail}).\n`,
  );
} finally {
  await connection.close();
}
