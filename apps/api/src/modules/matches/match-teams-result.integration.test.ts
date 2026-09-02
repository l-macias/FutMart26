import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  authUser,
  groupMemberships,
  matchSportingResults,
  matchTeamAssignments,
  playerFootballPreferences,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { GroupService } from "../groups/group-service.js";
import { PlayerService } from "../identity/player-service.js";
import { VotingService } from "../voting/voting-service.js";
import { MatchCompletionService } from "./match-completion-service.js";
import { MatchResultService } from "./match-result-service.js";
import { MatchService } from "./match-service.js";
import { MatchTeamService } from "./match-team-service.js";
import { seedGroupGuest } from "../../test-support/group-guest.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;
const code = (expected: string) => (error: unknown) =>
  error instanceof ApplicationError && error.code === expected;
const databaseConstraint = (expected: string) => (error: unknown) => {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    if ("constraint_name" in current && current.constraint_name === expected)
      return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
};

void test(
  "Match teams, deterministic proposal and sporting closure against PostgreSQL",
  { skip: !safeUrl },
  async () => {
    const connection = createDatabase(safeUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const playerService = new PlayerService(connection.db);
    const groups = new GroupService(connection.db);
    const matches = new MatchService(connection.db);
    let now = new Date("2028-03-01T21:10:00.000Z");
    const completion = new MatchCompletionService(connection.db, () => now);
    const teams = new MatchTeamService(connection.db);
    const results = new MatchResultService(connection.db, () => now);
    const voting = new VotingService(connection.db, () => now);

    async function player(name: string) {
      const authUserId = randomUUID();
      await connection.db
        .insert(authUser)
        .values({ id: authUserId, email: `${authUserId}@teams.test`, name });
      return playerService.provision(authUserId, name);
    }
    const owner = await player("Team owner");
    const members = await Promise.all(
      Array.from({ length: 10 }, (_, index) => player(`Team player ${index}`)),
    );
    const outsider = await player("Team outsider");
    const group = await groups.create(owner.id, "Team slice group");
    for (const member of members)
      await connection.db.insert(groupMemberships).values({
        id: randomUUID(),
        groupId: group.id,
        playerId: member.id,
        role: "MEMBER",
        status: "ACTIVE",
        capabilities: [],
      });

    async function openMatch(scheduledAt: Date, capacity = 10) {
      const match = await matches.create(owner.id, group.id, {
        discipline: "F5",
        scheduledAt,
        durationMinutes: 60,
        capacity,
        locationText: "Teams test",
      });
      await matches.publish(owner.id, match.id);
      return match;
    }

    const match = await openMatch(new Date("2028-03-01T20:00:00.000Z"), 10);
    await connection.db.insert(playerFootballPreferences).values({
      id: randomUUID(),
      playerId: owner.id,
      discipline: "F5",
      preferredRoles: ["PORTERO", "MEDIO"],
      willingToPlayGoalkeeper: true,
      strengths: ["PASE"],
    });
    const participants = [];
    for (const playerId of [
      owner.id,
      ...members.slice(0, 8).map((item) => item.id),
    ])
      participants.push(await matches.join(playerId, match.id));
    const guest = await matches.addGuest(
      owner.id,
      match.id,
      await seedGroupGuest(connection.db, match.id, owner.id, "Guest scorer"),
    );
    const waitlisted = await matches.join(members[9]!.id, match.id);
    assert.equal(waitlisted.status, "WAITLISTED");
    await assert.rejects(
      () =>
        results.saveDraft(owner.id, match.id, {
          teamAGoals: 0,
          teamBGoals: 0,
          participants: [],
        }),
      code("sporting_result_not_ready"),
    );

    await assert.rejects(
      () =>
        teams.replace(owner.id, match.id, [
          { participantId: waitlisted.id, side: "TEAM_A" },
        ]),
      code("invalid_team_assignment"),
    );
    await assert.rejects(
      () =>
        connection.db.insert(matchTeamAssignments).values({
          id: randomUUID(),
          matchId: match.id,
          participantId: waitlisted.id,
          side: "TEAM_A",
          source: "MANUAL",
          updatedByPlayerId: owner.id,
        }),
      databaseConstraint("match_team_assignments_confirmed_participant_ck"),
    );
    await assert.rejects(
      () => teams.replace(outsider.id, match.id, []),
      code("forbidden"),
    );
    await assert.rejects(
      () => matches.start(owner.id, match.id),
      code("incomplete_team_assignments"),
    );

    const proposal = await teams.generate(owner.id, match.id);
    assert.equal(proposal.TEAM_A.participants.length, 5);
    assert.equal(proposal.TEAM_B.participants.length, 5);
    assert.equal(proposal.source, "INTELLIGENT");
    assert.equal(proposal.diagnostics[0], "INCOMPLETE_KEEPER_COVERAGE");
    assert.equal(
      proposal.TEAM_A.participants.length + proposal.TEAM_B.participants.length,
      10,
    );
    const proposedPlayers = [
      ...proposal.TEAM_A.participants,
      ...proposal.TEAM_B.participants,
    ];
    const ownerReadModel = proposedPlayers.find(
      (participant) => participant.playerId === owner.id,
    )!;
    const guestReadModel = proposedPlayers.find(
      (participant) => participant.participantId === guest.id,
    )!;
    assert.deepEqual(ownerReadModel.preferredRoles, ["PORTERO", "MEDIO"]);
    assert.equal(ownerReadModel.willingToPlayGoalkeeper, true);
    assert.equal(Number(ownerReadModel.internalOvr), 60);
    assert.equal(guestReadModel.kind, "GUEST");
    assert.equal(guestReadModel.internalOvr, null);
    await assert.rejects(
      () =>
        connection.db.insert(matchTeamAssignments).values({
          id: randomUUID(),
          matchId: match.id,
          participantId: proposal.TEAM_A.participants[0]!.participantId,
          side: "TEAM_B",
          source: "MANUAL",
          updatedByPlayerId: owner.id,
        }),
      databaseConstraint("match_team_assignments_participant_uq"),
    );
    const manualAssignments: {
      participantId: string;
      side: "TEAM_A" | "TEAM_B";
    }[] = [
      ...proposal.TEAM_A.participants.map((item) => ({
        participantId: item.participantId,
        side: "TEAM_A" as const,
      })),
      ...proposal.TEAM_B.participants.map((item) => ({
        participantId: item.participantId,
        side: "TEAM_B" as const,
      })),
    ];
    const guestAssignment = manualAssignments.find(
      (item) => item.participantId === guest.id,
    )!;
    if (guestAssignment.side === "TEAM_B") {
      guestAssignment.side = "TEAM_A";
      manualAssignments.find(
        (item) => item.side === "TEAM_A" && item.participantId !== guest.id,
      )!.side = "TEAM_B";
    }
    const manual = await teams.replace(owner.id, match.id, manualAssignments);
    assert.equal(manual.source, "MANUAL");
    assert.ok(
      manual.TEAM_A.participants.some(
        (item) => item.participantId === guest.id,
      ) ||
        manual.TEAM_B.participants.some(
          (item) => item.participantId === guest.id,
        ),
    );

    const staleMatch = await openMatch(new Date("2028-03-02T20:00:00.000Z"), 2);
    const staleConfirmed = [
      await matches.join(owner.id, staleMatch.id),
      await matches.join(members[0]!.id, staleMatch.id),
    ];
    const promoted = await matches.join(members[1]!.id, staleMatch.id);
    assert.equal(promoted.status, "WAITLISTED");
    await teams.generate(owner.id, staleMatch.id);
    await matches.cancelParticipant(
      owner.id,
      staleMatch.id,
      staleConfirmed[1]!.id,
    );
    const staleTeams = await teams.get(owner.id, staleMatch.id);
    assert.equal(staleTeams.rosterChanged, true);
    assert.equal(staleTeams.readyToStart, false);
    await assert.rejects(
      () => matches.start(owner.id, staleMatch.id),
      code("incomplete_team_assignments"),
    );
    const regenerated = await teams.generate(owner.id, staleMatch.id);
    assert.equal(regenerated.rosterChanged, false);
    assert.equal(regenerated.readyToStart, true);

    const editVsStart = await Promise.allSettled([
      matches.start(owner.id, match.id),
      teams.replace(owner.id, match.id, manualAssignments),
    ]);
    assert.equal(
      editVsStart.filter((item) => item.status === "fulfilled").length >= 1,
      true,
    );
    const persisted = await matches.get(owner.id, match.id);
    if (persisted.status === "OPEN") await matches.start(owner.id, match.id);
    await assert.rejects(
      () => teams.replace(owner.id, match.id, manualAssignments),
      code("teams_locked"),
    );
    const lockedTeams = await teams.get(owner.id, match.id);
    assert.equal(lockedTeams.locked, true);

    await completion.finish(owner.id, match.id);
    const noShow = participants[1]!;
    await completion.confirmRoster(owner.id, match.id, [
      ...participants.map((participant) => ({
        participantId: participant.id,
        attendance:
          participant.id === noShow.id
            ? ("NO_SHOW" as const)
            : ("PLAYED" as const),
      })),
      { participantId: guest.id, attendance: "PLAYED" },
    ]);
    const sideByParticipant = new Map(
      manualAssignments.map((item) => [item.participantId, item.side]),
    );
    const played = [
      ...participants.filter((item) => item.id !== noShow.id),
      guest,
    ];
    const teamAPlayers = played.filter(
      (item) => sideByParticipant.get(item.id) === "TEAM_A",
    );
    const teamBPlayers = played.filter(
      (item) => sideByParticipant.get(item.id) === "TEAM_B",
    );
    assert.ok(teamAPlayers.length > 0 && teamBPlayers.length > 0);

    const futureDraft = await matches.create(owner.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date("2028-03-10T20:00:00.000Z"),
      durationMinutes: 60,
      capacity: 10,
      locationText: "Future draft remains allowed",
    });
    assert.equal(futureDraft.status, "DRAFT");
    await assert.rejects(
      () => matches.publish(owner.id, futureDraft.id),
      code("prior_match_sporting_closure_required"),
    );

    await completion.assignObserver(owner.id, match.id, outsider.id);
    await results.saveDraft(outsider.id, match.id, {
      teamAGoals: 3,
      teamBGoals: 1,
      participants: [
        { participantId: guest.id, goals: 1, assists: 0 },
        {
          participantId: teamAPlayers.find((item) => item.id !== guest.id)!.id,
          goals: 2,
          assists: 2,
        },
        { participantId: teamBPlayers[0]!.id, goals: 1, assists: 1 },
      ],
    });
    const confirmed = await results.confirm(owner.id, match.id);
    assert.equal(confirmed.status, "CONFIRMED");
    assert.equal(confirmed.winner, "TEAM_A");
    assert.equal(confirmed.teamAGoals, 3);
    assert.ok(played.some((item) => item.id === guest.id));
    await matches.publish(owner.id, futureDraft.id);

    await results.saveDraft(owner.id, match.id, {
      teamAGoals: 0,
      teamBGoals: 0,
      participants: [],
    });
    const draw = await results.confirm(owner.id, match.id);
    assert.equal(draw.winner, "DRAW");

    await results.saveDraft(owner.id, match.id, {
      teamAGoals: 0,
      teamBGoals: 1,
      participants: [
        { participantId: teamBPlayers[0]!.id, goals: 1, assists: 0 },
      ],
    });
    assert.equal((await results.confirm(owner.id, match.id)).winner, "TEAM_B");

    await results.saveDraft(owner.id, match.id, {
      teamAGoals: 2,
      teamBGoals: 0,
      participants: [
        { participantId: teamAPlayers[0]!.id, goals: 1, assists: 0 },
      ],
    });
    await assert.rejects(
      () => results.confirm(owner.id, match.id),
      code("invalid_sporting_result"),
    );
    assert.equal((await results.get(owner.id, match.id)).status, "DRAFT");
    await results.saveDraft(owner.id, match.id, {
      teamAGoals: 1,
      teamBGoals: 0,
      participants: [
        { participantId: teamAPlayers[0]!.id, goals: 1, assists: 2 },
      ],
    });
    await assert.rejects(
      () => results.confirm(owner.id, match.id),
      code("invalid_sporting_result"),
    );
    await assert.rejects(
      () =>
        results.saveDraft(owner.id, match.id, {
          teamAGoals: 1,
          teamBGoals: 0,
          participants: [{ participantId: noShow.id, goals: 1, assists: 0 }],
        }),
      code("invalid_sporting_result"),
    );

    await results.saveDraft(owner.id, match.id, {
      teamAGoals: 0,
      teamBGoals: 0,
      participants: [],
    });
    await results.confirm(owner.id, match.id);
    const beforeGraceBoundary = new MatchCompletionService(
      connection.db,
      () => new Date("2028-03-01T21:14:00.000Z"),
    );
    const editableClosure = await beforeGraceBoundary.getFinalRoster(
      owner.id,
      match.id,
    );
    assert.equal(editableClosure.closureEditable, true);
    assert.equal(editableClosure.votingStarted, false);
    assert.equal(editableClosure.votingStartsAt, "2028-03-01T21:15:00.000Z");
    assert.equal(
      (await beforeGraceBoundary.getFinalRoster(outsider.id, match.id))
        .closureEditable,
      false,
    );
    const afterGraceBoundary = new MatchCompletionService(
      connection.db,
      () => new Date("2028-03-01T21:16:00.000Z"),
    );
    assert.equal(
      (await afterGraceBoundary.getFinalRoster(owner.id, match.id))
        .closureEditable,
      false,
    );

    await connection.db
      .update(matchSportingResults)
      .set({ confirmedAt: new Date("2028-03-01T22:30:00.000Z") })
      .where(eq(matchSportingResults.matchId, match.id));
    const confirmedAtBoundary = await new MatchCompletionService(
      connection.db,
      () => new Date("2028-03-01T22:29:00.000Z"),
    ).getFinalRoster(owner.id, match.id);
    assert.equal(
      confirmedAtBoundary.votingStartsAt,
      "2028-03-01T22:30:00.000Z",
    );
    assert.equal(confirmedAtBoundary.closureEditable, true);
    assert.equal(
      (
        await new MatchCompletionService(
          connection.db,
          () => new Date("2028-03-01T22:31:00.000Z"),
        ).getFinalRoster(owner.id, match.id)
      ).closureEditable,
      false,
    );
    now = new Date("2028-03-01T23:00:00.000Z");
    const session = await voting.open(owner.id, match.id);
    assert.equal(session.status, "OPEN");
    await assert.rejects(
      () =>
        results.saveDraft(owner.id, match.id, {
          teamAGoals: 0,
          teamBGoals: 0,
          participants: [],
        }),
      code("sporting_result_locked"),
    );

    const raceMatch = await openMatch(new Date("2028-03-01T21:00:00.000Z"), 2);
    const raceOwner = await matches.join(owner.id, raceMatch.id);
    const raceMember = await matches.join(members[0]!.id, raceMatch.id);
    await teams.replace(owner.id, raceMatch.id, [
      { participantId: raceOwner.id, side: "TEAM_A" },
      { participantId: raceMember.id, side: "TEAM_B" },
    ]);
    await matches.start(owner.id, raceMatch.id);
    await completion.finish(owner.id, raceMatch.id);
    await completion.confirmRoster(owner.id, raceMatch.id, [
      { participantId: raceOwner.id, attendance: "PLAYED" },
      { participantId: raceMember.id, attendance: "PLAYED" },
    ]);
    await results.saveDraft(owner.id, raceMatch.id, {
      teamAGoals: 0,
      teamBGoals: 0,
      participants: [],
    });
    const confirmVsOpen = await Promise.allSettled([
      results.confirm(owner.id, raceMatch.id),
      voting.open(owner.id, raceMatch.id),
    ]);
    assert.equal(confirmVsOpen[0].status, "fulfilled");
    if (confirmVsOpen[1].status === "rejected")
      await voting.open(owner.id, raceMatch.id);
    assert.equal((await voting.get(owner.id, raceMatch.id)).status, "OPEN");

    const zeroMatch = await openMatch(new Date("2028-03-02T20:00:00.000Z"), 1);
    const zeroParticipant = await matches.join(owner.id, zeroMatch.id);
    await teams.replace(owner.id, zeroMatch.id, [
      { participantId: zeroParticipant.id, side: "TEAM_A" },
    ]);
    await matches.start(owner.id, zeroMatch.id);
    await completion.finish(owner.id, zeroMatch.id);
    await completion.confirmRoster(owner.id, zeroMatch.id, [
      { participantId: zeroParticipant.id, attendance: "NO_SHOW" },
    ]);
    const notPlayed = await results.confirm(owner.id, zeroMatch.id);
    assert.equal(notPlayed.status, "NOT_PLAYED");
    assert.equal(notPlayed.winner, null);

    const cancelledOld = await openMatch(
      new Date("2028-03-03T20:00:00.000Z"),
      10,
    );
    await matches.cancel(owner.id, cancelledOld.id);
    const afterCancelled = await matches.create(owner.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date("2028-03-04T20:00:00.000Z"),
      durationMinutes: 60,
      capacity: 10,
      locationText: "Cancelled Match does not block",
    });
    await matches.publish(owner.id, afterCancelled.id);

    const catalog = await connection.client.unsafe<{ name: string }[]>(
      "select indexname as name from pg_indexes where schemaname='public' and indexname in ('match_team_assignments_participant_uq','match_team_assignments_match_side_idx','match_sporting_results_match_uq') union all select conname as name from pg_constraint where conname in ('match_team_assignments_participant_match_fk','match_sporting_results_state_ck','match_sporting_results_scores_ck')",
    );
    for (const name of [
      "match_team_assignments_participant_uq",
      "match_team_assignments_match_side_idx",
      "match_sporting_results_match_uq",
      "match_team_assignments_participant_match_fk",
      "match_sporting_results_state_ck",
      "match_sporting_results_scores_ck",
    ])
      assert.ok(
        catalog.some((row) => row.name === name),
        `Missing ${name}`,
      );

    assert.equal(
      (
        await connection.db
          .select()
          .from(matchTeamAssignments)
          .where(eq(matchTeamAssignments.matchId, match.id))
      ).length,
      10,
    );
    assert.equal(
      (
        await connection.db
          .select()
          .from(matchSportingResults)
          .where(eq(matchSportingResults.matchId, zeroMatch.id))
      )[0]?.status,
      "NOT_PLAYED",
    );
    await connection.client.end();
  },
);
