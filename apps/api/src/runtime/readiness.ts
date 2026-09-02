import { sql } from "drizzle-orm";

import {
  REQUIRED_MIGRATION_TIMESTAMP,
  type Database,
} from "@football/database";

import type { ApiConfig } from "../config.js";
import type { StorageProvider } from "../modules/media/storage-provider.js";

export interface ReadinessSnapshot {
  status: "ready" | "not_ready";
  database: "ready" | "unavailable";
  migrations: "ready" | "mismatch" | "unavailable";
  mail: "configured" | "unconfigured";
  storage: "ready" | "configured" | "disabled" | "unavailable";
  version: string | null;
  gitSha: string | null;
}

export class ReadinessService {
  constructor(
    private readonly database: Database,
    private readonly config: ApiConfig,
    private readonly storage: StorageProvider,
  ) {}

  async check(): Promise<ReadinessSnapshot> {
    let database: ReadinessSnapshot["database"] = "unavailable";
    let migrations: ReadinessSnapshot["migrations"] = "unavailable";
    try {
      await this.database.execute(sql`select 1`);
      database = "ready";
      const rows = await this.database.execute<{ created_at: string }>(
        sql`select created_at::text from drizzle.__drizzle_migrations order by created_at desc limit 1`,
      );
      const latest = Array.from(rows)[0]?.created_at;
      migrations =
        latest === String(REQUIRED_MIGRATION_TIMESTAMP) ? "ready" : "mismatch";
    } catch {
      // Readiness intentionally reports a bounded status without leaking errors.
    }

    let storage: ReadinessSnapshot["storage"] = this.config
      .OBJECT_STORAGE_ENABLED
      ? "configured"
      : "disabled";
    if (
      this.config.OBJECT_STORAGE_ENABLED &&
      this.config.OBJECT_STORAGE_READINESS_CHECK
    ) {
      try {
        await this.storage.checkReadiness();
        storage = "ready";
      } catch {
        storage = "unavailable";
      }
    }

    const criticalReady = database === "ready" && migrations === "ready";
    return {
      status: criticalReady ? "ready" : "not_ready",
      database,
      migrations,
      mail:
        this.config.NODE_ENV !== "production" ||
        (this.config.SMTP_HOST && this.config.MAIL_FROM)
          ? "configured"
          : "unconfigured",
      storage,
      version: this.config.APP_VERSION ?? null,
      gitSha: this.config.GIT_SHA ?? null,
    };
  }
}
