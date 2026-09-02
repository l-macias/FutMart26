import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { z } from "zod";

import {
  createDevelopmentAuthMailService,
  type AuthMailService,
} from "./mail.js";

export {
  createDevelopmentAuthMailService,
  InMemoryAuthMailService,
  type AuthMailMessage,
  type AuthMailService,
} from "./mail.js";
export { createSmtpAuthMailService } from "./smtp-mail.js";
export type { SmtpAuthMailConfig } from "./smtp-mail.js";

export { fromNodeHeaders };

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalBooleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

const optionalPositiveInteger = z.preprocess(
  (value) => (value === undefined || value === "" ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const authEnvironmentSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
  WEB_URL: z.url(),
  ADMIN_URL: z.url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  AUTH_REQUIRE_EMAIL_VERIFICATION: optionalBooleanString,
  AUTH_VERIFICATION_TOKEN_TTL_SECONDS: optionalPositiveInteger,
  AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: optionalPositiveInteger,
  AUTH_RATE_LIMIT_TEST_SCALE: optionalPositiveInteger,
});

export type AuthEnvironment = z.infer<typeof authEnvironmentSchema>;

export interface CreateAuthOptions {
  database: BetterAuthOptions["database"];
  environment?: NodeJS.ProcessEnv;
  mailService?: AuthMailService;
  beforeDeleteUser?: (authUserId: string) => Promise<void>;
  isAccountSuspended?: (authUserId: string) => Promise<boolean>;
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
  const requireEmailVerification =
    environment.AUTH_REQUIRE_EMAIL_VERIFICATION ??
    environment.NODE_ENV === "production";
  const rateLimitScale =
    environment.NODE_ENV === "test"
      ? (environment.AUTH_RATE_LIMIT_TEST_SCALE ?? 1)
      : 1;
  const mailService =
    options.mailService ??
    (environment.NODE_ENV === "production"
      ? undefined
      : createDevelopmentAuthMailService());
  if (!mailService) {
    throw new Error(
      "Production authentication requires an AuthMailService adapter.",
    );
  }

  return betterAuth({
    appName: "F5 Groups",
    baseURL: environment.BETTER_AUTH_URL,
    // Better Auth owns this adapter union; keeping it here prevents the type from leaking.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    database: options.database,
    emailAndPassword: {
      enabled: true,
      autoSignIn: !requireEmailVerification,
      requireEmailVerification,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn:
        environment.AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS ?? 3_600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await mailService.send({
          type: "PASSWORD_RESET",
          recipient: user.email,
          url,
        });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: false,
      expiresIn: environment.AUTH_VERIFICATION_TOKEN_TTL_SECONDS ?? 3_600,
      sendOnSignIn: requireEmailVerification,
      sendOnSignUp: requireEmailVerification,
      sendVerificationEmail: async ({ user, url }) => {
        await mailService.send({
          type: "EMAIL_VERIFICATION",
          recipient: user.email,
          url,
        });
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => options.beforeDeleteUser?.(user.id),
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (await options.isAccountSuspended?.(session.userId))
              throw APIError.from("FORBIDDEN", {
                code: "ACCOUNT_SUSPENDED",
                message: "Account access is suspended",
              });
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 60,
      max: 100 * rateLimitScale,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 * rateLimitScale },
        "/sign-up/email": { window: 600, max: 5 * rateLimitScale },
        "/request-password-reset": { window: 60, max: 3 * rateLimitScale },
        "/send-verification-email": { window: 60, max: 3 * rateLimitScale },
        "/reset-password": { window: 60, max: 5 * rateLimitScale },
      },
    },
    secret: environment.BETTER_AUTH_SECRET,
    socialProviders,
    trustedOrigins: [environment.WEB_URL, environment.ADMIN_URL],
    advanced: {
      useSecureCookies: environment.NODE_ENV === "production",
      // The Fastify delivery adapter overwrites this header from request.ip;
      // browsers never authoritatively provide it.
      ipAddress: { ipAddressHeaders: ["x-client-ip"] },
    },
  });
}

export function createDrizzleAuth(
  database: Parameters<typeof drizzleAdapter>[0],
  schema: Parameters<typeof drizzleAdapter>[1]["schema"],
  environment?: NodeJS.ProcessEnv,
  mailService?: AuthMailService,
  beforeDeleteUser?: (authUserId: string) => Promise<void>,
  isAccountSuspended?: (authUserId: string) => Promise<boolean>,
) {
  return createAuth({
    database: drizzleAdapter(database, { provider: "pg", schema }),
    environment,
    mailService,
    beforeDeleteUser,
    isAccountSuspended,
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
