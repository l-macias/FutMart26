import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { and, eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { notificationListQuerySchema } from "@football/contracts";
import { createDatabase } from "@football/database";
import {
  authUser,
  matchParticipants,
  matchSportingResults,
  matches,
  notifications,
  progressionConfigVersions,
  progressionSnapshots,
} from "@football/database/schema";

import { seedGroupGuest } from "../../test-support/group-guest.js";
import { ApplicationError } from "../errors.js";
import { GroupService } from "../groups/group-service.js";
import { PlayerService } from "../identity/player-service.js";
import { NotificationService } from "./notification-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;

const hasCode = (expected: string) => (error: unknown) =>
  error instanceof ApplicationError && error.code === expected;

function hasDatabaseCode(error: unknown, expected: string) {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    if ("code" in current && current.code === expected) return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

void test(
  "Notifications inbox, lazy projections and deduplication against PostgreSQL",
  { skip: !safeUrl },
  async () => {
    const connection = createDatabase(safeUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const players = new PlayerService(connection.db);
    const groups = new GroupService(connection.db);
    const now = new Date("2030-01-02T12:00:00.000Z");
    const service = new NotificationService(connection.db, () => now);

    async function player(name: string) {
      const authUserId = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@notifications.test`,
        name,
      });
      return players.provision(authUserId, name);
    }

    async function match(
      ownerId: string,
      groupId: string,
      input: {
        status: "FINISHED" | "CANCELLED";
        scheduledAt: Date;
        cancelledAt?: Date;
      },
    ) {
      const id = randomUUID();
      await connection.db.insert(matches).values({
        id,
        groupId,
        discipline: "F5",
        status: input.status,
        scheduledAt: input.scheduledAt,
        durationMinutes: 60,
        capacity: 4,
        locationText: "Notifications test",
        createdByPlayerId: ownerId,
        rosterConfirmedAt:
          input.status === "FINISHED" ? new Date(now.getTime() - 60_000) : null,
        cancelledAt: input.cancelledAt,
        cancelledByPlayerId: input.status === "CANCELLED" ? ownerId : undefined,
      });
      return id;
    }

    async function participant(
      matchId: string,
      playerId: string,
      admissionOrder: bigint,
      attendance: "PLAYED" | "NO_SHOW" | null,
      status: "CONFIRMED" | "WAITLISTED" = "CONFIRMED",
    ) {
      const id = randomUUID();
      await connection.db.insert(matchParticipants).values({
        id,
        matchId,
        kind: "PLAYER",
        playerId,
        status,
        admissionOrder,
        confirmedAt: status === "CONFIRMED" ? now : null,
        attendance,
        attendanceConfirmedAt: attendance ? now : null,
        attendanceConfirmedByPlayerId: attendance ? playerId : null,
      });
      return id;
    }

    async function guest(matchId: string, ownerId: string, order: bigint) {
      const groupGuestId = await seedGroupGuest(
        connection.db,
        matchId,
        ownerId,
        `Guest ${randomUUID()}`,
      );
      await connection.db.insert(matchParticipants).values({
        id: randomUUID(),
        matchId,
        kind: "GUEST",
        groupGuestId,
        guestDisplayName: "Invitado",
        guestCreatedByPlayerId: ownerId,
        status: "CONFIRMED",
        admissionOrder: order,
        confirmedAt: now,
        attendance: "PLAYED",
        attendanceConfirmedAt: now,
        attendanceConfirmedByPlayerId: ownerId,
      });
    }

    const owner = await player("Notification owner");
    const other = await player("Notification other");
    const group = await groups.create(owner.id, "Notification group");

    const votingMatchId = await match(owner.id, group.id, {
      status: "FINISHED",
      scheduledAt: new Date(now.getTime() - 2 * 60 * 60_000),
    });
    await participant(votingMatchId, owner.id, 1n, "PLAYED");
    await participant(votingMatchId, other.id, 2n, "NO_SHOW");
    await guest(votingMatchId, owner.id, 3n);
    const votingConfirmedAt = new Date(now.getTime() - 30 * 60_000);
    await connection.db.insert(matchSportingResults).values({
      id: randomUUID(),
      matchId: votingMatchId,
      status: "CONFIRMED",
      teamAGoals: 1,
      teamBGoals: 0,
      updatedByPlayerId: owner.id,
      confirmedAt: votingConfirmedAt,
      confirmedByPlayerId: owner.id,
    });

    const cancelledAt = new Date(now.getTime() - 20 * 60_000);
    const cancelledMatchId = await match(owner.id, group.id, {
      status: "CANCELLED",
      scheduledAt: new Date(now.getTime() + 24 * 60 * 60_000),
      cancelledAt,
    });
    await participant(cancelledMatchId, owner.id, 1n, null);
    await participant(cancelledMatchId, other.id, 2n, null, "WAITLISTED");
    await guest(cancelledMatchId, owner.id, 3n);

    const progressionMatchId = await match(owner.id, group.id, {
      status: "FINISHED",
      scheduledAt: new Date(now.getTime() - 48 * 60 * 60_000),
    });
    await participant(progressionMatchId, owner.id, 1n, "PLAYED");
    await connection.db.insert(matchSportingResults).values({
      id: randomUUID(),
      matchId: progressionMatchId,
      status: "CONFIRMED",
      teamAGoals: 0,
      teamBGoals: 0,
      updatedByPlayerId: owner.id,
      confirmedAt: new Date(now.getTime() - 24 * 60 * 60_000),
      confirmedByPlayerId: owner.id,
    });
    const [config] = await connection.db
      .select({ id: progressionConfigVersions.id })
      .from(progressionConfigVersions)
      .where(eq(progressionConfigVersions.discipline, "F5"))
      .limit(1);
    assert.ok(config);
    const zeros = {
      VELOCIDAD: "0.000000000000",
      PASE: "0.000000000000",
      REGATE: "0.000000000000",
      REMATE: "0.000000000000",
      DEFENSA: "0.000000000000",
      FISICO: "0.000000000000",
    };
    const sixties = Object.fromEntries(
      Object.keys(zeros).map((key) => [key, "60.000000000000"]),
    );
    await connection.db.insert(progressionSnapshots).values({
      id: randomUUID(),
      playerId: owner.id,
      matchId: progressionMatchId,
      discipline: "F5",
      beforeAttributes: sixties,
      afterAttributes: sixties,
      attributeDeltas: zeros,
      beforeOvr: "60.000000000000",
      afterOvr: "60.000000000000",
      ovrDelta: "0.000000000000",
      evaluationsReceived: 0,
      eligibleEvaluatorsForTarget: 0,
      aggregatedRating: null,
      participationRatio: "0.000000000000",
      confidenceMultiplier: "0.000000000000",
      rawPerformanceSignal: null,
      effectivePerformanceSignal: null,
      streakBefore: { direction: "NONE", count: 0 },
      streakAfter: { direction: "NONE", count: 0 },
      streakMultiplier: "1.000000000000",
      progressionBudget: "0.000000000000",
      baseDistribution: zeros,
      tagCoverage: "0.000000000000",
      tagDistribution: zeros,
      finalDistribution: zeros,
      configVersionId: config.id,
      processingOutcome: "NO_EVIDENCE",
      processedAt: new Date(now.getTime() - 10 * 60_000),
    });

    assert.deepEqual(notificationListQuerySchema.parse({}), { limit: 20 });
    assert.equal(notificationListQuerySchema.parse({ limit: "50" }).limit, 50);
    assert.throws(() => notificationListQuerySchema.parse({ limit: 51 }));
    assert.throws(() =>
      notificationListQuerySchema.parse({ recipientPlayerId: other.id }),
    );
    await assert.rejects(
      () => service.list(owner.id, { limit: 1, cursor: "not+a+cursor" }),
      hasCode("invalid_cursor"),
    );

    const firstProjection = await service.list(owner.id, { limit: 20 });
    assert.equal(firstProjection.items.length, 3);
    assert.deepEqual(
      new Set(firstProjection.items.map((item) => item.type)),
      new Set(["VOTING_AVAILABLE", "PROGRESSION_AVAILABLE", "MATCH_CANCELLED"]),
    );
    assert.equal((await service.unreadCount(owner.id)).count, 3);
    const otherInbox = await service.list(other.id, { limit: 20 });
    assert.deepEqual(
      otherInbox.items.map((item) => item.type),
      ["MATCH_CANCELLED"],
    );
    assert.equal((await service.unreadCount(other.id)).count, 1);
    const eventCounts = await connection.db
      .select({
        matchId: notifications.matchId,
        count: sql<number>`count(*)::int`,
      })
      .from(notifications)
      .where(
        inArray(notifications.matchId, [
          votingMatchId,
          progressionMatchId,
          cancelledMatchId,
        ]),
      )
      .groupBy(notifications.matchId);
    assert.equal(
      eventCounts.find((row) => row.matchId === votingMatchId)?.count,
      1,
    );
    assert.equal(
      eventCounts.find((row) => row.matchId === progressionMatchId)?.count,
      1,
    );
    assert.equal(
      eventCounts.find((row) => row.matchId === cancelledMatchId)?.count,
      2,
    );

    await Promise.all([
      service.reconcile(owner.id),
      service.reconcile(owner.id),
      service.reconcile(owner.id),
    ]);
    assert.equal((await service.list(owner.id, { limit: 20 })).items.length, 3);
    const [dedupCount] = await connection.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(eq(notifications.recipientPlayerId, owner.id));
    assert.equal(dedupCount?.count, 3);

    const pageOne = await service.list(owner.id, { limit: 1 });
    assert.ok(pageOne.nextCursor);
    const pageTwo = await service.list(owner.id, {
      limit: 1,
      cursor: pageOne.nextCursor,
    });
    assert.ok(pageTwo.nextCursor);
    const pageThree = await service.list(owner.id, {
      limit: 1,
      cursor: pageTwo.nextCursor,
    });
    assert.equal(pageThree.nextCursor, null);
    assert.equal(
      new Set(
        [pageOne, pageTwo, pageThree].flatMap((page) =>
          page.items.map((item) => item.id),
        ),
      ).size,
      3,
    );

    const progressionNotification = firstProjection.items.find(
      (item) => item.type === "PROGRESSION_AVAILABLE",
    );
    assert.ok(progressionNotification);
    await assert.rejects(
      () => service.markRead(other.id, progressionNotification.id),
      hasCode("notification_not_found"),
    );
    const firstRead = await service.markRead(
      owner.id,
      progressionNotification.id,
    );
    const repeatedRead = await service.markRead(
      owner.id,
      progressionNotification.id,
    );
    assert.deepEqual(repeatedRead, firstRead);
    assert.equal((await service.unreadCount(owner.id)).count, 2);

    const [stored] = await connection.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientPlayerId, owner.id),
          eq(notifications.type, "VOTING_AVAILABLE"),
        ),
      )
      .limit(1);
    assert.ok(stored);
    await assert.rejects(
      () =>
        connection.db.insert(notifications).values({
          ...stored,
          id: randomUUID(),
        }),
      (error) => hasDatabaseCode(error, "23505"),
    );

    const catalog = await connection.client.unsafe<
      { name: string; definition: string }[]
    >(
      "select indexname as name, indexdef as definition from pg_indexes where schemaname='public' and indexname in ('notifications_deduplication_key_uq','notifications_recipient_created_idx','notifications_recipient_unread_idx')",
    );
    for (const name of [
      "notifications_deduplication_key_uq",
      "notifications_recipient_created_idx",
      "notifications_recipient_unread_idx",
    ])
      assert.ok(catalog.some((row) => row.name === name));
    assert.match(
      catalog.find((row) => row.name === "notifications_recipient_unread_idx")!
        .definition,
      /read_at IS NULL/i,
    );

    console.log(
      "notifications PostgreSQL: private inbox, lazy Voting/Progression/Match projections, unread, cursor and concurrent dedup verified",
    );
    await connection.close();
  },
);
