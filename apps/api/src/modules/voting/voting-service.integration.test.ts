import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  authUser,
  groupMemberships,
  playerEvaluations,
  votingBallots,
  votingSessions,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { GroupService } from "../groups/group-service.js";
import { PlayerService } from "../identity/player-service.js";
import { MatchCompletionService } from "../matches/match-completion-service.js";
import { MatchService } from "../matches/match-service.js";
import { MatchResultService } from "../matches/match-result-service.js";
import { MatchTeamService } from "../matches/match-team-service.js";
import { VotingService } from "./voting-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;

function isConstraint(error: unknown, code: string, constraint: string) {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    if (
      "code" in current &&
      current.code === code &&
      "constraint_name" in current &&
      current.constraint_name === constraint
    )
      return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

void test(
  "Voting lifecycle, ballots and evidence against PostgreSQL",
  { skip: !safeUrl },
  async () => {
    const connection = createDatabase(safeUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const catalog = await connection.client.unsafe<
      { name: string; definition: string }[]
    >(
      "select indexname as name, indexdef as definition from pg_indexes where schemaname = 'public' and indexname in ('voting_sessions_match_uq', 'voting_ballots_session_voter_uq', 'player_evaluations_ballot_target_uq') union all select conname as name, pg_get_constraintdef(oid) as definition from pg_constraint where conname in ('player_evaluations_rating_ck', 'player_evaluations_quick_rating_ck', 'voting_sessions_window_ck')",
    );
    for (const name of [
      "voting_sessions_match_uq",
      "voting_ballots_session_voter_uq",
      "player_evaluations_ballot_target_uq",
      "player_evaluations_rating_ck",
      "player_evaluations_quick_rating_ck",
      "voting_sessions_window_ck",
    ])
      assert.ok(
        catalog.some((item) => item.name === name),
        `Missing ${name}`,
      );
    const players = new PlayerService(connection.db);
    const groups = new GroupService(connection.db);
    const matches = new MatchService(connection.db);
    const completion = new MatchCompletionService(connection.db);
    const teams = new MatchTeamService(connection.db);
    const sportingResults = new MatchResultService(connection.db);
    let now = new Date("2027-08-01T22:00:00.000Z");
    const voting = new VotingService(connection.db, () => now);

    async function player(name: string) {
      const authUserId = randomUUID();
      await connection.db
        .insert(authUser)
        .values({ id: authUserId, email: `${authUserId}@voting.test`, name });
      return players.provision(authUserId, name);
    }
    const owner = await player("Voting owner");
    const playerA = await player("Voting A");
    const playerB = await player("Voting B");
    const outsider = await player("Voting outsider");
    const group = await groups.create(owner.id, "Voting group");
    for (const member of [playerA, playerB])
      await connection.db.insert(groupMemberships).values({
        id: randomUUID(),
        groupId: group.id,
        playerId: member.id,
        role: "MEMBER",
        status: "ACTIVE",
        capabilities: [],
      });

    async function finishedRoster(
      options: { scheduledAt?: Date; confirm?: boolean } = {},
    ) {
      const match = await matches.create(owner.id, group.id, {
        discipline: "F5",
        scheduledAt:
          options.scheduledAt ?? new Date("2027-08-01T20:00:00.000Z"),
        durationMinutes: 60,
        capacity: 6,
        locationText: "Voting test",
      });
      await matches.publish(owner.id, match.id);
      const ownerPart = await matches.join(owner.id, match.id);
      const aPart = await matches.join(playerA.id, match.id);
      const bPart = await matches.join(playerB.id, match.id);
      const guest = await matches.addGuest(owner.id, match.id, "Guest Voting");
      const guestTwo = await matches.addGuest(owner.id, match.id, "Guest Two");
      const guestThree = await matches.addGuest(
        owner.id,
        match.id,
        "Guest Three",
      );
      const all = [ownerPart, aPart, bPart, guest, guestTwo, guestThree];
      await teams.replace(
        owner.id,
        match.id,
        all.map((participant, index) => ({
          participantId: participant.id,
          side: index % 2 === 0 ? ("TEAM_A" as const) : ("TEAM_B" as const),
        })),
      );
      await matches.start(owner.id, match.id);
      await completion.finish(owner.id, match.id);
      if (options.confirm !== false)
        await completion.confirmRoster(owner.id, match.id, [
          { participantId: ownerPart.id, attendance: "PLAYED" },
          { participantId: aPart.id, attendance: "PLAYED" },
          { participantId: bPart.id, attendance: "NO_SHOW" },
          { participantId: guest.id, attendance: "PLAYED" },
          { participantId: guestTwo.id, attendance: "PLAYED" },
          { participantId: guestThree.id, attendance: "PLAYED" },
        ]);
      if (options.confirm !== false) {
        await sportingResults.saveDraft(owner.id, match.id, {
          teamAGoals: 0,
          teamBGoals: 0,
          participants: [],
        });
        await sportingResults.confirm(owner.id, match.id);
      }
      return { match, ownerPart, aPart, bPart, guest, guestTwo, guestThree };
    }
    const code = (expected: string) => (error: unknown) =>
      error instanceof ApplicationError && error.code === expected;

    const noRoster = await finishedRoster({ confirm: false });
    await assert.rejects(
      () => voting.open(owner.id, noRoster.match.id),
      code("roster_not_confirmed"),
    );
    const tooEarly = await finishedRoster({
      scheduledAt: new Date("2027-08-01T21:30:00.000Z"),
    });
    await assert.rejects(
      () => voting.open(owner.id, tooEarly.match.id),
      code("voting_not_eligible_yet"),
    );
    await assert.rejects(
      () => voting.open(outsider.id, tooEarly.match.id),
      code("forbidden"),
    );

    const main = await finishedRoster();
    const opened = await Promise.all([
      voting.open(owner.id, main.match.id),
      voting.open(owner.id, main.match.id),
    ]);
    assert.equal(opened[0].id, opened[1].id);
    assert.equal(
      opened[0].closesAt.getTime() - opened[0].openedAt.getTime(),
      18 * 3_600_000,
    );
    await assert.rejects(
      () =>
        completion.confirmRoster(owner.id, main.match.id, [
          { participantId: main.ownerPart.id, attendance: "PLAYED" },
          { participantId: main.aPart.id, attendance: "PLAYED" },
          { participantId: main.bPart.id, attendance: "NO_SHOW" },
          { participantId: main.guest.id, attendance: "PLAYED" },
          { participantId: main.guestTwo.id, attendance: "PLAYED" },
          { participantId: main.guestThree.id, attendance: "PLAYED" },
        ]),
      code("invalid_final_roster"),
    );
    const state = await voting.get(owner.id, main.match.id);
    assert.deepEqual(
      state.eligibleTargets.map((target) => target.participantId),
      [main.aPart.id, main.guest.id, main.guestTwo.id, main.guestThree.id],
    );
    await assert.rejects(
      () =>
        voting.submit(playerB.id, main.match.id, {
          mode: "FULL",
          evaluations: [
            {
              targetParticipantId: main.aPart.id,
              rating: 8,
              strengths: [],
              improvements: [],
            },
          ],
        }),
      code("voter_not_eligible"),
    );
    await assert.rejects(
      () =>
        voting.submit(outsider.id, main.match.id, {
          mode: "FULL",
          evaluations: [
            {
              targetParticipantId: main.aPart.id,
              rating: 8,
              strengths: [],
              improvements: [],
            },
          ],
        }),
      code("voter_not_eligible"),
    );
    await assert.rejects(
      () =>
        voting.submit(main.guest.id, main.match.id, {
          mode: "FULL",
          evaluations: [
            {
              targetParticipantId: main.aPart.id,
              rating: 8,
              strengths: [],
              improvements: [],
            },
          ],
        }),
      code("voter_not_eligible"),
    );
    await assert.rejects(
      () => voting.myBallot(outsider.id, main.match.id),
      code("voter_not_eligible"),
    );
    await assert.rejects(
      () =>
        voting.submit(owner.id, main.match.id, {
          mode: "FULL",
          evaluations: [
            {
              targetParticipantId: main.ownerPart.id,
              rating: 8,
              strengths: [],
              improvements: [],
            },
          ],
        }),
      code("invalid_ballot"),
    );
    await assert.rejects(
      () =>
        voting.submit(owner.id, main.match.id, {
          mode: "QUICK",
          evaluations: [
            main.aPart,
            main.guest,
            main.guestTwo,
            main.guestThree,
          ].map((target) => ({
            targetParticipantId: target.id,
            rating: 4,
            quickSignal: "IMPROVEMENT" as const,
          })),
        }),
      code("invalid_ballot"),
    );
    await assert.rejects(
      () =>
        voting.submit(owner.id, main.match.id, {
          mode: "FULL",
          evaluations: [
            {
              targetParticipantId: main.bPart.id,
              rating: 8,
              strengths: [],
              improvements: [],
            },
          ],
        }),
      code("invalid_ballot"),
    );
    await assert.rejects(
      () =>
        voting.submit(owner.id, main.match.id, {
          mode: "FULL",
          evaluations: [],
        }),
      code("invalid_ballot"),
    );
    for (const invalid of [
      { rating: 4, strengths: ["PASE" as const], improvements: [] },
      { rating: 6, strengths: [], improvements: ["DEFENSA" as const] },
      { rating: 9, strengths: [], improvements: ["DEFENSA" as const] },
    ])
      await assert.rejects(
        () =>
          voting.submit(owner.id, main.match.id, {
            mode: "FULL",
            evaluations: [{ targetParticipantId: main.aPart.id, ...invalid }],
          }),
        code("invalid_ballot"),
      );
    for (const invalid of [
      { rating: 6, quickSignal: "POSITIVE" },
      { rating: 6, quickSignal: "IMPROVEMENT" },
    ] as const)
      await assert.rejects(
        () =>
          voting.submit(owner.id, main.match.id, {
            mode: "QUICK",
            evaluations: [{ targetParticipantId: main.aPart.id, ...invalid }],
          }),
        code("invalid_ballot"),
      );
    await assert.rejects(
      () =>
        voting.submit(owner.id, main.match.id, {
          mode: "QUICK",
          evaluations: [
            main.aPart,
            main.guest,
            main.guestTwo,
            main.guestThree,
          ].map((target) => ({
            targetParticipantId: target.id,
            rating: 8,
            quickSignal: "POSITIVE" as const,
          })),
        }),
      code("invalid_ballot"),
    );
    await assert.rejects(
      () =>
        voting.submit(owner.id, main.match.id, {
          mode: "QUICK",
          evaluations: [
            {
              targetParticipantId: main.aPart.id,
              rating: 8,
              quickSignal: "POSITIVE",
            },
            {
              targetParticipantId: main.aPart.id,
              rating: 4,
              quickSignal: "IMPROVEMENT",
            },
          ],
        }),
      code("invalid_ballot"),
    );

    const results = await Promise.all([
      voting.submit(owner.id, main.match.id, {
        mode: "FULL",
        evaluations: [
          {
            targetParticipantId: main.aPart.id,
            rating: 4,
            strengths: [],
            improvements: ["DEFENSA"],
          },
          {
            targetParticipantId: main.guest.id,
            rating: 9,
            strengths: ["PASE", "REGATE"],
            improvements: [],
          },
        ],
      }),
      voting.submit(playerA.id, main.match.id, {
        mode: "QUICK",
        evaluations: [
          {
            targetParticipantId: main.ownerPart.id,
            rating: 8,
            quickSignal: "POSITIVE",
          },
          {
            targetParticipantId: main.guest.id,
            rating: 3,
            quickSignal: "IMPROVEMENT",
          },
        ],
      }),
    ]);
    assert.ok(results.some((result) => result.status === "CLOSED"));
    assert.equal((await voting.get(owner.id, main.match.id)).status, "CLOSED");
    const mine = await voting.myBallot(owner.id, main.match.id);
    assert.equal(mine?.mode, "FULL");
    assert.equal(mine?.evaluations.length, 2);
    const [ownerBallot] = await connection.db
      .select({ id: votingBallots.id, sessionId: votingBallots.sessionId })
      .from(votingBallots)
      .where(eq(votingBallots.voterPlayerId, owner.id));
    await assert.rejects(
      () =>
        connection.db.insert(votingBallots).values({
          id: randomUUID(),
          sessionId: ownerBallot!.sessionId,
          voterPlayerId: owner.id,
          mode: "FULL",
          submittedAt: now,
        }),
      (error) =>
        isConstraint(error, "23505", "voting_ballots_session_voter_uq"),
    );
    await assert.rejects(
      () =>
        connection.db.insert(playerEvaluations).values({
          id: randomUUID(),
          ballotId: ownerBallot!.id,
          targetParticipantId: main.guestTwo.id,
          rating: 11,
        }),
      (error) => isConstraint(error, "23514", "player_evaluations_rating_ck"),
    );
    await assert.rejects(
      () =>
        connection.db.insert(playerEvaluations).values({
          id: randomUUID(),
          ballotId: ownerBallot!.id,
          targetParticipantId: main.aPart.id,
          rating: 8,
        }),
      (error) =>
        isConstraint(error, "23505", "player_evaluations_ballot_target_uq"),
    );

    const duplicate = await finishedRoster();
    await voting.open(owner.id, duplicate.match.id);
    const double = await Promise.allSettled([
      voting.submit(owner.id, duplicate.match.id, {
        mode: "FULL",
        evaluations: [
          {
            targetParticipantId: duplicate.aPart.id,
            rating: 6,
            strengths: [],
            improvements: [],
          },
        ],
      }),
      voting.submit(owner.id, duplicate.match.id, {
        mode: "FULL",
        evaluations: [
          {
            targetParticipantId: duplicate.aPart.id,
            rating: 6,
            strengths: [],
            improvements: [],
          },
        ],
      }),
    ]);
    assert.equal(
      double.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      double.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(
      (await voting.get(owner.id, duplicate.match.id)).status,
      "OPEN",
    );

    const deadline = await finishedRoster();
    const deadlineSession = await voting.open(owner.id, deadline.match.id);
    now = deadlineSession.closesAt;
    await assert.rejects(
      () =>
        voting.submit(owner.id, deadline.match.id, {
          mode: "FULL",
          evaluations: [
            {
              targetParticipantId: deadline.aPart.id,
              rating: 6,
              strengths: [],
              improvements: [],
            },
          ],
        }),
      code("voting_not_open"),
    );
    assert.deepEqual(
      await voting
        .get(owner.id, deadline.match.id)
        .then((value) => [value.status, value.closeReason]),
      ["CLOSED", "DEADLINE"],
    );

    const [counts] = await connection.db
      .select({
        sessions: sql<number>`(select count(*) from ${votingSessions})::int`,
        ballots: sql<number>`(select count(*) from ${votingBallots})::int`,
        evaluations: sql<number>`(select count(*) from ${playerEvaluations})::int`,
      })
      .from(votingSessions)
      .limit(1);
    assert.ok(
      counts!.sessions >= 3 && counts!.ballots >= 3 && counts!.evaluations >= 5,
    );
    const [duplicateSession] = await connection.db
      .select({ id: votingSessions.id })
      .from(votingSessions)
      .where(eq(votingSessions.matchId, duplicate.match.id));
    const duplicateRows = await connection.db
      .select({ count: sql<number>`count(*)::int` })
      .from(votingBallots)
      .where(
        and(
          eq(votingBallots.sessionId, duplicateSession!.id),
          eq(votingBallots.voterPlayerId, owner.id),
        ),
      );
    assert.equal(duplicateRows[0]?.count, 1);
    await connection.close();
  },
);
