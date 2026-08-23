import { betterAuth, type BetterAuthOptions } from "better-auth";
import { z } from "zod";

const authEnvironmentSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
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
  });
}
