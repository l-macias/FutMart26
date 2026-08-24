import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDrizzleAuth } from "@football/auth";
import { createDatabase } from "@football/database";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "@football/database/schema";

const config = loadConfig();
const database = createDatabase(config.DATABASE_URL);
const auth = createDrizzleAuth(database.db, {
  user: authUser,
  session: authSession,
  account: authAccount,
  verification: authVerification,
});
const app = buildApp(config, { auth, database: database.db });
app.addHook("onClose", async () => database.close());

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.fatal({ err: error }, "API failed to start");
  process.exitCode = 1;
}
