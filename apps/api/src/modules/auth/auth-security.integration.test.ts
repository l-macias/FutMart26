import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";

import {
  createDrizzleAuth,
  InMemoryAuthMailService,
  type AuthMailMessage,
  type FootballAuth,
} from "@football/auth";
import { createDatabase } from "@football/database";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "@football/database/schema";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl &&
  new URL(databaseUrl).pathname.replace(/^\//, "").endsWith("_test")
    ? databaseUrl
    : undefined;

void test(
  "Better Auth recovery, verification, sessions and rate limits are secure",
  { skip: !safeUrl },
  async () => {
    const connection = createDatabase(safeUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const mail = new InMemoryAuthMailService();
    const auth = createTestAuth(connection.db, mail);
    const email = `${randomUUID()}@test.local`;
    const originalPassword = "original-password-123";
    const recoveredPassword = "recovered-password-456";
    const changedPassword = "changed-password-789";

    try {
      const signUp = await authRequest(auth, "/sign-up/email", {
        body: {
          callbackURL: "http://localhost:3000/auth/verify-email?verified=1",
          email,
          name: "Auth test player",
          password: originalPassword,
        },
        ip: "192.0.2.10",
      });
      assert.equal(signUp.status, 200);
      assert.equal(signUp.headers.get("set-cookie"), null);
      assert.equal(mail.messages.length, 1);
      assert.equal(mail.messages[0]?.type, "EMAIL_VERIFICATION");

      const unverifiedLogin = await signIn(
        auth,
        email,
        originalPassword,
        "192.0.2.11",
      );
      assert.equal(unverifiedLogin.status, 403);
      assert.match(await unverifiedLogin.text(), /EMAIL_NOT_VERIFIED/);

      const resend = await authRequest(auth, "/send-verification-email", {
        body: {
          callbackURL: "http://localhost:3000/auth/verify-email?verified=1",
          email,
        },
        ip: "192.0.2.12",
      });
      assert.equal(resend.status, 200);
      assert.equal(mail.messages.length, 3);

      const invalidVerification = await authRequest(
        auth,
        "/verify-email?token=invalid-token",
        { method: "GET", ip: "192.0.2.13" },
      );
      assert.equal(invalidVerification.status, 401);
      assert.doesNotMatch(await invalidVerification.text(), /invalid-token/);

      const verification = latestMail(mail, "EMAIL_VERIFICATION");
      const verifyResponse = await auth.handler(new Request(verification.url));
      assert.equal(verifyResponse.status, 302);
      assert.match(verifyResponse.headers.get("location") ?? "", /verified=1/);

      const unknownMailCount = mail.messages.length;
      const unknownRecovery = await authRequest(
        auth,
        "/request-password-reset",
        {
          body: {
            email: `${randomUUID()}@test.local`,
            redirectTo: "http://localhost:3000/auth/reset-password",
          },
          ip: "192.0.2.14",
        },
      );
      assert.equal(unknownRecovery.status, 200);
      assert.equal(mail.messages.length, unknownMailCount);
      assert.match(await unknownRecovery.text(), /If this email exists/);

      const recovery = await authRequest(auth, "/request-password-reset", {
        body: {
          email,
          redirectTo: "http://localhost:3000/auth/reset-password",
        },
        ip: "192.0.2.15",
      });
      assert.equal(recovery.status, 200);
      assert.match(await recovery.text(), /If this email exists/);
      const resetMail = latestMail(mail, "PASSWORD_RESET");
      const resetToken = new URL(resetMail.url).pathname.split("/").at(-1)!;

      const reset = await authRequest(auth, "/reset-password", {
        body: { newPassword: recoveredPassword, token: resetToken },
        ip: "192.0.2.16",
      });
      assert.equal(reset.status, 200);
      const reusedReset = await authRequest(auth, "/reset-password", {
        body: { newPassword: "another-password-123", token: resetToken },
        ip: "192.0.2.17",
      });
      assert.equal(reusedReset.status, 400);
      const reusedBody = await reusedReset.text();
      assert.doesNotMatch(reusedBody, new RegExp(resetToken));
      assert.doesNotMatch(reusedBody, /another-password-123/);

      assert.equal(
        (await signIn(auth, email, originalPassword, "192.0.2.18")).status,
        401,
      );
      const loginA = await signIn(auth, email, recoveredPassword, "192.0.2.19");
      const loginB = await signIn(auth, email, recoveredPassword, "192.0.2.20");
      assert.equal(loginA.status, 200);
      assert.equal(loginB.status, 200);
      let cookieA = sessionCookie(loginA);
      const cookieB = sessionCookie(loginB);

      const listed = await authRequest(auth, "/list-sessions", {
        cookie: cookieA,
        method: "GET",
        ip: "192.0.2.21",
      });
      assert.equal(listed.status, 200);
      const listedSessions = (await listed.json()) as { token: string }[];
      assert.equal(listedSessions.length, 2);

      const wrongChange = await authRequest(auth, "/change-password", {
        body: {
          currentPassword: "wrong-password-123",
          newPassword: changedPassword,
          revokeOtherSessions: true,
        },
        cookie: cookieA,
        ip: "192.0.2.22",
      });
      assert.equal(wrongChange.status, 400);

      const change = await authRequest(auth, "/change-password", {
        body: {
          currentPassword: recoveredPassword,
          newPassword: changedPassword,
          revokeOtherSessions: true,
        },
        cookie: cookieA,
        ip: "192.0.2.23",
      });
      assert.equal(change.status, 200);
      const rotatedCookie = change.headers.get("set-cookie")?.split(";")[0];
      if (rotatedCookie) cookieA = rotatedCookie;
      const afterChange = await authRequest(auth, "/list-sessions", {
        cookie: cookieA,
        method: "GET",
        ip: "192.0.2.24",
      });
      assert.equal(afterChange.status, 200);
      assert.equal(((await afterChange.json()) as unknown[]).length, 1);
      assert.equal(await sessionUser(auth, cookieB, "192.0.2.25"), null);

      const foreignMail = new InMemoryAuthMailService();
      const foreignAuth = createTestAuth(connection.db, foreignMail);
      const foreignEmail = `${randomUUID()}@test.local`;
      await authRequest(foreignAuth, "/sign-up/email", {
        body: {
          email: foreignEmail,
          name: "Foreign auth user",
          password: "foreign-password-123",
        },
        ip: "192.0.2.26",
      });
      await foreignAuth.handler(
        new Request(latestMail(foreignMail, "EMAIL_VERIFICATION").url),
      );
      const foreignLogin = await signIn(
        foreignAuth,
        foreignEmail,
        "foreign-password-123",
        "192.0.2.27",
      );
      const foreignCookie = sessionCookie(foreignLogin);
      const foreignSessionsResponse = await authRequest(
        foreignAuth,
        "/list-sessions",
        { cookie: foreignCookie, method: "GET", ip: "192.0.2.28" },
      );
      const foreignSessions = (await foreignSessionsResponse.json()) as {
        token: string;
      }[];
      const foreignToken = foreignSessions[0]!.token;
      const foreignRevokeAttempt = await authRequest(auth, "/revoke-session", {
        body: { token: foreignToken },
        cookie: cookieA,
        ip: "192.0.2.29",
      });
      assert.equal(foreignRevokeAttempt.status, 200);
      assert.equal(
        await sessionUser(foreignAuth, foreignCookie, "192.0.2.30"),
        foreignEmail,
      );

      const closeOthers = await authRequest(auth, "/revoke-other-sessions", {
        body: {},
        cookie: cookieA,
        ip: "192.0.2.31",
      });
      assert.equal(closeOthers.status, 200);
      const logout = await authRequest(auth, "/sign-out", {
        body: {},
        cookie: cookieA,
        ip: "192.0.2.32",
      });
      assert.equal(logout.status, 200);
      assert.equal(await sessionUser(auth, cookieA, "192.0.2.33"), null);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await signIn(
          auth,
          `${randomUUID()}@test.local`,
          "invalid-password-123",
          "192.0.2.77",
        );
        assert.equal(response.status, 401);
      }
      const limitedLogin = await signIn(
        auth,
        `${randomUUID()}@test.local`,
        "invalid-password-123",
        "192.0.2.77",
      );
      assert.equal(limitedLogin.status, 429);
      assert.ok(limitedLogin.headers.get("x-retry-after"));

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await authRequest(auth, "/request-password-reset", {
          body: {
            email: `${randomUUID()}@test.local`,
            redirectTo: "http://localhost:3000/auth/reset-password",
          },
          ip: "192.0.2.78",
        });
        assert.equal(response.status, 200);
      }
      const limitedRecovery = await authRequest(
        auth,
        "/request-password-reset",
        {
          body: {
            email: `${randomUUID()}@test.local`,
            redirectTo: "http://localhost:3000/auth/reset-password",
          },
          ip: "192.0.2.78",
        },
      );
      assert.equal(limitedRecovery.status, 429);
      assert.doesNotMatch(await limitedRecovery.text(), /test\.local/);

      const expiringMail = new InMemoryAuthMailService();
      const expiringAuth = createTestAuth(connection.db, expiringMail, {
        AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: "1",
        AUTH_VERIFICATION_TOKEN_TTL_SECONDS: "1",
      });
      await authRequest(expiringAuth, "/sign-up/email", {
        body: {
          email: `${randomUUID()}@test.local`,
          name: "Expiring verification",
          password: "expiring-password-123",
        },
        ip: "192.0.2.79",
      });
      await new Promise((resolve) => setTimeout(resolve, 1_100));
      const expiredVerification = await expiringAuth.handler(
        new Request(latestMail(expiringMail, "EMAIL_VERIFICATION").url),
      );
      assert.equal(expiredVerification.status, 302);
      assert.match(expiredVerification.headers.get("location") ?? "", /error=/);

      const expiringResetEmail = `${randomUUID()}@test.local`;
      await authRequest(expiringAuth, "/sign-up/email", {
        body: {
          email: expiringResetEmail,
          name: "Expiring reset",
          password: "expiring-reset-password-123",
        },
        ip: "192.0.2.81",
      });
      await expiringAuth.handler(
        new Request(latestMail(expiringMail, "EMAIL_VERIFICATION").url),
      );
      await authRequest(expiringAuth, "/request-password-reset", {
        body: {
          email: expiringResetEmail,
          redirectTo: "http://localhost:3000/auth/reset-password",
        },
        ip: "192.0.2.82",
      });
      const expiringResetToken = new URL(
        latestMail(expiringMail, "PASSWORD_RESET").url,
      ).pathname
        .split("/")
        .at(-1)!;
      await new Promise((resolve) => setTimeout(resolve, 1_100));
      const expiredReset = await authRequest(expiringAuth, "/reset-password", {
        body: {
          newPassword: "expired-reset-password-456",
          token: expiringResetToken,
        },
        ip: "192.0.2.83",
      });
      assert.equal(expiredReset.status, 400);
      assert.doesNotMatch(await expiredReset.text(), /expired-reset-password/);

      const finalLogin = await signIn(
        auth,
        email,
        changedPassword,
        "192.0.2.80",
      );
      assert.equal(finalLogin.status, 200);

      const [account] = await connection.db
        .select({ id: authUser.id })
        .from(authUser)
        .where(eq(authUser.email, email))
        .limit(1);
      const suspendedAuth = createTestAuth(
        connection.db,
        new InMemoryAuthMailService(),
        {},
        undefined,
        (authUserId) => Promise.resolve(authUserId === account!.id),
      );
      const suspendedLogin = await signIn(
        suspendedAuth,
        email,
        changedPassword,
        "192.0.2.89",
      );
      assert.equal(suspendedLogin.status, 403);
      assert.match(await suspendedLogin.text(), /ACCOUNT_SUSPENDED/);

      const deletionMail = new InMemoryAuthMailService();
      const deletedAuthIds: string[] = [];
      const deletionAuth = createTestAuth(
        connection.db,
        deletionMail,
        {},
        (authUserId) => {
          deletedAuthIds.push(authUserId);
          return Promise.resolve();
        },
      );
      const deletionEmail = `${randomUUID()}@test.local`;
      const deletionPassword = "delete-account-password-123";
      await authRequest(deletionAuth, "/sign-up/email", {
        body: {
          email: deletionEmail,
          name: "Delete account",
          password: deletionPassword,
        },
        ip: "192.0.2.84",
      });
      await deletionAuth.handler(
        new Request(latestMail(deletionMail, "EMAIL_VERIFICATION").url),
      );
      const deletionLogin = await signIn(
        deletionAuth,
        deletionEmail,
        deletionPassword,
        "192.0.2.85",
      );
      const deletionCookie = sessionCookie(deletionLogin);
      const deletionResponse = await authRequest(deletionAuth, "/delete-user", {
        body: { password: deletionPassword },
        cookie: deletionCookie,
        ip: "192.0.2.86",
      });
      assert.equal(deletionResponse.status, 200);
      assert.equal(deletedAuthIds.length, 1);
      assert.equal(
        await sessionUser(deletionAuth, deletionCookie, "192.0.2.87"),
        null,
      );
      assert.equal(
        (
          await signIn(
            deletionAuth,
            deletionEmail,
            deletionPassword,
            "192.0.2.88",
          )
        ).status,
        401,
      );
    } finally {
      await connection.close();
    }
  },
);

function createTestAuth(
  database: Parameters<typeof createDrizzleAuth>[0],
  mailService: InMemoryAuthMailService,
  extraEnvironment: NodeJS.ProcessEnv = {},
  beforeDeleteUser?: (authUserId: string) => Promise<void>,
  isAccountSuspended?: (authUserId: string) => Promise<boolean>,
) {
  return createDrizzleAuth(
    database,
    {
      account: authAccount,
      session: authSession,
      user: authUser,
      verification: authVerification,
    },
    {
      ADMIN_URL: "http://localhost:3001",
      AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
      BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:4000",
      NODE_ENV: "test",
      WEB_URL: "http://localhost:3000",
      ...extraEnvironment,
    },
    mailService,
    beforeDeleteUser,
    isAccountSuspended,
  );
}

async function authRequest(
  auth: FootballAuth,
  pathName: string,
  options: {
    body?: Record<string, unknown>;
    cookie?: string;
    ip: string;
    method?: "GET" | "POST";
  },
) {
  const headers = new Headers({
    origin: "http://localhost:3000",
    // Direct Better Auth tests must use the trusted header configured by the
    // adapter. Fastify derives this value from request.ip in production.
    "x-client-ip": options.ip,
  });
  if (options.body) headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);
  return auth.handler(
    new Request(`http://localhost:4000/api/auth${pathName}`, {
      method: options.method ?? "POST",
      headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    }),
  );
}

function signIn(
  auth: FootballAuth,
  email: string,
  password: string,
  ip: string,
) {
  return authRequest(auth, "/sign-in/email", {
    body: { email, password },
    ip,
  });
}

function sessionCookie(response: Response) {
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  return cookie;
}

async function sessionUser(auth: FootballAuth, cookie: string, ip: string) {
  const response = await authRequest(auth, "/get-session", {
    cookie,
    ip,
    method: "GET",
  });
  const payload = (await response.json()) as {
    user?: { email: string };
  } | null;
  return payload?.user?.email ?? null;
}

function latestMail<Type extends AuthMailMessage["type"]>(
  mail: InMemoryAuthMailService,
  type: Type,
): Extract<AuthMailMessage, { type: Type }> {
  for (let index = mail.messages.length - 1; index >= 0; index -= 1) {
    const message = mail.messages[index];
    if (message?.type === type) {
      return message as Extract<AuthMailMessage, { type: Type }>;
    }
  }
  assert.fail(`No ${type} mail was dispatched`);
}
