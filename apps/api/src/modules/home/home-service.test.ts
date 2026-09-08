import assert from "node:assert/strict";
import test from "node:test";

import { HomeService } from "./home-service.js";

void test("Home read model is bounded and keeps optional sections isolated", async () => {
  const calls: Array<[string, unknown]> = [];
  const failures: string[] = [];
  const match = {
    id: "00000000-0000-4000-8000-000000000001",
    group: {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Los del test",
    },
    discipline: "F5" as const,
    status: "STARTED" as const,
    effectivePhase: "IN_PROGRESS" as const,
    scheduledAt: new Date().toISOString(),
    durationMinutes: 60,
    capacity: 10,
    locationText: "Cancha",
    venue: null,
    court: null,
    confirmedCount: 10,
    waitlistCount: 0,
    participation: { status: "CONFIRMED" as const, waitlistPosition: null },
    result: null,
  };
  const service = new HomeService(
    {
      listForPlayer: (_id: string, limits: unknown) => {
        calls.push(["matches", limits]);
        return Promise.resolve({ current: match, upcoming: [], history: [] });
      },
    } as never,
    {
      opportunities: (_id: string, limits: unknown) => {
        calls.push(["opportunities", limits]);
        return Promise.reject(new Error("optional dependency unavailable"));
      },
    } as never,
    {
      list: (_id: string, limits: unknown) => {
        calls.push(["attention", limits]);
        return Promise.resolve({ items: [], nextCursor: null });
      },
    } as never,
    {
      getF5: () =>
        Promise.resolve({
          overall: 72,
          initialized: true,
          processedMatchCount: 8,
        }),
    } as never,
    {
      list: (_id: string, limits: unknown) => {
        calls.push(["ranking", limits]);
        return Promise.resolve({
          me: {
            ranked: true as const,
            position: 12,
            overall: "72",
            processedMatchCount: 8,
          },
        });
      },
    } as never,
  );

  const result = await service.get(
    { id: "player", displayName: "Player" },
    (area) => failures.push(area),
  );
  assert.equal(result.currentOrNextMatch?.status, "STARTED");
  assert.deepEqual(result.attention, { available: true, items: [] });
  assert.deepEqual(result.opportunities, { available: false, items: [] });
  assert.deepEqual(failures, ["opportunities"]);
  assert.equal(calls.length, 4);
  assert.deepEqual(Object.fromEntries(calls), {
    matches: { upcomingLimit: 1, historyLimit: 1 },
    attention: {
      limit: 5,
      unreadOnly: true,
      types: [
        "VOTING_AVAILABLE",
        "PROGRESSION_AVAILABLE",
        "MATCH_CANCELLED",
        "CONNECTION_REQUESTED",
        "GROUP_INVITATION_RECEIVED",
        "MATCH_INVITATION_RECEIVED",
        "GROUP_MODERATOR_GRANTED",
        "GROUP_MODERATOR_REMOVED",
      ],
    },
    opportunities: { limit: 3 },
    ranking: { limit: 1 },
  });
});
