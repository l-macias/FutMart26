import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { and, eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  authUser,
  groups,
  matchAwards,
  matchParticipants,
  matchParticipantStats,
  matches,
  notifications,
  playerAchievements,
  players,
  progressionConfigVersions,
  progressionSnapshots,
} from "@football/database/schema";

import { NotificationService } from "../notifications/notification-service.js";
import { seedGroupGuest } from "../../test-support/group-guest.js";
import { HIGH_RATING_THRESHOLD, RewardService } from "./reward-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;

void test(
  "Achievements and Match Awards project immutable sporting evidence against PostgreSQL",
  { skip: !safeUrl },
  async () => {
    const connection = createDatabase(safeUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const rewards = new RewardService(connection.db);
    const notificationsService = new NotificationService(connection.db);
    const namespace = randomUUID();

    async function player(displayName: string) {
      const authUserId = randomUUID();
      const id = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        name: displayName,
        email: `${authUserId}@rewards.test`,
      });
      await connection.db.insert(players).values({
        id,
        authUserId,
        displayName,
      });
      return { id, displayName };
    }

    const owner = await player("Rewards owner");
    const tied = await player("Rewards tied player");
    const outsider = await player("Rewards outsider");
    const groupId = randomUUID();
    await connection.db.insert(groups).values({
      id: groupId,
      name: `Rewards ${namespace}`,
      createdByPlayerId: owner.id,
    });
    const [config] = await connection.db
      .select({ id: progressionConfigVersions.id })
      .from(progressionConfigVersions)
      .where(eq(progressionConfigVersions.discipline, "F5"))
      .limit(1);
    assert.ok(config);

    const matchIds: string[] = [];
    let firstParticipantId = "";
    for (let index = 0; index < 10; index += 1) {
      const matchId = randomUUID();
      matchIds.push(matchId);
      const scheduledAt = new Date(Date.UTC(2027, 0, index + 1, 20));
      await connection.db.insert(matches).values({
        id: matchId,
        groupId,
        discipline: "F5",
        status: "FINISHED",
        scheduledAt,
        durationMinutes: 60,
        capacity: 12,
        locationText: "Rewards pitch",
        createdByPlayerId: owner.id,
        rosterLockedAt: scheduledAt,
        rosterConfirmedAt: new Date(scheduledAt.getTime() + 60 * 60_000),
        rosterConfirmedByPlayerId: owner.id,
      });
      const participantId = randomUUID();
      if (index === 0) firstParticipantId = participantId;
      await connection.db.insert(matchParticipants).values({
        id: participantId,
        matchId,
        kind: "PLAYER",
        playerId: owner.id,
        status: "CONFIRMED",
        admissionOrder: 1n,
        confirmedAt: scheduledAt,
        attendance: "PLAYED",
        attendanceConfirmedAt: scheduledAt,
        attendanceConfirmedByPlayerId: owner.id,
      });
      await connection.db.insert(matchParticipantStats).values({
        id: randomUUID(),
        matchId,
        participantId,
        goals: index === 0 ? 3 : 0,
        assists: index === 0 ? 1 : 0,
        updatedByPlayerId: owner.id,
      });
      await insertSnapshot({
        playerId: owner.id,
        matchId,
        configVersionId: config.id,
        processedAt: new Date(scheduledAt.getTime() + 24 * 60 * 60_000),
        aggregatedRating: index === 0 ? "8.500000000000" : null,
      });
    }

    const tiedParticipantId = randomUUID();
    await connection.db.insert(matchParticipants).values({
      id: tiedParticipantId,
      matchId: matchIds[0]!,
      kind: "PLAYER",
      playerId: tied.id,
      status: "CONFIRMED",
      admissionOrder: 2n,
      confirmedAt: new Date("2027-01-01T20:00:00.000Z"),
      attendance: "PLAYED",
      attendanceConfirmedAt: new Date("2027-01-01T21:00:00.000Z"),
      attendanceConfirmedByPlayerId: owner.id,
    });
    await connection.db.insert(matchParticipantStats).values({
      id: randomUUID(),
      matchId: matchIds[0]!,
      participantId: tiedParticipantId,
      goals: 3,
      assists: 1,
      updatedByPlayerId: owner.id,
    });
    await insertSnapshot({
      playerId: tied.id,
      matchId: matchIds[0]!,
      configVersionId: config.id,
      processedAt: new Date("2027-01-02T20:00:00.000Z"),
      aggregatedRating: "8.500000000000",
    });

    const noShowParticipantId = randomUUID();
    await connection.db.insert(matchParticipants).values({
      id: noShowParticipantId,
      matchId: matchIds[0]!,
      kind: "PLAYER",
      playerId: outsider.id,
      status: "CONFIRMED",
      admissionOrder: 3n,
      confirmedAt: new Date("2027-01-01T20:00:00.000Z"),
      attendance: "NO_SHOW",
      attendanceConfirmedAt: new Date("2027-01-01T21:00:00.000Z"),
      attendanceConfirmedByPlayerId: owner.id,
    });
    await connection.db.insert(matchParticipantStats).values({
      id: randomUUID(),
      matchId: matchIds[0]!,
      participantId: noShowParticipantId,
      goals: 9,
      assists: 9,
      updatedByPlayerId: owner.id,
    });

    const guestParticipantId = randomUUID();
    const groupGuestId = await seedGroupGuest(
      connection.db,
      matchIds[0]!,
      owner.id,
      "Rewards Guest",
    );
    await connection.db.insert(matchParticipants).values({
      id: guestParticipantId,
      matchId: matchIds[0]!,
      kind: "GUEST",
      groupGuestId,
      guestDisplayName: "Rewards Guest",
      guestCreatedByPlayerId: owner.id,
      status: "CONFIRMED",
      admissionOrder: 4n,
      confirmedAt: new Date("2027-01-01T20:00:00.000Z"),
      attendance: "PLAYED",
      attendanceConfirmedAt: new Date("2027-01-01T21:00:00.000Z"),
      attendanceConfirmedByPlayerId: owner.id,
    });
    await connection.db.insert(matchParticipantStats).values({
      id: randomUUID(),
      matchId: matchIds[0]!,
      participantId: guestParticipantId,
      goals: 12,
      assists: 12,
      updatedByPlayerId: owner.id,
    });

    assert.equal(HIGH_RATING_THRESHOLD, "8.000000000000");
    await Promise.all([
      rewards.reconcilePlayer(owner.id),
      rewards.reconcilePlayer(owner.id),
      rewards.reconcileActorMatch(owner.id, matchIds[0]!),
    ]);

    const response = await rewards.list(owner.id);
    assert.deepEqual(
      new Set(response.achievements.map((item) => item.type)),
      new Set([
        "FIRST_MATCH",
        "FIVE_MATCHES",
        "TEN_MATCHES",
        "FIRST_GOAL",
        "HAT_TRICK",
        "FIRST_ASSIST",
        "HIGH_RATING",
      ]),
    );
    assert.equal(response.achievements.length, 7);
    assert.equal(
      response.achievements.find((item) => item.type === "FIRST_MATCH")
        ?.sourceMatchId,
      matchIds[0],
    );
    assert.equal(
      response.achievements.find((item) => item.type === "FIVE_MATCHES")
        ?.sourceMatchId,
      matchIds[4],
    );
    assert.equal(
      response.achievements.find((item) => item.type === "TEN_MATCHES")
        ?.sourceMatchId,
      matchIds[9],
    );
    assert.equal(response.recentAwards.length, 3);
    assert.deepEqual(
      new Set(response.recentAwards.map((item) => item.type)),
      new Set(["TOP_RATED", "TOP_SCORER", "TOP_ASSIST"]),
    );

    const tiedRewards = await rewards.list(tied.id);
    assert.equal(tiedRewards.recentAwards.length, 3);
    assert.equal((await rewards.list(outsider.id)).achievements.length, 0);
    assert.equal((await rewards.list(outsider.id)).recentAwards.length, 0);

    const awardRows = await connection.db
      .select()
      .from(matchAwards)
      .where(eq(matchAwards.matchId, matchIds[0]!));
    assert.equal(awardRows.length, 6);
    assert.ok(awardRows.every((row) => row.playerId !== outsider.id));
    assert.equal(await count(connection.db, playerAchievements, owner.id), 7);
    assert.equal(await count(connection.db, matchAwards, owner.id), 3);
    assert.equal(firstParticipantId.length > 0, true);

    const matchRewards = await rewards.forMatch(owner.id, matchIds[0]!);
    assert.equal(matchRewards.achievements.length, 5);
    assert.equal(matchRewards.awards.length, 3);

    await Promise.all([
      notificationsService.list(owner.id, { limit: 50 }),
      notificationsService.list(owner.id, { limit: 50 }),
    ]);
    const rewardNotifications = await connection.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientPlayerId, owner.id),
          inArray(notifications.type, ["ACHIEVEMENT_EARNED", "AWARD_EARNED"]),
        ),
      );
    assert.equal(rewardNotifications.length, 10);
    assert.equal(
      new Set(rewardNotifications.map((row) => row.deduplicationKey)).size,
      10,
    );

    const catalog = await connection.client.unsafe<
      { name: string; definition: string }[]
    >(
      "select indexname as name, indexdef as definition from pg_indexes where schemaname='public' and indexname in ('player_achievements_player_type_uq','match_awards_match_player_type_uq','player_achievements_player_earned_idx','match_awards_player_awarded_idx')",
    );
    assert.equal(catalog.length, 4);
    assert.ok(
      catalog
        .find((row) => row.name === "player_achievements_player_type_uq")
        ?.definition.includes("UNIQUE"),
    );
    assert.ok(
      catalog
        .find((row) => row.name === "match_awards_match_player_type_uq")
        ?.definition.includes("UNIQUE"),
    );

    await connection.client.end();

    async function insertSnapshot(input: {
      playerId: string;
      matchId: string;
      configVersionId: string;
      processedAt: Date;
      aggregatedRating: string | null;
    }) {
      const zeros = attributeValues("0.000000000000");
      const sixties = attributeValues("60.000000000000");
      await connection.db.insert(progressionSnapshots).values({
        id: randomUUID(),
        playerId: input.playerId,
        matchId: input.matchId,
        discipline: "F5",
        beforeAttributes: sixties,
        afterAttributes: sixties,
        attributeDeltas: zeros,
        beforeOvr: "60.000000000000",
        afterOvr: "60.000000000000",
        ovrDelta: "0.000000000000",
        evaluationsReceived: input.aggregatedRating ? 1 : 0,
        eligibleEvaluatorsForTarget: input.aggregatedRating ? 1 : 0,
        aggregatedRating: input.aggregatedRating,
        participationRatio: input.aggregatedRating
          ? "1.000000000000"
          : "0.000000000000",
        confidenceMultiplier: input.aggregatedRating
          ? "1.200000000000"
          : "0.000000000000",
        rawPerformanceSignal: input.aggregatedRating ? "0.650000000000" : null,
        effectivePerformanceSignal: input.aggregatedRating
          ? "0.780000000000"
          : null,
        streakBefore: { direction: "NONE", count: 0 },
        streakAfter: { direction: "NONE", count: 0 },
        streakMultiplier: "1.000000000000",
        progressionBudget: "0.000000000000",
        baseDistribution: zeros,
        tagCoverage: "0.000000000000",
        tagDistribution: zeros,
        finalDistribution: zeros,
        configVersionId: input.configVersionId,
        processingOutcome: input.aggregatedRating ? "NEUTRAL" : "NO_EVIDENCE",
        processedAt: input.processedAt,
      });
    }
  },
);

function attributeValues(value: string) {
  return {
    VELOCIDAD: value,
    PASE: value,
    REGATE: value,
    REMATE: value,
    DEFENSA: value,
    FISICO: value,
  };
}

async function count(
  database: ReturnType<typeof createDatabase>["db"],
  table: typeof playerAchievements | typeof matchAwards,
  playerId: string,
) {
  const [row] = await database
    .select({ value: sql<number>`count(*)::int` })
    .from(table)
    .where(eq(table.playerId, playerId));
  return row?.value ?? 0;
}
