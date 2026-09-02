import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "@football/database";
import {
  authUser,
  groupMemberships,
  groups,
  matchAwards,
  matches,
  matchSportingResults,
  playerAchievements,
  playerPerformances,
  players,
  progressionConfigVersions,
  progressionSnapshots,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { GroupInsightsService } from "./group-insights-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;
const hasCode = (code: string) => (error: unknown) =>
  error instanceof ApplicationError && error.code === code;

void test(
  "Group Activity and Stats project existing sporting facts against PostgreSQL",
  { skip: !safeUrl },
  async () => {
    const connection = createDatabase(safeUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const insights = new GroupInsightsService(connection.db);

    async function seedPlayer(name: string) {
      const authUserId = randomUUID();
      const id = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@insights.test`,
        name,
      });
      await connection.db
        .insert(players)
        .values({ id, authUserId, displayName: name });
      return id;
    }
    async function seedPerformance(
      playerId: string,
      ovr: string,
      count: number,
    ) {
      await connection.db.insert(playerPerformances).values({
        id: randomUUID(),
        playerId,
        discipline: "F5",
        internalOvr: ovr,
        velocidad: "60",
        pase: "60",
        regate: "60",
        remate: "60",
        defensa: "60",
        fisico: "60",
        processedMatchCount: count,
      });
    }
    async function seedMatch(
      groupId: string,
      creator: string,
      status: "FINISHED" | "CANCELLED",
      scheduledAt: Date,
    ) {
      const id = randomUUID();
      await connection.db.insert(matches).values({
        id,
        groupId,
        discipline: "F5",
        status,
        scheduledAt,
        durationMinutes: 60,
        capacity: 10,
        locationText: "Cancha",
        createdByPlayerId: creator,
        ...(status === "CANCELLED"
          ? { cancelledAt: scheduledAt, cancelledByPlayerId: creator }
          : {}),
      });
      return id;
    }

    const actor = await seedPlayer("Actor");
    const member = await seedPlayer("Member");
    const unranked = await seedPlayer("Unranked");
    const inactive = await seedPlayer("Inactive");
    const outsider = await seedPlayer("Outsider");
    const groupId = randomUUID();
    await connection.db
      .insert(groups)
      .values({ id: groupId, name: "Insights", createdByPlayerId: actor });
    await connection.db.insert(groupMemberships).values([
      { id: randomUUID(), groupId, playerId: actor, role: "OWNER" },
      { id: randomUUID(), groupId, playerId: member },
      { id: randomUUID(), groupId, playerId: unranked },
      {
        id: randomUUID(),
        groupId,
        playerId: inactive,
        status: "REMOVED",
        endedAt: new Date(),
      },
    ]);
    await seedPerformance(actor, "70.000000000000", 2);
    await seedPerformance(member, "80.000000000000", 4);
    await seedPerformance(unranked, "60.000000000000", 0);
    await seedPerformance(inactive, "99.000000000000", 20);

    const emptyGroup = randomUUID();
    await connection.db
      .insert(groups)
      .values({ id: emptyGroup, name: "Empty", createdByPlayerId: outsider });
    await connection.db.insert(groupMemberships).values({
      id: randomUUID(),
      groupId: emptyGroup,
      playerId: outsider,
      role: "OWNER",
    });
    const empty = await insights.stats(outsider, emptyGroup);
    assert.equal(empty.matches.totalFinished, 0);
    assert.equal(empty.goals.averagePerPlayedMatch, null);
    assert.equal(empty.performance.averageOvr, null);
    assert.equal(empty.matches.lastPlayedAt, null);

    const base = new Date("2031-01-01T20:00:00.000Z");
    const played = await seedMatch(groupId, actor, "FINISHED", base);
    const notPlayed = await seedMatch(
      groupId,
      actor,
      "FINISHED",
      new Date(base.getTime() + 1_000),
    );
    await seedMatch(
      groupId,
      actor,
      "CANCELLED",
      new Date(base.getTime() + 2_000),
    );
    await connection.db.insert(matchSportingResults).values([
      {
        id: randomUUID(),
        matchId: played,
        status: "CONFIRMED",
        teamAGoals: 3,
        teamBGoals: 2,
        updatedByPlayerId: actor,
        confirmedAt: base,
        confirmedByPlayerId: actor,
      },
      {
        id: randomUUID(),
        matchId: notPlayed,
        status: "NOT_PLAYED",
        updatedByPlayerId: actor,
        confirmedAt: new Date(base.getTime() + 1_000),
        confirmedByPlayerId: actor,
      },
    ]);
    const [config] = await connection.db
      .select()
      .from(progressionConfigVersions)
      .limit(1);
    assert.ok(config);
    const configVersionId = config.id;
    const zeros = attributes("0.000000000000");
    const sixties = attributes("60.000000000000");
    async function snapshot(
      playerId: string,
      outcome: "APPLIED" | "NO_EVIDENCE",
      delta: string,
      processedAt: Date,
    ) {
      await connection.db.insert(progressionSnapshots).values({
        id: randomUUID(),
        playerId,
        matchId: played,
        discipline: "F5",
        beforeAttributes: sixties,
        afterAttributes: sixties,
        attributeDeltas: zeros,
        beforeOvr: "60",
        afterOvr: "60",
        ovrDelta: delta,
        evaluationsReceived: outcome === "APPLIED" ? 1 : 0,
        eligibleEvaluatorsForTarget: 1,
        aggregatedRating: outcome === "APPLIED" ? "8" : null,
        participationRatio: outcome === "APPLIED" ? "1" : "0",
        confidenceMultiplier: outcome === "APPLIED" ? "1.2" : "0",
        rawPerformanceSignal: outcome === "APPLIED" ? "0.5" : null,
        effectivePerformanceSignal: outcome === "APPLIED" ? "0.6" : null,
        streakBefore: { direction: "NONE", count: 0 },
        streakAfter: { direction: "NONE", count: 0 },
        streakMultiplier: "1",
        progressionBudget: "0",
        baseDistribution: zeros,
        tagCoverage: "0",
        tagDistribution: zeros,
        finalDistribution: zeros,
        configVersionId,
        processingOutcome: outcome,
        processedAt,
      });
    }
    await snapshot(
      actor,
      "APPLIED",
      "0.800000000000",
      new Date(base.getTime() + 5_000),
    );
    await snapshot(
      member,
      "NO_EVIDENCE",
      "0.000000000000",
      new Date(base.getTime() + 6_000),
    );
    await connection.db.insert(playerAchievements).values({
      id: randomUUID(),
      playerId: actor,
      type: "FIRST_MATCH",
      sourceMatchId: played,
      earnedAt: new Date(base.getTime() + 3_000),
    });
    const awardIds = [randomUUID(), randomUUID()];
    await connection.db.insert(matchAwards).values([
      {
        id: awardIds[0]!,
        matchId: played,
        playerId: member,
        type: "TOP_SCORER",
        awardedAt: new Date(base.getTime() + 4_000),
      },
      {
        id: awardIds[1]!,
        matchId: played,
        playerId: actor,
        type: "TOP_RATED",
        awardedAt: new Date(base.getTime() + 4_000),
      },
    ]);
    const foreignGroup = randomUUID();
    await connection.db.insert(groups).values({
      id: foreignGroup,
      name: "Foreign",
      createdByPlayerId: outsider,
    });
    const foreignMatch = await seedMatch(
      foreignGroup,
      outsider,
      "FINISHED",
      new Date(base.getTime() + 7_000),
    );
    await connection.db.insert(playerAchievements).values({
      id: randomUUID(),
      playerId: actor,
      type: "FIRST_GOAL",
      sourceMatchId: foreignMatch,
      earnedAt: new Date(base.getTime() + 7_000),
    });

    const stats = await insights.stats(actor, groupId);
    assert.deepEqual(stats.matches, {
      totalFinished: 2,
      totalCancelled: 1,
      lastPlayedAt: base.toISOString(),
    });
    assert.equal(stats.goals.total, 5);
    assert.equal(Number(stats.goals.averagePerPlayedMatch), 5);
    assert.equal(stats.participation.activePlayerCount, 3);
    assert.equal(stats.participation.rankedPlayerCount, 2);
    assert.equal(
      Number(stats.participation.averageProcessedMatchesPerRankedPlayer),
      3,
    );
    assert.equal(Number(stats.performance.averageOvr), 75);
    assert.equal(Number(stats.performance.highestOvr), 80);
    assert.equal(Number(stats.performance.lowestOvr), 70);

    const first = await insights.activity(actor, groupId, { limit: 3 });
    assert.deepEqual(
      first.items.map((event) => event.eventType),
      ["PROGRESSION_APPLIED", "AWARD_EARNED", "AWARD_EARNED"],
    );
    assert.deepEqual(
      first.items.slice(1).map((event) => event.stableId),
      awardIds
        .map((id) => `AWARD_EARNED:${id}`)
        .sort()
        .reverse(),
    );
    assert.ok(first.nextCursor);
    const second = await insights.activity(actor, groupId, {
      limit: 3,
      cursor: first.nextCursor,
    });
    assert.deepEqual(
      second.items.map((event) => event.eventType),
      ["ACHIEVEMENT_EARNED", "MATCH_CANCELLED", "MATCH_FINISHED"],
    );
    assert.equal(second.nextCursor, null);
    assert.equal(
      [...first.items, ...second.items].some(
        (event) =>
          event.eventType === "PROGRESSION_APPLIED" &&
          event.title.includes("Member"),
      ),
      false,
    );
    await assert.rejects(
      insights.activity(actor, groupId, { limit: 20, cursor: "bad" }),
      hasCode("invalid_cursor"),
    );
    await assert.rejects(
      insights.stats(outsider, groupId),
      hasCode("forbidden"),
    );
    await assert.rejects(
      insights.activity(outsider, groupId, { limit: 20 }),
      hasCode("forbidden"),
    );
    await connection.client.end();
  },
);

function attributes(value: string) {
  return {
    VELOCIDAD: value,
    PASE: value,
    REGATE: value,
    REMATE: value,
    DEFENSA: value,
    FISICO: value,
  };
}
