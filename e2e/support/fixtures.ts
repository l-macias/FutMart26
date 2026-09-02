import { randomUUID } from "node:crypto";

import {
  expect,
  request,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";
import postgres from "postgres";

import { e2eDatabaseUrl } from "../../scripts/e2e-database-url.mjs";

const apiBase = "http://127.0.0.1:4000";
const password = "E2e-safe-password-123";

export interface E2eUser {
  email: string;
  password: string;
  name: string;
  playerId: string;
  api: APIRequestContext;
}

export function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function createReadyUser(prefix: string): Promise<E2eUser> {
  const label = uniqueLabel(prefix);
  const email = `${label.toLowerCase()}@example.test`;
  const name = `Player ${label}`;
  const api = await request.newContext({ baseURL: apiBase });
  const signup = await api.post("/api/auth/sign-up/email", {
    data: {
      email,
      name,
      password,
      callbackURL: "http://127.0.0.1:3000/auth/verify-email",
    },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  await verifyEmail(email);
  const signin = await api.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  expect(signin.ok(), await signin.text()).toBeTruthy();
  const compliance = await api.put("/me/compliance", {
    data: {
      dateOfBirth: "1990-01-15",
      acceptTerms: true,
      acceptPrivacy: true,
    },
  });
  expect(compliance.ok(), await compliance.text()).toBeTruthy();
  const preferences = await api.put("/me/football-preferences/F5", {
    data: {
      preferredRoles: ["MEDIO"],
      willingToPlayGoalkeeper: false,
      strengths: ["PASE"],
    },
  });
  expect(preferences.ok(), await preferences.text()).toBeTruthy();
  const player = await api.get("/me/player");
  expect(player.ok(), await player.text()).toBeTruthy();
  return { email, password, name, playerId: (await player.json()).id, api };
}

export async function applyApiSession(
  api: APIRequestContext,
  browserContext: BrowserContext,
) {
  const state = await api.storageState();
  await browserContext.addCookies(state.cookies);
}

export async function verifyEmail(email: string) {
  const database = postgres(e2eDatabaseUrl(), { max: 1 });
  try {
    await database`
      update auth_user set email_verified = true, updated_at = now()
      where email = ${email}
    `;
  } finally {
    await database.end();
  }
}

export async function grantSuperadmin(email: string) {
  const database = postgres(e2eDatabaseUrl(), { max: 1 });
  try {
    await database`
      insert into admin_grants (auth_user_id, role)
      select id, 'SUPERADMIN' from auth_user where email = ${email}
      on conflict (auth_user_id) do nothing
    `;
  } finally {
    await database.end();
  }
}

export async function createGroup(owner: E2eUser, name = uniqueLabel("Group")) {
  const response = await owner.api.post("/groups", { data: { name } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<{ id: string; name: string }>;
}

export async function joinGroup(
  owner: E2eUser,
  member: E2eUser,
  groupId: string,
) {
  const invitation = await owner.api.post(`/groups/${groupId}/invitations`, {
    data: { type: "SINGLE_USE" },
  });
  expect(invitation.ok(), await invitation.text()).toBeTruthy();
  const { token } = (await invitation.json()) as { token: string };
  const joined = await member.api.post(
    `/invitations/${encodeURIComponent(token)}/join`,
  );
  expect(joined.ok(), await joined.text()).toBeTruthy();
}

export async function createFinishedMatch(owner: E2eUser, member: E2eUser) {
  const group = await createGroup(owner);
  await joinGroup(owner, member, group.id);
  const created = await owner.api.post(`/groups/${group.id}/matches`, {
    data: {
      discipline: "F5",
      scheduledAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      durationMinutes: 60,
      capacity: 2,
      locationText: "Cancha E2E",
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const match = (await created.json()) as { id: string };
  await expectOk(owner.api.post(`/matches/${match.id}/publish`));
  await expectOk(owner.api.post(`/matches/${match.id}/join`));
  await expectOk(member.api.post(`/matches/${match.id}/join`));
  const rosterResponse = await owner.api.get(`/matches/${match.id}/roster`);
  await expectOk(rosterResponse);
  const roster = (await rosterResponse.json()) as {
    confirmed: { id: string; playerId: string }[];
  };
  const teams = await owner.api.post(`/matches/${match.id}/teams/generate`);
  await expectOk(teams);
  const generatedTeams = (await teams.json()) as {
    TEAM_A: { participants: { participantId: string }[] };
  };
  const teamAScorerId = generatedTeams.TEAM_A.participants[0]?.participantId;
  await expectOk(owner.api.post(`/matches/${match.id}/start`));
  await expectOk(owner.api.post(`/matches/${match.id}/finish`));
  await expectOk(
    owner.api.put(`/matches/${match.id}/final-roster`, {
      data: {
        participants: roster.confirmed.map((participant) => ({
          participantId: participant.id,
          attendance: "PLAYED",
        })),
      },
    }),
  );
  await expectOk(
    owner.api.put(`/matches/${match.id}/result`, {
      data: {
        teamAGoals: 1,
        teamBGoals: 0,
        participants: roster.confirmed.map((participant) => ({
          participantId: participant.id,
          goals: participant.id === teamAScorerId ? 1 : 0,
          assists: 0,
        })),
      },
    }),
  );
  await expectOk(owner.api.post(`/matches/${match.id}/result/confirm`));
  return { group, match, roster: roster.confirmed };
}

export async function expectOk(
  responsePromise:
    | Promise<import("@playwright/test").APIResponse>
    | import("@playwright/test").APIResponse,
) {
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBeTruthy();
  return response;
}
