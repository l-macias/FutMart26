import { createFootballAuthClient } from "@football/auth/client";

export const authClient = createFootballAuthClient(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
);

export const emailVerificationRequired =
  process.env.NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION !== undefined
    ? process.env.NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION === "true"
    : process.env.NODE_ENV === "production";

export function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/play";
}
