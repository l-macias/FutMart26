import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import { progressionHistoryQuerySchema } from "@football/contracts";
import {
  authUser,
  groupMemberships,
  playerPerformances,
  progressionConfigVersions,
  progressionSnapshots,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { GroupService } from "../groups/group-service.js";
import { PlayerService } from "../identity/player-service.js";
import { MatchCompletionService } from "../matches/match-completion-service.js";
import { MatchService } from "../matches/match-service.js";
import { MatchResultService } from "../matches/match-result-service.js";
import { MatchTeamService } from "../matches/match-team-service.js";
import { VotingService } from "../voting/voting-service.js";
import { RewardService } from "../rewards/reward-service.js";
import { seedGroupGuest } from "../../test-support/group-guest.js";
import {
  PROGRESSION_V1_1_CONFIG,
  PROGRESSION_V1_1_VERSION,
  progressionConfigSchema,
} from "./progression-config.js";
import { ProgressionService } from "./progression-service.js";
import { ProgressionHistoryService } from "./progression-history-service.js";
import { ProgressionRevealService } from "./progression-reveal-service.js";

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
  "Player Performance processing, ordering and concurrency against PostgreSQL",
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
    const matchService = new MatchService(connection.db);
    let now = new Date("2028-01-01T12:00:00.000Z");
    const completion = new MatchCompletionService(connection.db, () => now);
    const teams = new MatchTeamService(connection.db);
    const results = new MatchResultService(connection.db, () => now);
    const voting = new VotingService(connection.db, () => now);
    const progression = new ProgressionService(connection.db, () => now);
    const rewards = new RewardService(connection.db);
    const history = new ProgressionHistoryService(connection.db);
    const reveals = new ProgressionRevealService(
      connection.db,
      progression,
      rewards,
      () => now,
    );

    const [configRow] = await connection.db
      .select()
      .from(progressionConfigVersions)
      .where(eq(progressionConfigVersions.version, PROGRESSION_V1_1_VERSION));
    assert.ok(configRow);
    assert.deepEqual(
      progressionConfigSchema.parse(configRow.document),
      PROGRESSION_V1_1_CONFIG,
    );

    const catalog = await connection.client.unsafe<
      { name: string; definition: string }[]
    >(
      "select indexname as name, indexdef as definition from pg_indexes where schemaname='public' and indexname in ('player_performances_player_discipline_uq','progression_snapshots_player_match_discipline_uq','progression_config_versions_discipline_version_uq') union all select conname as name, pg_get_constraintdef(oid) as definition from pg_constraint where conname in ('player_performances_attributes_range_ck','player_performances_streak_ck','progression_snapshots_counts_ck')",
    );
    for (const name of [
      "player_performances_player_discipline_uq",
      "progression_snapshots_player_match_discipline_uq",
      "progression_config_versions_discipline_version_uq",
      "player_performances_attributes_range_ck",
      "player_performances_streak_ck",
      "progression_snapshots_counts_ck",
    ])
      assert.ok(
        catalog.some((row) => row.name === name),
        `Missing ${name}`,
      );

    async function player(name: string) {
      const authUserId = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@progression.test`,
        name,
      });
      return playerService.provision(authUserId, name);
    }

    async function groupWithMembers(prefix: string, count: number) {
      const owner = await player(`${prefix} owner`);
      const members = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          player(`${prefix} member ${index}`),
        ),
      );
      const group = await groups.create(owner.id, `${prefix} group`);
      for (const member of members)
        await connection.db.insert(groupMemberships).values({
          id: randomUUID(),
          groupId: group.id,
          playerId: member.id,
          status: "ACTIVE",
          role: "MEMBER",
          capabilities: [],
        });
      return { owner, members, group };
    }

    async function completedMatch(
      ownerId: string,
      groupId: string,
      playerIds: string[],
      scheduledAt: Date,
      options: { noShowId?: string; guest?: boolean } = {},
    ) {
      const match = await matchService.create(ownerId, groupId, {
        discipline: "F5",
        scheduledAt,
        durationMinutes: 60,
        capacity: playerIds.length + (options.guest ? 1 : 0),
        locationText: "Progression test",
      });
      await matchService.publish(ownerId, match.id);
      const participants = [];
      for (const playerId of playerIds)
        participants.push(await matchService.join(playerId, match.id));
      const guest = options.guest
        ? await matchService.addGuest(
            ownerId,
            match.id,
            await seedGroupGuest(
              connection.db,
              match.id,
              ownerId,
              "Progression Guest",
            ),
          )
        : null;
      const allParticipants = [...participants, ...(guest ? [guest] : [])];
      await teams.replace(
        ownerId,
        match.id,
        allParticipants.map((participant, index) => ({
          participantId: participant.id,
          side: index % 2 === 0 ? ("TEAM_A" as const) : ("TEAM_B" as const),
        })),
      );
      await matchService.start(ownerId, match.id);
      await completion.finish(ownerId, match.id);
      await completion.confirmRoster(ownerId, match.id, [
        ...participants.map((participant) => ({
          participantId: participant.id,
          attendance:
            participant.playerId === options.noShowId
              ? ("NO_SHOW" as const)
              : ("PLAYED" as const),
        })),
        ...(guest
          ? [{ participantId: guest.id, attendance: "PLAYED" as const }]
          : []),
      ]);
      await results.saveDraft(ownerId, match.id, {
        teamAGoals: 0,
        teamBGoals: 0,
        participants: [],
      });
      await results.confirm(ownerId, match.id);
      return { match, participants, guest };
    }

    // OPEN is rejected; deadline closure is accepted. Only PLAYED Players persist.
    const base = await groupWithMembers("base", 3);
    const baseMatch = await completedMatch(
      base.owner.id,
      base.group.id,
      [base.owner.id, base.members[0]!.id, base.members[1]!.id],
      new Date("2027-01-01T10:00:00.000Z"),
      { noShowId: base.members[1]!.id, guest: true },
    );
    await completion.assignObserver(
      base.owner.id,
      baseMatch.match.id,
      base.members[2]!.id,
    );
    const baseSession = await voting.open(base.owner.id, baseMatch.match.id);
    assert.equal(
      (await reveals.get(base.owner.id, baseMatch.match.id)).status,
      "VOTING_OPEN",
    );
    await assert.rejects(
      () => reveals.get(base.members[1]!.id, baseMatch.match.id),
      hasCode("forbidden"),
    );
    await assert.rejects(
      () => reveals.get(base.members[2]!.id, baseMatch.match.id),
      hasCode("forbidden"),
    );
    await assert.rejects(
      () => reveals.get(baseMatch.guest!.id, baseMatch.match.id),
      hasCode("forbidden"),
    );
    await assert.rejects(
      () => progression.processMatch(baseMatch.match.id),
      hasCode("progression_not_ready"),
    );
    now = baseSession.closesAt;
    const baseSnapshots = await progression.processMatch(baseMatch.match.id);
    assert.equal(baseSnapshots.length, 2);
    assert.ok(
      baseSnapshots.every(
        (snapshot) => snapshot.processingOutcome === "NO_EVIDENCE",
      ),
    );
    assert.deepEqual(
      new Set(baseSnapshots.map((snapshot) => snapshot.playerId)),
      new Set([base.owner.id, base.members[0]!.id]),
    );
    const basePerformances = await connection.db
      .select()
      .from(playerPerformances)
      .where(eq(playerPerformances.discipline, "F5"));
    const ownerPerformance = basePerformances.find(
      (row) => row.playerId === base.owner.id,
    );
    assert.equal(ownerPerformance?.internalOvr, "60.000000000000");
    assert.equal(ownerPerformance?.processedMatchCount, 1);
    const noEvidenceReveal = await reveals.get(
      base.owner.id,
      baseMatch.match.id,
    );
    assert.equal(noEvidenceReveal.status, "AVAILABLE");
    if (noEvidenceReveal.status === "AVAILABLE") {
      assert.equal(noEvidenceReveal.snapshot.processingOutcome, "NO_EVIDENCE");
      assert.equal(
        noEvidenceReveal.snapshot.overall.before,
        noEvidenceReveal.snapshot.overall.after,
      );
      assert.equal(noEvidenceReveal.snapshot.aggregatedRating, null);
    }
    const noEvidenceHistory = await history.list(base.owner.id, { limit: 20 });
    assert.equal(noEvidenceHistory.items.length, 1);
    assert.equal(
      noEvidenceHistory.items[0]?.snapshot.processingOutcome,
      "NO_EVIDENCE",
    );
    assert.equal(noEvidenceHistory.items[0]?.snapshot.aggregatedRating, null);
    assert.equal(noEvidenceHistory.items[0]?.context.group.id, base.group.id);
    assert.deepEqual(noEvidenceHistory.items[0]?.context.result, {
      teamAGoals: 0,
      teamBGoals: 0,
      winner: "DRAW",
    });
    assert.equal(
      (await history.list(base.members[1]!.id, { limit: 20 })).items.length,
      0,
    );
    const alreadyMaterialized = await Promise.all([
      reveals.materialize(base.owner.id, baseMatch.match.id),
      reveals.materialize(base.owner.id, baseMatch.match.id),
    ]);
    assert.ok(alreadyMaterialized.every((item) => item.status === "AVAILABLE"));
    assert.ok(
      alreadyMaterialized.every(
        (item) =>
          item.status === "AVAILABLE" &&
          item.rewards.achievements.some(
            (achievement) => achievement.type === "FIRST_MATCH",
          ),
      ),
    );
    assert.equal(
      basePerformances.some((row) => row.playerId === base.members[1]!.id),
      false,
    );
    assert.equal(
      basePerformances.some((row) => row.playerId === base.members[2]!.id),
      false,
    );

    // Valid ballots close early and use the same raw numeric semantics.
    now = new Date("2028-03-01T12:00:00.000Z");
    const votedMatch = await completedMatch(
      base.owner.id,
      base.group.id,
      [base.owner.id, base.members[0]!.id],
      new Date("2027-02-01T10:00:00.000Z"),
    );
    await voting.open(base.owner.id, votedMatch.match.id);
    await voting.submit(base.owner.id, votedMatch.match.id, {
      mode: "FULL",
      evaluations: [
        {
          targetParticipantId: votedMatch.participants[1]!.id,
          rating: 9,
          strengths: ["REMATE", "REGATE"],
          improvements: [],
        },
      ],
    });
    await voting.submit(base.members[0]!.id, votedMatch.match.id, {
      mode: "QUICK",
      evaluations: [
        {
          targetParticipantId: votedMatch.participants[0]!.id,
          rating: 9,
          quickSignal: "POSITIVE",
        },
      ],
    });
    const concurrentSame = await Promise.all([
      progression.processMatch(votedMatch.match.id),
      progression.processMatch(votedMatch.match.id),
    ]);
    assert.equal(concurrentSame[0].length, 2);
    assert.equal(concurrentSame[1].length, 2);
    const votedRows = await connection.db
      .select()
      .from(progressionSnapshots)
      .where(eq(progressionSnapshots.matchId, votedMatch.match.id));
    assert.equal(votedRows.length, 2);
    assert.ok(votedRows.every((row) => row.configVersionId === configRow.id));
    assert.ok(
      votedRows.every((row) => row.aggregatedRating === "9.000000000000"),
    );
    assert.equal(
      (await progression.processMatch(votedMatch.match.id)).length,
      2,
    );

    // History is private by construction, strictly validated and keyset-paginated.
    assert.deepEqual(progressionHistoryQuerySchema.parse({}), { limit: 20 });
    assert.equal(
      progressionHistoryQuerySchema.parse({ limit: "50" }).limit,
      50,
    );
    assert.throws(() => progressionHistoryQuerySchema.parse({ limit: 51 }));
    assert.throws(() =>
      progressionHistoryQuerySchema.parse({ playerId: base.members[0]!.id }),
    );
    await assert.rejects(
      () => history.list(base.owner.id, { limit: 1, cursor: "not+a+cursor" }),
      hasCode("invalid_cursor"),
    );
    const firstHistoryPage = await history.list(base.owner.id, { limit: 1 });
    assert.equal(firstHistoryPage.items.length, 1);
    assert.equal(
      firstHistoryPage.items[0]?.context.matchId,
      votedMatch.match.id,
    );
    assert.ok(firstHistoryPage.nextCursor);
    const secondHistoryPage = await history.list(base.owner.id, {
      limit: 1,
      cursor: firstHistoryPage.nextCursor,
    });
    assert.equal(secondHistoryPage.items.length, 1);
    assert.equal(
      secondHistoryPage.items[0]?.context.matchId,
      baseMatch.match.id,
    );
    assert.equal(secondHistoryPage.nextCursor, null);
    assert.notEqual(
      firstHistoryPage.items[0]?.context.matchId,
      secondHistoryPage.items[0]?.context.matchId,
    );

    // Equal scheduled times use Match UUID as the stable canonical tie-break.
    const tiedScheduledAt = new Date("2027-03-01T10:00:00.000Z");
    const tiedMatches = await Promise.all([
      completedMatch(
        base.owner.id,
        base.group.id,
        [base.owner.id, base.members[0]!.id],
        tiedScheduledAt,
      ),
      completedMatch(
        base.owner.id,
        base.group.id,
        [base.owner.id, base.members[0]!.id],
        tiedScheduledAt,
      ),
    ]);
    const tiedAscending = [...tiedMatches].sort((left, right) =>
      left.match.id.localeCompare(right.match.id),
    );
    now = new Date(now.getTime() + 19 * 60 * 60 * 1000);
    await progression.processMatch(tiedAscending[0]!.match.id);
    await progression.processMatch(tiedAscending[1]!.match.id);
    const tiedHistory = await history.list(base.owner.id, { limit: 2 });
    assert.deepEqual(
      tiedHistory.items.map((item) => item.context.matchId),
      [...tiedAscending].reverse().map((item) => item.match.id),
    );
    assert.ok(
      tiedHistory.items.every(
        (item) => item.snapshot.configVersion === PROGRESSION_V1_1_VERSION,
      ),
    );
    const tiedPageOne = await history.list(base.owner.id, { limit: 1 });
    const tiedPageTwo = await history.list(base.owner.id, {
      limit: 1,
      cursor: tiedPageOne.nextCursor!,
    });
    assert.deepEqual(
      [
        tiedPageOne.items[0]?.context.matchId,
        tiedPageTwo.items[0]?.context.matchId,
      ],
      [...tiedAscending].reverse().map((item) => item.match.id),
    );

    // The read model preserves the immutable config reference of every row.
    const versioned = await groupWithMembers("versioned history", 0);
    const versionedMatches = await Promise.all([
      completedMatch(
        versioned.owner.id,
        versioned.group.id,
        [versioned.owner.id],
        new Date("2027-06-01T10:00:00.000Z"),
      ),
      completedMatch(
        versioned.owner.id,
        versioned.group.id,
        [versioned.owner.id],
        new Date("2027-06-02T10:00:00.000Z"),
      ),
    ]);
    const [templateSnapshot] = await connection.db
      .select()
      .from(progressionSnapshots)
      .where(eq(progressionSnapshots.matchId, tiedAscending[0]!.match.id))
      .limit(1);
    assert.ok(templateSnapshot);
    const futureConfigId = randomUUID();
    const futureVersion = `history-${randomUUID()}`;
    await connection.db.insert(progressionConfigVersions).values({
      id: futureConfigId,
      discipline: "F5",
      version: futureVersion,
      document: PROGRESSION_V1_1_CONFIG,
      activatedAt: new Date("2500-01-01T00:00:00.000Z"),
    });
    await connection.db.insert(progressionSnapshots).values([
      {
        ...templateSnapshot,
        id: randomUUID(),
        playerId: versioned.owner.id,
        matchId: versionedMatches[0].match.id,
        configVersionId: configRow.id,
      },
      {
        ...templateSnapshot,
        id: randomUUID(),
        playerId: versioned.owner.id,
        matchId: versionedMatches[1].match.id,
        configVersionId: futureConfigId,
      },
    ]);
    const versionedHistory = await history.list(versioned.owner.id, {
      limit: 20,
    });
    assert.deepEqual(
      versionedHistory.items.map((item) => item.snapshot.configVersion),
      [futureVersion, PROGRESSION_V1_1_VERSION],
    );

    // An elapsed window without a materialized VotingSession is processed lazily.
    const lazy = await groupWithMembers("lazy reveal", 1);
    const lazyMatch = await completedMatch(
      lazy.owner.id,
      lazy.group.id,
      [lazy.owner.id, lazy.members[0]!.id],
      new Date("2028-02-01T10:00:00.000Z"),
    );
    now = new Date(now.getTime() + 19 * 60 * 60 * 1000);
    const lazyPending = await reveals.get(lazy.owner.id, lazyMatch.match.id);
    assert.deepEqual(
      lazyPending.status === "PROGRESSION_PENDING"
        ? lazyPending.reason
        : lazyPending.status,
      "READY_TO_MATERIALIZE",
    );
    const lazyConcurrent = await Promise.all([
      reveals.materialize(lazy.owner.id, lazyMatch.match.id),
      reveals.materialize(lazy.owner.id, lazyMatch.match.id),
    ]);
    assert.ok(lazyConcurrent.every((item) => item.status === "AVAILABLE"));
    assert.equal(
      (
        await connection.db
          .select({ count: sql<number>`count(*)::int` })
          .from(progressionSnapshots)
          .where(eq(progressionSnapshots.matchId, lazyMatch.match.id))
      )[0]?.count,
      2,
    );

    await assert.rejects(
      () =>
        connection.db
          .update(progressionSnapshots)
          .set({ afterOvr: "99.000000000000" })
          .where(eq(progressionSnapshots.id, votedRows[0]!.id)),
      (error) => hasDatabaseCode(error, "55000"),
    );
    await assert.rejects(
      () =>
        connection.db
          .update(progressionConfigVersions)
          .set({ version: "mutated" })
          .where(eq(progressionConfigVersions.id, configRow.id)),
      (error) => hasDatabaseCode(error, "55000"),
    );
    await assert.rejects(
      () =>
        connection.db.insert(progressionSnapshots).values({
          ...votedRows[0]!,
          id: randomUUID(),
        }),
      (error) => hasDatabaseCode(error, "23505"),
    );

    // Distinct Matches for the same Players serialize and preserve historical order.
    const ordered = await groupWithMembers("ordered", 1);
    const early = await completedMatch(
      ordered.owner.id,
      ordered.group.id,
      [ordered.owner.id, ordered.members[0]!.id],
      new Date("2027-04-01T10:00:00.000Z"),
    );
    const late = await completedMatch(
      ordered.owner.id,
      ordered.group.id,
      [ordered.owner.id, ordered.members[0]!.id],
      new Date("2027-04-02T10:00:00.000Z"),
    );
    const earlySession = await voting.open(ordered.owner.id, early.match.id);
    now = earlySession.closesAt;
    await voting.get(ordered.owner.id, early.match.id);
    const lateSession = await voting.open(ordered.owner.id, late.match.id);
    now = lateSession.closesAt;
    const race = await Promise.allSettled([
      progression.processMatch(early.match.id),
      progression.processMatch(late.match.id),
    ]);
    assert.ok(race.some((result) => result.status === "fulfilled"));
    if (race[1].status === "rejected")
      assert.ok(hasCode("progression_out_of_order")(race[1].reason));
    await progression.processMatch(early.match.id);
    const historicalBeforeLater = await reveals.get(
      ordered.owner.id,
      early.match.id,
    );
    await progression.processMatch(late.match.id);
    assert.deepEqual(
      await reveals.get(ordered.owner.id, early.match.id),
      historicalBeforeLater,
    );
    const orderedPerformance = await connection.db
      .select()
      .from(playerPerformances)
      .where(
        and(
          eq(playerPerformances.playerId, ordered.owner.id),
          eq(playerPerformances.discipline, "F5"),
        ),
      );
    assert.equal(orderedPerformance[0]?.processedMatchCount, 2);
    assert.equal(orderedPerformance[0]?.lastProcessedMatchId, late.match.id);

    // A failure on a later Player rolls back earlier snapshots and provisioning.
    const rollback = await groupWithMembers("rollback", 2);
    const sorted = [...rollback.members].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const priorForSecond = await completedMatch(
      rollback.owner.id,
      rollback.group.id,
      [sorted[1]!.id],
      new Date("2027-05-01T10:00:00.000Z"),
    );
    const current = await completedMatch(
      rollback.owner.id,
      rollback.group.id,
      [sorted[0]!.id, sorted[1]!.id],
      new Date("2027-05-02T10:00:00.000Z"),
    );
    const priorSession = await voting.open(
      rollback.owner.id,
      priorForSecond.match.id,
    );
    now = priorSession.closesAt;
    await voting.get(rollback.owner.id, priorForSecond.match.id);
    const currentSession = await voting.open(
      rollback.owner.id,
      current.match.id,
    );
    now = currentSession.closesAt;
    await assert.rejects(
      () => progression.processMatch(current.match.id),
      hasCode("progression_out_of_order"),
    );
    const orderedPending = await reveals.materialize(
      sorted[0]!.id,
      current.match.id,
    );
    assert.equal(orderedPending.status, "PROGRESSION_PENDING");
    if (orderedPending.status === "PROGRESSION_PENDING")
      assert.equal(orderedPending.reason, "EARLIER_MATCH_PENDING");
    const partialSnapshots = await connection.db
      .select({ count: sql<number>`count(*)::int` })
      .from(progressionSnapshots)
      .where(eq(progressionSnapshots.matchId, current.match.id));
    assert.equal(partialSnapshots[0]?.count, 0);

    console.log(
      "progression PostgreSQL: migrations, eligibility, idempotency, immutable snapshots, same/different Match concurrency and rollback verified",
    );
    await connection.close();
  },
);
