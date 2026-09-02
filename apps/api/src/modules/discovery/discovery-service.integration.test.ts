import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import Fastify from "fastify";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import type { FootballAuth } from "@football/auth";
import {
  featuredGroupsResponseSchema,
  featuredPlayersResponseSchema,
  globalRankingResponseSchema,
  globalSearchResponseSchema,
  risingPlayersResponseSchema,
} from "@football/contracts";
import { createDatabase } from "@football/database";
import {
  authUser,
  groupGuests,
  groups,
  matchAwards,
  matches,
  matchParticipants,
  matchParticipantStats,
  matchSportingResults,
  playerPerformances,
  players,
  progressionSnapshots,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { PublicPlayerProfileService } from "../identity/public-player-profile-service.js";
import { createDiscoveryRoutes } from "./discovery-routes.js";
import { DiscoveryService } from "./discovery-service.js";
import { GlobalRankingService } from "../rankings/global-ranking-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;

void test("Global discovery endpoints require authentication", async () => {
  const app = Fastify();
  const auth = {
    api: { getSession: () => Promise.resolve(null) },
  } as unknown as FootballAuth;
  await app.register(
    createDiscoveryRoutes(
      auth,
      {} as never,
      {} as GlobalRankingService,
      {} as DiscoveryService,
    ),
  );
  for (const url of [
    "/rankings/global/F5",
    "/discovery/players/featured",
    "/discovery/players/rising",
    "/discovery/groups/featured",
    "/search?q=lu",
  ])
    assert.equal((await app.inject(url)).statusCode, 401);
  await app.close();
});

void test(
  "Global rankings and discovery derive explicit current and temporal metrics",
  { skip: !safeUrl },
  async (context) => {
    const connection = createDatabase(safeUrl!);
    context.after(() => connection.client.end());
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const suffix = randomUUID();
    const timeSeed = Number.parseInt(
      suffix.replaceAll("-", "").slice(0, 8),
      16,
    );
    const now = new Date(
      Date.UTC(
        2200 + (timeSeed % 200),
        Math.floor(timeSeed / 200) % 12,
        1 + (Math.floor(timeSeed / 2400) % 20),
        12,
      ),
    );
    const base = Math.floor(Date.now() / 1000) + 1_000_000_000;
    const metricBase = Math.floor(Date.now() / 1000);
    const assistBase = metricBase;

    async function player(name: string, overall: number, processed: number) {
      const authUserId = randomUUID();
      const id = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@global-discovery.test`,
        name,
      });
      await connection.db.insert(players).values({
        id,
        authUserId,
        displayName: `${name} ${suffix}`,
      });
      await connection.db.insert(playerPerformances).values({
        id: randomUUID(),
        playerId: id,
        discipline: "F5",
        velocidad: "60",
        pase: "60",
        regate: "60",
        remate: "60",
        defensa: "60",
        fisico: "60",
        internalOvr: String(overall),
        processedMatchCount: processed,
      });
      return id;
    }

    const leader = await player("Leader", base + 4, 2);
    const tieMore = await player("Tie more", base + 3, 5);
    const tieLess = await player("Tie less", base + 3, 3);
    const actor = await player("Actor", base + 2, 6);
    const flat = await player("Flat", base + 1, 2);
    const boundedRising = await player("Bounded rising", 80, 3);
    const zero = await player("Zero", base + 5, 0);
    const groupA = randomUUID();
    const groupB = randomUUID();
    await connection.db.insert(groups).values([
      {
        id: groupA,
        name: `Discovery Club ${suffix}`,
        createdByPlayerId: actor,
      },
      {
        id: groupB,
        name: `Discovery United ${suffix}`,
        createdByPlayerId: leader,
      },
    ]);
    const guestId = randomUUID();
    await connection.db.insert(groupGuests).values({
      id: guestId,
      groupId: groupA,
      displayName: "Guest scorer",
      normalizedDisplayName: `guest scorer ${suffix}`,
      createdByPlayerId: actor,
    });

    async function sportingMatch(input: {
      groupId: string;
      at: Date;
      status?: "FINISHED" | "CANCELLED";
      result?: "CONFIRMED" | "NOT_PLAYED";
      players: Array<{
        id: string;
        goals?: number;
        assists?: number;
        noShow?: boolean;
      }>;
      guestGoals?: number;
    }) {
      const matchId = randomUUID();
      await connection.db.insert(matches).values({
        id: matchId,
        groupId: input.groupId,
        discipline: "F5",
        status: input.status ?? "FINISHED",
        scheduledAt: input.at,
        durationMinutes: 60,
        capacity: 12,
        locationText: "Discovery fixture",
        createdByPlayerId: actor,
      });
      let order = 1n;
      for (const entry of input.players) {
        const participantId = randomUUID();
        await connection.db.insert(matchParticipants).values({
          id: participantId,
          matchId,
          kind: "PLAYER",
          playerId: entry.id,
          status: "CONFIRMED",
          admissionOrder: order++,
          confirmedAt: input.at,
          attendance: entry.noShow ? "NO_SHOW" : "PLAYED",
          attendanceConfirmedAt: input.at,
          attendanceConfirmedByPlayerId: actor,
        });
        await connection.db.insert(matchParticipantStats).values({
          id: randomUUID(),
          matchId,
          participantId,
          goals: entry.goals ?? 0,
          assists: entry.assists ?? 0,
          updatedByPlayerId: actor,
        });
      }
      if (input.guestGoals !== undefined) {
        const participantId = randomUUID();
        await connection.db.insert(matchParticipants).values({
          id: participantId,
          matchId,
          kind: "GUEST",
          groupGuestId: guestId,
          guestDisplayName: "Guest scorer",
          guestCreatedByPlayerId: actor,
          status: "CONFIRMED",
          admissionOrder: order,
          confirmedAt: input.at,
          attendance: "PLAYED",
          attendanceConfirmedAt: input.at,
          attendanceConfirmedByPlayerId: actor,
        });
        await connection.db.insert(matchParticipantStats).values({
          id: randomUUID(),
          matchId,
          participantId,
          goals: input.guestGoals,
          assists: 0,
          updatedByPlayerId: actor,
        });
      }
      await connection.db.insert(matchSportingResults).values({
        id: randomUUID(),
        matchId,
        status: input.result ?? "CONFIRMED",
        teamAGoals: input.result === "NOT_PLAYED" ? null : 4,
        teamBGoals: input.result === "NOT_PLAYED" ? null : 3,
        updatedByPlayerId: actor,
        confirmedAt: input.at,
        confirmedByPlayerId: actor,
      });
      return matchId;
    }

    const recentOne = await sportingMatch({
      groupId: groupA,
      at: daysBefore(now, 6),
      players: [
        {
          id: actor,
          goals: Math.floor(metricBase / 2),
          assists: Math.floor(assistBase / 2),
        },
        {
          id: leader,
          goals: metricBase - 2,
          assists: Math.floor(assistBase / 2),
        },
        { id: tieMore },
        { id: flat },
      ],
      guestGoals: metricBase + 1000,
    });
    const recentTwo = await sportingMatch({
      groupId: groupA,
      at: daysBefore(now, 2),
      players: [
        {
          id: actor,
          goals: metricBase - Math.floor(metricBase / 2),
          assists: assistBase - Math.floor(assistBase / 2),
        },
        { id: tieMore, goals: 100 },
        { id: flat },
        { id: zero, goals: metricBase + 2000, noShow: true },
      ],
    });
    await sportingMatch({
      groupId: groupB,
      at: daysBefore(now, 3),
      players: [
        {
          id: leader,
          goals: 2,
          assists: assistBase - Math.floor(assistBase / 2),
        },
      ],
    });
    await sportingMatch({
      groupId: groupA,
      at: daysBefore(now, 4),
      players: [{ id: actor }],
    });
    await sportingMatch({
      groupId: groupA,
      at: daysBefore(now, 8),
      players: [{ id: tieLess, goals: metricBase }],
    });
    await sportingMatch({
      groupId: groupA,
      at: daysBefore(now, 10),
      players: [{ id: actor }],
    });
    await sportingMatch({
      groupId: groupA,
      at: daysBefore(now, 40),
      players: [
        { id: actor, goals: metricBase + 3000, assists: assistBase + 1000 },
      ],
    });
    await sportingMatch({
      groupId: groupA,
      at: daysBefore(now, 1),
      status: "CANCELLED",
      players: [{ id: actor, goals: metricBase + 3000 }],
    });
    await sportingMatch({
      groupId: groupA,
      at: daysBefore(now, 1),
      result: "NOT_PLAYED",
      players: [{ id: actor, goals: metricBase + 3000 }],
    });

    await connection.db.insert(matchAwards).values([
      {
        id: randomUUID(),
        matchId: recentOne,
        playerId: actor,
        type: "TOP_SCORER",
        awardedAt: daysBefore(now, 5),
      },
      {
        id: randomUUID(),
        matchId: recentOne,
        playerId: actor,
        type: "TOP_RATED",
        awardedAt: daysBefore(now, 5),
      },
      {
        id: randomUUID(),
        matchId: recentOne,
        playerId: actor,
        type: "TOP_ASSIST",
        awardedAt: daysBefore(now, 5),
      },
      {
        id: randomUUID(),
        matchId: recentTwo,
        playerId: tieMore,
        type: "TOP_ASSIST",
        awardedAt: daysBefore(now, 2),
      },
      {
        id: randomUUID(),
        matchId: recentTwo,
        playerId: actor,
        type: "TOP_ASSIST",
        awardedAt: daysBefore(now, 40),
      },
    ]);

    const configId = "00000000-0000-4000-8000-000000000011";
    await snapshot(
      actor,
      recentOne,
      base - 2,
      base,
      daysBefore(now, 6),
      "APPLIED",
    );
    await snapshot(
      actor,
      recentTwo,
      base,
      base + 2,
      daysBefore(now, 2),
      "APPLIED",
    );
    await snapshot(
      flat,
      recentOne,
      base + 1,
      base + 1,
      daysBefore(now, 6),
      "NO_EVIDENCE",
    );
    await snapshot(
      flat,
      recentTwo,
      base + 1,
      base + 1,
      daysBefore(now, 2),
      "NO_EVIDENCE",
    );
    await snapshot(
      boundedRising,
      recentOne,
      60,
      62,
      daysBefore(now, 6),
      "APPLIED",
    );
    await snapshot(
      boundedRising,
      recentTwo,
      62,
      64,
      daysBefore(now, 2),
      "APPLIED",
    );

    async function snapshot(
      playerId: string,
      matchId: string,
      before: number,
      after: number,
      processedAt: Date,
      outcome: "APPLIED" | "NO_EVIDENCE",
    ) {
      const attributes = {
        VELOCIDAD: "60",
        PASE: "60",
        REGATE: "60",
        REMATE: "60",
        DEFENSA: "60",
        FISICO: "60",
      };
      await connection.db.insert(progressionSnapshots).values({
        id: randomUUID(),
        playerId,
        matchId,
        discipline: "F5",
        beforeAttributes: attributes,
        afterAttributes: attributes,
        attributeDeltas: Object.fromEntries(
          Object.keys(attributes).map((key) => [key, "0"]),
        ),
        beforeOvr: String(before),
        afterOvr: String(after),
        ovrDelta: String(after - before),
        evaluationsReceived: outcome === "APPLIED" ? 2 : 0,
        eligibleEvaluatorsForTarget: 2,
        aggregatedRating: outcome === "APPLIED" ? "8" : null,
        participationRatio: outcome === "APPLIED" ? "1" : "0",
        confidenceMultiplier: outcome === "APPLIED" ? "1" : "0",
        rawPerformanceSignal: outcome === "APPLIED" ? "1" : null,
        effectivePerformanceSignal: outcome === "APPLIED" ? "1" : null,
        streakBefore: { direction: "NONE", count: 0 },
        streakAfter: { direction: "NONE", count: 0 },
        streakMultiplier: "1",
        progressionBudget: outcome === "APPLIED" ? "2" : "0",
        baseDistribution: {},
        tagCoverage: "0",
        tagDistribution: {},
        finalDistribution: {},
        configVersionId: configId,
        processingOutcome: outcome,
        processedAt,
      });
    }

    const profiles = {
      search: (actorPlayerId: string, input: { q: string; limit: number }) =>
        new PublicPlayerProfileService(
          connection.db,
          {} as never,
          {} as never,
          {} as never,
        ).search(actorPlayerId, input),
    } as PublicPlayerProfileService;
    const discovery = new DiscoveryService(connection.db, profiles, () => now);
    const ranking = new GlobalRankingService(connection.db);

    const first = globalRankingResponseSchema.parse(
      await ranking.list(actor, { limit: 2 }),
    );
    assert.deepEqual(
      first.items.map((item) => item.player.id),
      [leader, tieMore],
    );
    assert.ok(first.nextCursor);
    const second = globalRankingResponseSchema.parse(
      await ranking.list(actor, { limit: 2, cursor: first.nextCursor }),
    );
    assert.deepEqual(
      second.items.map((item) => item.player.id),
      [tieLess, actor],
    );
    assert.deepEqual(second.me, {
      ranked: true,
      position: 4,
      overall: `${base + 2}.000000000000`,
      processedMatchCount: 6,
    });
    assert.equal(
      first.items.some((item) => item.player.id === zero),
      false,
    );
    await assert.rejects(
      ranking.list(actor, { limit: 20, cursor: "invalid" }),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "invalid_cursor",
    );

    const featured = featuredPlayersResponseSchema.parse(
      await discovery.featuredPlayers("30d", 5),
    );
    assert.equal(featured.currentTopOvr[0]?.player.id, leader);
    assert.deepEqual(
      featured.topScorers
        .slice(0, 3)
        .map((entry) => [entry.player.id, entry.metric.value]),
      [
        [leader, metricBase],
        [tieLess, metricBase],
        [actor, metricBase],
      ],
    );
    assert.equal(
      featured.topScorers.some((entry) => entry.player.id === zero),
      false,
    );
    assert.deepEqual(
      featured.topAssists
        .slice(0, 2)
        .map((entry) => [entry.player.id, entry.metric.value]),
      [
        [leader, assistBase],
        [actor, assistBase],
      ],
    );
    assert.deepEqual(
      featured.mostAwarded.find((entry) => entry.player.id === actor)?.metric,
      { type: "MOST_AWARDED", value: 3 },
    );
    const featuredSeven = await discovery.featuredPlayers("7d", 10);
    assert.equal(
      featuredSeven.topScorers.some((entry) => entry.player.id === tieLess),
      false,
    );

    const rising = risingPlayersResponseSchema.parse(
      await discovery.risingPlayers("7d", 5),
    );
    assert.equal(rising.items[0]?.player.id, actor);
    assert.equal(rising.items[0]?.netOvrGain, "4.000000000000");
    assert.equal(rising.items[0]?.matchesProcessedInPeriod, 2);
    assert.deepEqual(
      rising.items.find((entry) => entry.player.id === boundedRising),
      {
        player: {
          id: boundedRising,
          displayName: `Bounded rising ${suffix}`,
        },
        currentOverall: "80.000000000000",
        startOverall: "60.000000000000",
        netOvrGain: "4.000000000000",
        matchesProcessedInPeriod: 2,
      },
    );
    assert.equal(
      rising.items.some((entry) => entry.player.id === flat),
      false,
    );

    const featuredGroups = featuredGroupsResponseSchema.parse(
      await discovery.featuredGroups("30d", 5),
    );
    assert.deepEqual(
      featuredGroups.mostActive.find((entry) => entry.group.id === groupA),
      {
        group: { id: groupA, name: `Discovery Club ${suffix}` },
        metric: { type: "MOST_ACTIVE", value: 5 },
      },
    );
    assert.equal(
      featuredGroups.mostActivePlayers.find(
        (entry) => entry.group.id === groupA,
      )?.metric.value,
      5,
    );
    assert.equal(
      featuredGroups.mostGoals.find((entry) => entry.group.id === groupA)
        ?.metric.value,
      35,
    );
    assert.deepEqual(Object.keys(featuredGroups.mostActive[0]!.group).sort(), [
      "id",
      "name",
    ]);

    const search = globalSearchResponseSchema.parse(
      await discovery.search(actor, { q: suffix.slice(0, 8), limit: 10 }),
    );
    assert.ok(search.groups.some((group) => group.id === groupA));
    assert.ok(search.players.some((entry) => entry.player.id === actor));
    assert.deepEqual(Object.keys(search.groups[0]!).sort(), ["id", "name"]);

    await connection.db
      .update(players)
      .set({ profileVisibility: "PRIVATE" })
      .where(eq(players.id, actor));
    await connection.db
      .update(groups)
      .set({ visibility: "PRIVATE" })
      .where(eq(groups.id, groupA));
    const privateGlobal = await ranking.list(actor, { limit: 20 });
    assert.equal(
      privateGlobal.items.some((item) => item.player.id === actor),
      false,
    );
    assert.deepEqual(privateGlobal.me, { ranked: false });
    const privateFeatured = await discovery.featuredPlayers("30d", 10);
    assert.equal(
      privateFeatured.topScorers.some((item) => item.player.id === actor),
      false,
    );
    const privateRising = await discovery.risingPlayers("7d", 10);
    assert.equal(
      privateRising.items.some((item) => item.player.id === actor),
      false,
    );
    const privateGroups = await discovery.featuredGroups("30d", 10);
    assert.equal(
      privateGroups.mostActive.some((item) => item.group.id === groupA),
      false,
    );
    const privateSearch = await discovery.search(actor, {
      q: suffix.slice(0, 8),
      limit: 10,
    });
    assert.equal(
      privateSearch.players.some((item) => item.player.id === actor),
      false,
    );
    assert.equal(
      privateSearch.groups.some((item) => item.id === groupA),
      false,
    );
  },
);

function daysBefore(now: Date, days: number) {
  return new Date(now.getTime() - days * 86_400_000);
}
