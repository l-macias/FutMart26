import { createFootballAuthClient } from "@football/auth/client";

export const authClient = createFootballAuthClient(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
);
