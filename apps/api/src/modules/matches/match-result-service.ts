import { randomUUID } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  groupMemberships,
  matchParticipants,
  matchParticipantStats,
  matches,
  matchSportingResults,
  matchTeamAssignments,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { hasGroupCapability } from "../groups/capabilities.js";
import { votingOpensAt } from "../voting/voting-window.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DraftInput = {
  teamAGoals: number;
  teamBGoals: number;
  participants: { participantId: string; goals: number; assists: number }[];
};

export class MatchResultService {
  constructor(
    private readonly database: Database,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async saveDraft(actorPlayerId: string, matchId: string, input: DraftInput) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireDraftAuthority(tx, actorPlayerId, match);
      this.requireClosureEditable(match);
      await this.requireNoVoting(tx, match);
      this.validateInputShape(input);
      const played = await this.playedAssignments(tx, matchId);
      const playedIds = new Set(played.map((row) => row.participantId));
      if (input.participants.some((item) => !playedIds.has(item.participantId)))
        throw new ApplicationError(
          "invalid_sporting_result",
          "Stats require a PLAYED assigned participant",
          409,
        );
      const now = this.clock();
      await tx
        .insert(matchSportingResults)
        .values({
          id: randomUUID(),
          matchId,
          status: "DRAFT",
          teamAGoals: input.teamAGoals,
          teamBGoals: input.teamBGoals,
          updatedByPlayerId: actorPlayerId,
        })
        .onConflictDoUpdate({
          target: matchSportingResults.matchId,
          set: {
            status: "DRAFT",
            teamAGoals: input.teamAGoals,
            teamBGoals: input.teamBGoals,
            updatedByPlayerId: actorPlayerId,
            confirmedAt: null,
            confirmedByPlayerId: null,
            updatedAt: now,
          },
        });
      await tx
        .update(matchParticipantStats)
        .set({
          goals: 0,
          assists: 0,
          updatedByPlayerId: actorPlayerId,
          updatedAt: now,
        })
        .where(eq(matchParticipantStats.matchId, matchId));
      for (const item of input.participants) {
        await tx
          .insert(matchParticipantStats)
          .values({
            id: randomUUID(),
            matchId,
            ...item,
            updatedByPlayerId: actorPlayerId,
          })
          .onConflictDoUpdate({
            target: matchParticipantStats.participantId,
            set: {
              goals: item.goals,
              assists: item.assists,
              updatedByPlayerId: actorPlayerId,
              updatedAt: now,
            },
          });
      }
      return this.readResult(tx, matchId);
    });
  }

  async confirm(actorPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE_STATS",
      );
      this.requireClosureEditable(match);
      await this.requireNoVoting(tx, match);
      const played = await this.playedAssignments(tx, matchId);
      const [playedCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.status, "CONFIRMED"),
            eq(matchParticipants.attendance, "PLAYED"),
          ),
        );
      if (played.length !== playedCount!.count)
        throw new ApplicationError(
          "invalid_sporting_result",
          "Every PLAYED participant needs a locked team assignment",
          409,
        );
      const now = this.clock();
      if (played.length === 0) {
        await tx
          .insert(matchSportingResults)
          .values({
            id: randomUUID(),
            matchId,
            status: "NOT_PLAYED",
            teamAGoals: null,
            teamBGoals: null,
            updatedByPlayerId: actorPlayerId,
            confirmedAt: now,
            confirmedByPlayerId: actorPlayerId,
          })
          .onConflictDoUpdate({
            target: matchSportingResults.matchId,
            set: {
              status: "NOT_PLAYED",
              teamAGoals: null,
              teamBGoals: null,
              updatedByPlayerId: actorPlayerId,
              confirmedAt: now,
              confirmedByPlayerId: actorPlayerId,
              updatedAt: now,
            },
          });
        return this.readResult(tx, matchId);
      }
      const [result] = await tx
        .select()
        .from(matchSportingResults)
        .where(eq(matchSportingResults.matchId, matchId))
        .limit(1);
      if (
        !result ||
        result.status !== "DRAFT" ||
        result.teamAGoals === null ||
        result.teamBGoals === null
      )
        throw new ApplicationError(
          "sporting_result_not_ready",
          "A score draft is required",
          409,
        );
      const stats = await tx
        .select({
          participantId: matchParticipantStats.participantId,
          goals: matchParticipantStats.goals,
          assists: matchParticipantStats.assists,
        })
        .from(matchParticipantStats)
        .where(eq(matchParticipantStats.matchId, matchId));
      const statsByParticipant = new Map(
        stats.map((row) => [row.participantId, row]),
      );
      const totals = {
        TEAM_A: { goals: 0, assists: 0 },
        TEAM_B: { goals: 0, assists: 0 },
      };
      for (const participant of played) {
        const item = statsByParticipant.get(participant.participantId);
        totals[participant.side].goals += item?.goals ?? 0;
        totals[participant.side].assists += item?.assists ?? 0;
      }
      if (
        totals.TEAM_A.goals !== result.teamAGoals ||
        totals.TEAM_B.goals !== result.teamBGoals
      )
        throw new ApplicationError(
          "invalid_sporting_result",
          "Participant goals must equal the score for each side",
          409,
        );
      if (
        totals.TEAM_A.assists > result.teamAGoals ||
        totals.TEAM_B.assists > result.teamBGoals
      )
        throw new ApplicationError(
          "invalid_sporting_result",
          "Assists cannot exceed goals for a side",
          409,
        );
      await tx
        .update(matchSportingResults)
        .set({
          status: "CONFIRMED",
          confirmedAt: now,
          confirmedByPlayerId: actorPlayerId,
          updatedAt: now,
        })
        .where(eq(matchSportingResults.id, result.id));
      return this.readResult(tx, matchId);
    });
  }

  async get(actorPlayerId: string, matchId: string) {
    const [match] = await this.database
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!match)
      throw new ApplicationError("match_not_found", "Match not found", 404);
    await this.requireCapability(
      this.database,
      actorPlayerId,
      match.groupId,
      "GROUP_READ",
    );
    return this.readResult(this.database, matchId);
  }

  private async readResult(db: Database | Transaction, matchId: string) {
    const [result] = await db
      .select()
      .from(matchSportingResults)
      .where(eq(matchSportingResults.matchId, matchId))
      .limit(1);
    const stats = await db
      .select({
        participantId: matchParticipantStats.participantId,
        goals: matchParticipantStats.goals,
        assists: matchParticipantStats.assists,
      })
      .from(matchParticipantStats)
      .where(eq(matchParticipantStats.matchId, matchId))
      .orderBy(asc(matchParticipantStats.participantId));
    if (!result)
      return {
        status: null,
        teamAGoals: null,
        teamBGoals: null,
        winner: null,
        participants: stats,
      };
    const winner =
      result.status === "NOT_PLAYED" ||
      result.teamAGoals === null ||
      result.teamBGoals === null
        ? null
        : result.teamAGoals > result.teamBGoals
          ? "TEAM_A"
          : result.teamBGoals > result.teamAGoals
            ? "TEAM_B"
            : "DRAW";
    return {
      status: result.status,
      teamAGoals: result.teamAGoals,
      teamBGoals: result.teamBGoals,
      winner,
      participants: stats,
    };
  }

  private playedAssignments(db: Database | Transaction, matchId: string) {
    return db
      .select({
        participantId: matchParticipants.id,
        side: matchTeamAssignments.side,
      })
      .from(matchParticipants)
      .innerJoin(
        matchTeamAssignments,
        eq(matchTeamAssignments.participantId, matchParticipants.id),
      )
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.status, "CONFIRMED"),
          eq(matchParticipants.attendance, "PLAYED"),
        ),
      );
  }

  private validateInputShape(input: DraftInput) {
    if (
      new Set(input.participants.map((item) => item.participantId)).size !==
      input.participants.length
    )
      throw new ApplicationError(
        "invalid_sporting_result",
        "Duplicate participant stats",
        409,
      );
  }

  private requireClosureEditable(match: typeof matches.$inferSelect) {
    if (match.status !== "FINISHED" || !match.rosterConfirmedAt)
      throw new ApplicationError(
        "sporting_result_not_ready",
        "Finished Match and final roster are required",
        409,
      );
  }

  private async requireNoVoting(
    db: Database | Transaction,
    match: typeof matches.$inferSelect,
  ) {
    const [result] = await db
      .select({
        status: matchSportingResults.status,
        confirmedAt: matchSportingResults.confirmedAt,
      })
      .from(matchSportingResults)
      .where(eq(matchSportingResults.matchId, match.id))
      .limit(1);
    if (result?.status !== "CONFIRMED" || !result.confirmedAt) return;
    if (
      this.clock() >=
      votingOpensAt(
        match.scheduledAt,
        match.durationMinutes,
        result.confirmedAt,
      )
    )
      throw new ApplicationError(
        "sporting_result_locked",
        "Sporting result is frozen after Voting becomes eligible",
        409,
      );
  }

  private async requireDraftAuthority(
    db: Database | Transaction,
    actorPlayerId: string,
    match: typeof matches.$inferSelect,
  ) {
    if (match.observerPlayerId === actorPlayerId) return;
    await this.requireCapability(
      db,
      actorPlayerId,
      match.groupId,
      "MATCH_MANAGE_STATS",
    );
  }

  private async requireCapability(
    db: Database | Transaction,
    playerId: string,
    groupId: string,
    capability: Parameters<typeof hasGroupCapability>[2],
  ) {
    const [membership] = await db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.playerId, playerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (
      !membership ||
      !hasGroupCapability(membership.role, membership.capabilities, capability)
    )
      throw new ApplicationError("forbidden", "Forbidden", 403);
  }

  private async lockMatch(tx: Transaction, matchId: string) {
    const locked = await tx.execute(
      sql`select id from ${matches} where id = ${matchId} for update`,
    );
    if (locked.length === 0)
      throw new ApplicationError("match_not_found", "Match not found", 404);
    return (await tx.select().from(matches).where(eq(matches.id, matchId)))[0]!;
  }
}
