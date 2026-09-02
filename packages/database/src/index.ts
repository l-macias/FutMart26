import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export interface DatabasePoolOptions {
  max?: number;
  idleTimeoutSeconds?: number;
  connectTimeoutSeconds?: number;
}

export const REQUIRED_MIGRATION_TIMESTAMP = 1_788_264_495_072;

export function createDatabase(
  databaseUrl: string,
  options: DatabasePoolOptions = {},
) {
  const client = postgres(databaseUrl, {
    prepare: false,
    max: options.max ?? 10,
    idle_timeout: options.idleTimeoutSeconds ?? 20,
    connect_timeout: options.connectTimeoutSeconds ?? 10,
  });
  return {
    client,
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

export type Database = ReturnType<typeof createDatabase>["db"];
