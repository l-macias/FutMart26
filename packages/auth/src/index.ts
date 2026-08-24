import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { z } from "zod";

const authEnvironmentSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  WEB_URL: z.url(),
  ADMIN_URL: z.url(),
});

export type AuthEnvironment = z.infer<typeof authEnvironmentSchema>;

export interface CreateAuthOptions {
  database: BetterAuthOptions["database"];
  environment?: NodeJS.ProcessEnv;
}

export function createAuth(options: CreateAuthOptions) {
  const environment = authEnvironmentSchema.parse(
    options.environment ?? process.env,
  );
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } =
    environment;
  const socialProviders =
    clientId !== undefined && clientSecret !== undefined
      ? { google: { clientId, clientSecret } }
      : undefined;

  return betterAuth({
    baseURL: environment.BETTER_AUTH_URL,
    // Better Auth owns this adapter union; keeping it here prevents the type from leaking.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    database: options.database,
    emailAndPassword: { enabled: true },
    secret: environment.BETTER_AUTH_SECRET,
    socialProviders,
    trustedOrigins: [environment.WEB_URL, environment.ADMIN_URL],
  });
}

export function createDrizzleAuth(
  database: Parameters<typeof drizzleAdapter>[0],
  schema: Parameters<typeof drizzleAdapter>[1]["schema"],
  environment?: NodeJS.ProcessEnv,
) {
  return createAuth({
    database: drizzleAdapter(database, { provider: "pg", schema }),
    environment,
  });
}

export type FootballAuth = ReturnType<typeof createAuth>;

export async function resolveAuthIdentity(
  auth: FootballAuth,
  headers: NodeJS.Dict<string | string[]>,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });
  return session?.user
    ? { authUserId: session.user.id, displayName: session.user.name }
    : null;
}

export function createAuthNodeHandler(auth: FootballAuth) {
  return toNodeHandler(auth.handler);
}
