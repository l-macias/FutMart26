import { createAuthClient } from "better-auth/react";

export function createFootballAuthClient(baseURL: string) {
  return createAuthClient({ baseURL });
}
