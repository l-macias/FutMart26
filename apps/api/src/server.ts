import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDrizzleAuth, createSmtpAuthMailService } from "@football/auth";
import { createDatabase } from "@football/database";
import { and, eq, isNull } from "drizzle-orm";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
  accountSuspensions,
} from "@football/database/schema";
import { S3CompatibleStorageProvider } from "./modules/media/s3-storage-provider.js";
import { UnavailableStorageProvider } from "./modules/media/storage-provider.js";
import { PlayerMediaService } from "./modules/media/player-media-service.js";
import { GroupService } from "./modules/groups/group-service.js";
import { AccountDeletionService } from "./modules/privacy/account-deletion-service.js";
import { createShutdownController } from "./runtime/shutdown.js";

const config = loadConfig();
const database = createDatabase(config.DATABASE_URL, {
  max: config.DB_POOL_MAX,
  idleTimeoutSeconds: Math.ceil(config.DB_IDLE_TIMEOUT_MS / 1_000),
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
const accountDeletion = new AccountDeletionService(
  database.db,
  new GroupService(database.db),
  new PlayerMediaService(database.db, storage),
);
const mailService =
  config.SMTP_HOST && config.MAIL_FROM
    ? createSmtpAuthMailService({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        user: config.SMTP_USER,
        password: config.SMTP_PASSWORD,
        from: config.MAIL_FROM,
      })
    : undefined;
const auth = createDrizzleAuth(
  database.db,
  {
    user: authUser,
    session: authSession,
    account: authAccount,
    verification: authVerification,
  },
  process.env,
  mailService,
  (authUserId) => accountDeletion.anonymizeBeforeAuthDeletion(authUserId),
  async (authUserId) => {
    const [suspension] = await database.db
      .select({ id: accountSuspensions.id })
      .from(accountSuspensions)
      .where(
        and(
          eq(accountSuspensions.authUserId, authUserId),
          isNull(accountSuspensions.reactivatedAt),
        ),
      )
      .limit(1);
    return Boolean(suspension);
  },
);
const app = buildApp(config, { auth, database: database.db, storage });
app.addHook("onClose", async () => database.close());
const shutdown = createShutdownController({
  close: () => app.close(),
  timeoutMs: config.SHUTDOWN_TIMEOUT_MS,
  logger: app.log,
});
shutdown.register();

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.fatal({ err: error }, "API failed to start");
  process.exitCode = 1;
}
