import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  createGuestRequestSchema,
  updateStatsRequestSchema,
} from "@football/contracts";
import {
  authUser,
  groupMemberships,
  groups,
  matchParticipants,
  matchParticipantStats,
  matches,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { GroupService } from "../groups/group-service.js";
import { PlayerService } from "../identity/player-service.js";
import { MatchService } from "./match-service.js";
import { MatchCompletionService } from "./match-completion-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeTestDatabaseUrl =
  databaseUrl &&
  new URL(databaseUrl).pathname.replace(/^\//, "").endsWith("_test")
    ? databaseUrl
    : undefined;

function isDatabaseConstraint(
  error: unknown,
  code: string,
  constraintName: string,
) {
  if (typeof error !== "object" || error === null || !("cause" in error))
    return false;
  const cause = error.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === code &&
    "constraint_name" in cause &&
    cause.constraint_name === constraintName
  );
}

void test(
  "Match admission, capacity, Guests and roster lock against PostgreSQL",
  { skip: !safeTestDatabaseUrl },
  async () => {
    const connection = createDatabase(safeTestDatabaseUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const players = new PlayerService(connection.db);
    const groupService = new GroupService(connection.db);
    const service = new MatchService(connection.db);
    const completion = new MatchCompletionService(connection.db);

    async function seedPlayer(displayName: string) {
      const authUserId = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@matches.test`,
        name: displayName,
      });
      return players.provision(authUserId, displayName);
    }
    async function addMember(
      groupId: string,
      playerId: string,
      role: "MODERATOR" | "MEMBER" = "MEMBER",
      capabilities: string[] = [],
    ) {
      await connection.db.insert(groupMemberships).values({
        id: randomUUID(),
        groupId,
        playerId,
        role,
        capabilities,
      });
    }
    async function createOpenMatch(
      ownerId: string,
      groupId: string,
      capacity: number,
    ) {
      const match = await service.create(ownerId, groupId, {
        discipline: "F5",
        scheduledAt: new Date("2027-01-10T20:00:00.000Z"),
        durationMinutes: 60,
        capacity,
        locationText: "Cancha de prueba",
      });
      assert.equal(match.status, "DRAFT");
      await service.publish(ownerId, match.id);
      return match;
    }
    async function roster(matchId: string, actorId: string) {
      return service.roster(actorId, matchId);
    }
    function hasCode(code: string) {
      return (error: unknown) =>
        error instanceof ApplicationError && error.code === code;
    }

    const tableNames = await connection.client.unsafe<{ tablename: string }[]>(
      "select tablename from pg_tables where schemaname = 'public' and tablename in ('matches', 'match_participants', 'match_participant_stats') order by tablename",
    );
    assert.deepEqual(
      tableNames.map((row) => row.tablename),
      ["match_participant_stats", "match_participants", "matches"],
    );
    const indexes = await connection.client.unsafe<
      { indexname: string; indexdef: string }[]
    >(
      "select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename in ('matches', 'match_participants', 'match_participant_stats')",
    );
    const index = (name: string) =>
      indexes.find((candidate) => candidate.indexname === name)?.indexdef ?? "";
    assert.match(
      index("match_participants_active_player_uq"),
      /UNIQUE INDEX.+match_id, player_id.+WHERE.+PLAYER.+CONFIRMED.+WAITLISTED/i,
    );
    for (const name of [
      "match_participants_admission_order_uq",
      "match_participants_match_status_order_idx",
      "match_participants_player_match_idx",
      "match_participant_stats_participant_uq",
      "match_participant_stats_match_idx",
      "matches_group_scheduled_idx",
      "matches_group_status_idx",
    ])
      assert.ok(index(name), `Missing index ${name}`);
    const constraints = await connection.client.unsafe<
      { conname: string; definition: string }[]
    >(
      "select conname, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid in ('matches'::regclass, 'match_participants'::regclass, 'match_participant_stats'::regclass)",
    );
    assert.match(
      constraints.find(
        (constraint) => constraint.conname === "match_participants_identity_ck",
      )?.definition ?? "",
      /CHECK.+PLAYER.+GUEST/,
    );
    for (const name of [
      "match_participants_attendance_evidence_ck",
      "match_participant_stats_goals_ck",
      "match_participant_stats_assists_ck",
    ])
      assert.ok(
        constraints.some((constraint) => constraint.conname === name),
        `Missing constraint ${name}`,
      );
    for (const foreignKey of constraints.filter((constraint) =>
      constraint.definition.startsWith("FOREIGN KEY"),
    ))
      assert.match(foreignKey.definition, /ON DELETE RESTRICT/);

    const owner = await seedPlayer("Match owner");
    const playerA = await seedPlayer("Player A");
    const playerB = await seedPlayer("Player B");
    const playerC = await seedPlayer("Player C");
    const moderator = await seedPlayer("Match moderator");
    const external = await seedPlayer("External");
    const group = await groupService.create(owner.id, "Match slice group");
    await addMember(group.id, playerA.id);
    await addMember(group.id, playerB.id);
    await addMember(group.id, playerC.id);
    await addMember(group.id, moderator.id, "MODERATOR", [
      "MATCH_MANAGE",
      "MATCH_MANAGE_GUESTS",
      "MATCH_COMPLETE",
      "MATCH_CONFIRM_ROSTER",
      "MATCH_MANAGE_STATS",
      "MATCH_MANAGE_OBSERVER",
    ]);
    assert.equal(createGuestRequestSchema.safeParse({}).success, false);
    assert.equal(
      createGuestRequestSchema.safeParse({ displayName: "   " }).success,
      false,
    );
    assert.deepEqual(
      createGuestRequestSchema.parse({ displayName: "  Diego  " }),
      { displayName: "Diego" },
    );
    assert.equal(
      updateStatsRequestSchema.safeParse({
        participants: [{ participantId: randomUUID(), goals: -1, assists: 0 }],
      }).success,
      false,
    );
    assert.equal(
      updateStatsRequestSchema.safeParse({
        participants: [{ participantId: randomUUID(), goals: 1.5, assists: 0 }],
      }).success,
      false,
    );

    const draft = await service.create(owner.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date("2027-01-01T20:00:00.000Z"),
      durationMinutes: 60,
      capacity: 1,
      locationText: "Rosario",
    });
    assert.equal(draft.discipline, "F5");
    const moderatorDraft = await service.create(moderator.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date("2027-01-02T20:00:00.000Z"),
      durationMinutes: 60,
      capacity: 10,
      locationText: "Rosario",
    });
    await service.publish(moderator.id, moderatorDraft.id);
    const moderatorGuest = await service.addGuest(
      moderator.id,
      moderatorDraft.id,
      "Guest by moderator",
    );
    assert.equal(moderatorGuest.status, "CONFIRMED");
    await assert.rejects(
      () =>
        service.create(playerA.id, group.id, {
          discipline: "F5",
          scheduledAt: new Date(),
          durationMinutes: 60,
          capacity: 10,
          locationText: "Rosario",
        }),
      hasCode("forbidden"),
    );
    await assert.rejects(
      () => service.get(external.id, draft.id),
      hasCode("forbidden"),
    );
    const archivedGroup = await groupService.create(owner.id, "Archived");
    await connection.db
      .update(groups)
      .set({ status: "ARCHIVED" })
      .where(eq(groups.id, archivedGroup.id));
    await assert.rejects(
      () =>
        service.create(owner.id, archivedGroup.id, {
          discipline: "F5",
          scheduledAt: new Date(),
          durationMinutes: 60,
          capacity: 10,
          locationText: "Rosario",
        }),
      hasCode("group_archived"),
    );

    await service.publish(owner.id, draft.id);
    await assert.rejects(
      () =>
        connection.db.insert(matchParticipants).values({
          id: randomUUID(),
          matchId: draft.id,
          kind: "PLAYER",
          playerId: playerC.id,
          guestDisplayName: "Invalid Player name",
          status: "WAITLISTED",
          admissionOrder: 1000n,
        }),
      (error) =>
        isDatabaseConstraint(error, "23514", "match_participants_identity_ck"),
    );
    await assert.rejects(
      () =>
        connection.db.insert(matchParticipants).values({
          id: randomUUID(),
          matchId: draft.id,
          kind: "GUEST",
          guestDisplayName: "   ",
          guestCreatedByPlayerId: owner.id,
          status: "WAITLISTED",
          admissionOrder: 1002n,
        }),
      (error) =>
        isDatabaseConstraint(error, "23514", "match_participants_identity_ck"),
    );
    await assert.rejects(
      () =>
        connection.db.insert(matchParticipants).values({
          id: randomUUID(),
          matchId: draft.id,
          kind: "GUEST",
          guestCreatedByPlayerId: owner.id,
          status: "WAITLISTED",
          admissionOrder: 1001n,
        }),
      (error) =>
        isDatabaseConstraint(error, "23514", "match_participants_identity_ck"),
    );
    const lastSpot = await Promise.all([
      service.join(playerA.id, draft.id),
      service.join(playerB.id, draft.id),
    ]);
    assert.equal(
      lastSpot.filter((participation) => participation.status === "CONFIRMED")
        .length,
      1,
    );
    assert.equal(
      lastSpot.filter((participation) => participation.status === "WAITLISTED")
        .length,
      1,
    );
    const activeRoster = await roster(draft.id, owner.id);
    assert.equal(activeRoster.confirmedCount, 1);
    assert.equal(activeRoster.waitlistCount, 1);
    const confirmedPlayerId = activeRoster.confirmed[0]?.playerId;
    const waitlistedPlayerId = activeRoster.waitlist[0]?.playerId;
    assert.ok(confirmedPlayerId);
    assert.ok(waitlistedPlayerId);
    const duplicate = await service.join(waitlistedPlayerId, draft.id);
    assert.equal(duplicate.id, activeRoster.waitlist[0]?.id);
    await assert.rejects(
      () =>
        connection.db.insert(matchParticipants).values({
          id: randomUUID(),
          matchId: draft.id,
          kind: "PLAYER",
          playerId: waitlistedPlayerId,
          status: "WAITLISTED",
          admissionOrder: 999n,
        }),
      (error) =>
        isDatabaseConstraint(
          error,
          "23505",
          "match_participants_active_player_uq",
        ),
    );
    await service.leave(confirmedPlayerId, draft.id);
    const promotedRoster = await roster(draft.id, owner.id);
    assert.equal(promotedRoster.confirmed[0]?.playerId, waitlistedPlayerId);
    assert.equal(promotedRoster.waitlistCount, 0);

    const orderMatch = await createOpenMatch(owner.id, group.id, 1);
    await service.join(owner.id, orderMatch.id);
    const cancelledFirstAttempt = await service.join(playerA.id, orderMatch.id);
    const guestAhead = await service.addGuest(owner.id, orderMatch.id, "Diego");
    await service.join(playerB.id, orderMatch.id);
    await service.leave(playerA.id, orderMatch.id);
    const rejoined = await service.join(playerA.id, orderMatch.id);
    assert.notEqual(rejoined.id, cancelledFirstAttempt.id);
    const [historicalAttempt] = await connection.db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.id, cancelledFirstAttempt.id));
    assert.equal(historicalAttempt?.status, "CANCELLED");
    assert.ok(historicalAttempt?.cancelledAt);
    const ordered = await roster(orderMatch.id, owner.id);
    assert.deepEqual(
      ordered.waitlist.map((participant) =>
        participant.kind === "GUEST"
          ? participant.displayName
          : participant.playerId,
      ),
      ["Diego", playerB.id, playerA.id],
    );
    assert.equal(guestAhead.status, "WAITLISTED");

    const guestPromotion = await createOpenMatch(owner.id, group.id, 1);
    await service.join(owner.id, guestPromotion.id);
    const guest = await service.addGuest(owner.id, guestPromotion.id, "Pablo");
    await service.join(playerA.id, guestPromotion.id);
    await service.leave(owner.id, guestPromotion.id);
    let guestRoster = await roster(guestPromotion.id, playerA.id);
    assert.equal(guestRoster.confirmed[0]?.id, guest.id);
    await service.cancelGuest(owner.id, guestPromotion.id, guest.id);
    guestRoster = await roster(guestPromotion.id, playerA.id);
    assert.equal(guestRoster.confirmed[0]?.playerId, playerA.id);

    const capacityMatch = await createOpenMatch(owner.id, group.id, 1);
    await service.join(owner.id, capacityMatch.id);
    await service.join(playerA.id, capacityMatch.id);
    await service.join(playerB.id, capacityMatch.id);
    await service.update(owner.id, capacityMatch.id, { capacity: 3 });
    const expanded = await roster(capacityMatch.id, owner.id);
    assert.equal(expanded.confirmedCount, 3);
    assert.equal(expanded.waitlistCount, 0);
    await assert.rejects(
      () => service.update(owner.id, capacityMatch.id, { capacity: 2 }),
      hasCode("capacity_below_confirmed"),
    );
    await assert.rejects(
      () => service.update(owner.id, capacityMatch.id, { capacity: 0 }),
      hasCode("invalid_capacity"),
    );
    const rescheduledAt = new Date("2027-02-01T21:00:00.000Z");
    await service.update(owner.id, capacityMatch.id, {
      scheduledAt: rescheduledAt,
    });
    const afterReschedule = await roster(capacityMatch.id, owner.id);
    assert.equal(afterReschedule.confirmedCount, 3);

    const guestPlayerRace = await createOpenMatch(owner.id, group.id, 1);
    const admissionRace = await Promise.all([
      service.addGuest(owner.id, guestPlayerRace.id, "Race guest"),
      service.join(playerA.id, guestPlayerRace.id),
    ]);
    assert.equal(
      admissionRace.filter((participant) => participant.status === "CONFIRMED")
        .length,
      1,
    );
    assert.equal(
      admissionRace.filter((participant) => participant.status === "WAITLISTED")
        .length,
      1,
    );

    const cancellationRace = await createOpenMatch(owner.id, group.id, 1);
    await service.join(owner.id, cancellationRace.id);
    await service.join(playerA.id, cancellationRace.id);
    const cancellationResults = await Promise.allSettled([
      service.leave(owner.id, cancellationRace.id),
      service.leave(owner.id, cancellationRace.id),
    ]);
    assert.equal(
      cancellationResults.filter((result) => result.status === "fulfilled")
        .length,
      1,
    );
    const afterDoubleLeave = await roster(cancellationRace.id, playerA.id);
    assert.equal(afterDoubleLeave.confirmedCount, 1);
    assert.equal(afterDoubleLeave.confirmed[0]?.playerId, playerA.id);

    const joinDuringLeave = await createOpenMatch(owner.id, group.id, 1);
    await service.join(owner.id, joinDuringLeave.id);
    await service.join(playerA.id, joinDuringLeave.id);
    await Promise.all([
      service.leave(owner.id, joinDuringLeave.id),
      service.join(playerB.id, joinDuringLeave.id),
    ]);
    const coherentRace = await roster(joinDuringLeave.id, playerA.id);
    assert.equal(coherentRace.confirmedCount, 1);
    assert.equal(coherentRace.confirmed[0]?.playerId, playerA.id);
    assert.equal(coherentRace.waitlist[0]?.playerId, playerB.id);

    const locked = await createOpenMatch(owner.id, group.id, 10);
    await service.join(playerA.id, locked.id);
    await service.start(owner.id, locked.id);
    await assert.rejects(
      () => service.join(playerB.id, locked.id),
      hasCode("roster_locked"),
    );
    await assert.rejects(
      () => service.addGuest(owner.id, locked.id, "Late guest"),
      hasCode("roster_locked"),
    );

    const cancelled = await createOpenMatch(owner.id, group.id, 2);
    await service.join(playerA.id, cancelled.id);
    await service.addGuest(owner.id, cancelled.id, "Preserved guest");
    await service.cancel(owner.id, cancelled.id);
    const preserved = await connection.db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, cancelled.id));
    assert.equal(preserved.length, 2);
    await assert.rejects(
      () => service.join(playerB.id, cancelled.id),
      hasCode("match_not_open"),
    );

    const [persistedLocked] = await connection.db
      .select()
      .from(matches)
      .where(eq(matches.id, locked.id));
    assert.equal(persistedLocked?.status, "STARTED");
    assert.ok(persistedLocked?.rosterLockedAt);

    const draftForFinish = await service.create(owner.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date("2027-03-01T20:00:00.000Z"),
      durationMinutes: 60,
      capacity: 2,
      locationText: "Rosario",
    });
    await assert.rejects(
      () => completion.finish(owner.id, draftForFinish.id),
      hasCode("invalid_match_transition"),
    );
    const openForFinish = await createOpenMatch(owner.id, group.id, 2);
    await assert.rejects(
      () => completion.finish(owner.id, openForFinish.id),
      hasCode("invalid_match_transition"),
    );

    const completed = await createOpenMatch(owner.id, group.id, 3);
    const ownerParticipation = await service.join(owner.id, completed.id);
    const playerParticipation = await service.join(playerA.id, completed.id);
    const playedGuest = await service.addGuest(
      owner.id,
      completed.id,
      "Final guest",
    );
    const waitlisted = await service.join(playerB.id, completed.id);
    await assert.rejects(
      () => completion.assignObserver(owner.id, completed.id, playedGuest.id),
      hasCode("player_not_found"),
    );
    await assert.rejects(
      () => completion.assignObserver(playerA.id, completed.id, external.id),
      hasCode("forbidden"),
    );
    await completion.assignObserver(moderator.id, completed.id, external.id);
    await service.start(owner.id, completed.id);
    await Promise.all([
      completion.finish(owner.id, completed.id),
      completion.finish(moderator.id, completed.id),
    ]);
    const finalRoster = [
      { participantId: ownerParticipation.id, attendance: "PLAYED" as const },
      { participantId: playerParticipation.id, attendance: "NO_SHOW" as const },
      { participantId: playedGuest.id, attendance: "PLAYED" as const },
    ];
    await assert.rejects(
      () =>
        completion.confirmRoster(
          owner.id,
          completed.id,
          finalRoster.slice(0, 2),
        ),
      hasCode("invalid_final_roster"),
    );
    await assert.rejects(
      () =>
        completion.confirmRoster(owner.id, completed.id, [
          ...finalRoster,
          { participantId: waitlisted.id, attendance: "PLAYED" },
        ]),
      hasCode("invalid_final_roster"),
    );
    await assert.rejects(
      () =>
        completion.confirmRoster(owner.id, completed.id, [
          finalRoster[0]!,
          finalRoster[0]!,
          finalRoster[2]!,
        ]),
      hasCode("invalid_final_roster"),
    );
    await Promise.all([
      completion.confirmRoster(owner.id, completed.id, finalRoster),
      completion.confirmRoster(owner.id, completed.id, [
        finalRoster[0]!,
        { participantId: playerParticipation.id, attendance: "PLAYED" },
        finalRoster[2]!,
      ]),
    ]);
    await completion.confirmRoster(owner.id, completed.id, finalRoster);

    const observerRoster = await completion.getFinalRoster(
      external.id,
      completed.id,
    );
    assert.equal(observerRoster.participants.length, 3);

    await completion.updateStats(external.id, completed.id, [
      { participantId: ownerParticipation.id, goals: 2, assists: 1 },
      { participantId: playedGuest.id, goals: 1, assists: 0 },
    ]);
    assert.equal(
      (await completion.getStats(external.id, completed.id)).length,
      2,
    );
    await assert.rejects(
      () =>
        completion.updateStats(owner.id, completed.id, [
          { participantId: playerParticipation.id, goals: 1, assists: 0 },
        ]),
      hasCode("stats_not_allowed"),
    );
    await assert.rejects(
      () => completion.updateStats(playerA.id, completed.id, []),
      hasCode("forbidden"),
    );
    await assert.rejects(
      () =>
        connection.db.insert(matchParticipantStats).values({
          id: randomUUID(),
          matchId: completed.id,
          participantId: playerParticipation.id,
          goals: -1,
          assists: 0,
          updatedByPlayerId: owner.id,
        }),
      (error) =>
        isDatabaseConstraint(
          error,
          "23514",
          "match_participant_stats_goals_ck",
        ),
    );
    const eligibility = await completion.eligibility(owner.id, completed.id);
    assert.equal(eligibility.observer?.canVote, false);
    const ownerEligibility = eligibility.participants.find(
      (participant) => participant.participantId === ownerParticipation.id,
    );
    const noShowEligibility = eligibility.participants.find(
      (participant) => participant.participantId === playerParticipation.id,
    );
    const guestEligibility = eligibility.participants.find(
      (participant) => participant.participantId === playedGuest.id,
    );
    assert.deepEqual(
      [ownerEligibility?.canVote, ownerEligibility?.canBeEvaluated],
      [true, true],
    );
    assert.deepEqual(
      [noShowEligibility?.canVote, noShowEligibility?.canBeEvaluated],
      [false, false],
    );
    assert.deepEqual(
      [guestEligibility?.canVote, guestEligibility?.canBeEvaluated],
      [false, true],
    );
    await completion.assignObserver(owner.id, completed.id, owner.id);
    const participantObserverEligibility = await completion.eligibility(
      owner.id,
      completed.id,
    );
    assert.equal(
      participantObserverEligibility.participants.find(
        (participant) => participant.participantId === ownerParticipation.id,
      )?.canVote,
      true,
    );
    await completion.removeObserver(owner.id, completed.id);
    const [observerRemoved] = await connection.db
      .select()
      .from(matches)
      .where(eq(matches.id, completed.id));
    assert.equal(observerRemoved?.observerPlayerId, null);
    const overCapacity = await connection.db
      .select({ count: sql<number>`count(*)::int` })
      .from(matchParticipants)
      .where(
        and(
          eq(matchParticipants.matchId, guestPlayerRace.id),
          eq(matchParticipants.status, "CONFIRMED"),
        ),
      );
    assert.equal(overCapacity[0]?.count, 1);

    console.log(
      `match concurrency: player/player=1 confirmed; guest/player=1 confirmed; double-leave promotions=1`,
    );
    await connection.close();
  },
);
