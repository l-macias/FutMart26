import { randomUUID } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  groupMemberships,
  matchParticipantStats,
  matchParticipants,
  matches,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import {
  type GroupCapability,
  hasGroupCapability,
} from "../groups/capabilities.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | Transaction;
type Attendance = "PLAYED" | "NO_SHOW";
type FinalRosterInput = { participantId: string; attendance: Attendance }[];
type StatsInput = { participantId: string; goals: number; assists: number }[];
const VOTING_GRACE_MINUTES = 15;

export class MatchCompletionService {
  constructor(private readonly database: Database) {}

  async finish(actorPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_COMPLETE",
      );
      if (match.status === "FINISHED") return;
      if (match.status !== "STARTED") this.invalidTransition();
      await tx
        .update(matches)
        .set({ status: "FINISHED", updatedAt: new Date() })
        .where(eq(matches.id, matchId));
    });
  }

  async confirmRoster(
    actorPlayerId: string,
    matchId: string,
    input: FinalRosterInput,
  ) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_CONFIRM_ROSTER",
      );
      if (match.status !== "FINISHED") this.invalidTransition();
      const confirmed = await tx
        .select({ id: matchParticipants.id })
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.status, "CONFIRMED"),
          ),
        )
        .orderBy(asc(matchParticipants.admissionOrder));
      const expected = new Set(confirmed.map((row) => row.id));
      const received = new Set(input.map((row) => row.participantId));
      if (
        received.size !== input.length ||
        received.size !== expected.size ||
        [...received].some((id) => !expected.has(id))
      )
        throw new ApplicationError(
          "invalid_final_roster",
          "Final roster must include every locked confirmed participant once",
          409,
        );
      const now = new Date();
      for (const participant of input) {
        await tx
          .update(matchParticipants)
          .set({
            attendance: participant.attendance,
            attendanceConfirmedAt: now,
            attendanceConfirmedByPlayerId: actorPlayerId,
            updatedAt: now,
          })
          .where(eq(matchParticipants.id, participant.participantId));
      }
      await tx
        .update(matches)
        .set({
          rosterConfirmedAt: now,
          rosterConfirmedByPlayerId: actorPlayerId,
          updatedAt: now,
        })
        .where(eq(matches.id, matchId));
    });
  }

  async getFinalRoster(actorPlayerId: string, matchId: string) {
    const match = await this.readableMatchOrObserver(actorPlayerId, matchId);
    const rows = await this.rosterRows(matchId);
    return {
      confirmedAt: match.rosterConfirmedAt?.toISOString() ?? null,
      participants: rows.map((row) => this.rosterView(row)),
    };
  }

  async updateStats(actorPlayerId: string, matchId: string, input: StatsInput) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireStatsAuthority(tx, actorPlayerId, match);
      if (match.status !== "FINISHED" || !match.rosterConfirmedAt)
        throw new ApplicationError(
          "roster_not_confirmed",
          "Final roster is not confirmed",
          409,
        );
      if (
        new Set(input.map((item) => item.participantId)).size !== input.length
      )
        throw new ApplicationError(
          "stats_not_allowed",
          "Duplicate participant stats",
          409,
        );
      const played = await tx
        .select({ id: matchParticipants.id })
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.status, "CONFIRMED"),
            eq(matchParticipants.attendance, "PLAYED"),
          ),
        );
      const eligible = new Set(played.map((row) => row.id));
      if (input.some((item) => !eligible.has(item.participantId)))
        throw new ApplicationError(
          "stats_not_allowed",
          "Stats require PLAYED attendance",
          409,
        );
      for (const item of input) {
        await tx
          .insert(matchParticipantStats)
          .values({
            id: randomUUID(),
            matchId,
            participantId: item.participantId,
            goals: item.goals,
            assists: item.assists,
            updatedByPlayerId: actorPlayerId,
          })
          .onConflictDoUpdate({
            target: matchParticipantStats.participantId,
            set: {
              goals: item.goals,
              assists: item.assists,
              updatedByPlayerId: actorPlayerId,
              updatedAt: new Date(),
            },
          });
      }
    });
  }

  async getStats(actorPlayerId: string, matchId: string) {
    await this.readableMatchOrObserver(actorPlayerId, matchId);
    return this.database
      .select({
        participantId: matchParticipantStats.participantId,
        goals: matchParticipantStats.goals,
        assists: matchParticipantStats.assists,
      })
      .from(matchParticipantStats)
      .where(eq(matchParticipantStats.matchId, matchId))
      .limit(200);
  }

  async assignObserver(
    actorPlayerId: string,
    matchId: string,
    observerPlayerId: string,
  ) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE_OBSERVER",
      );
      const [observer] = await tx
        .select({ id: players.id })
        .from(players)
        .where(eq(players.id, observerPlayerId))
        .limit(1);
      if (!observer)
        throw new ApplicationError("player_not_found", "Player not found", 404);
      await tx
        .update(matches)
        .set({ observerPlayerId, updatedAt: new Date() })
        .where(eq(matches.id, matchId));
    });
  }

  async removeObserver(actorPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE_OBSERVER",
      );
      await tx
        .update(matches)
        .set({ observerPlayerId: null, updatedAt: new Date() })
        .where(eq(matches.id, matchId));
    });
  }

  async eligibility(actorPlayerId: string, matchId: string) {
    const match = await this.readableMatch(actorPlayerId, matchId);
    if (!match.rosterConfirmedAt)
      throw new ApplicationError(
        "roster_not_confirmed",
        "Final roster is not confirmed",
        409,
      );
    const rows = await this.rosterRows(matchId);
    const scheduledEnd = new Date(
      match.scheduledAt.getTime() + match.durationMinutes * 60_000,
    );
    return {
      votingEligibleAfter: new Date(
        scheduledEnd.getTime() + VOTING_GRACE_MINUTES * 60_000,
      ).toISOString(),
      observer: match.observerPlayerId
        ? { playerId: match.observerPlayerId, canVote: false }
        : null,
      participants: rows.map((row) => ({
        ...this.rosterView(row),
        canVote: row.kind === "PLAYER" && row.attendance === "PLAYED",
        canBeEvaluated: row.attendance === "PLAYED",
      })),
    };
  }

  private rosterRows(matchId: string) {
    return this.database
      .select({
        id: matchParticipants.id,
        kind: matchParticipants.kind,
        playerId: matchParticipants.playerId,
        playerName: players.displayName,
        guestName: matchParticipants.guestDisplayName,
        attendance: matchParticipants.attendance,
      })
      .from(matchParticipants)
      .leftJoin(players, eq(players.id, matchParticipants.playerId))
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.status, "CONFIRMED"),
        ),
      )
      .orderBy(asc(matchParticipants.admissionOrder))
      .limit(200);
  }

  private rosterView(row: Awaited<ReturnType<typeof this.rosterRows>>[number]) {
    return {
      participantId: row.id,
      kind: row.kind,
      playerId: row.playerId,
      displayName: row.kind === "PLAYER" ? row.playerName : row.guestName,
      attendance: row.attendance,
    };
  }

  private async requireStatsAuthority(
    db: DatabaseExecutor,
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

  private async readableMatch(actorPlayerId: string, matchId: string) {
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
    return match;
  }

  private async readableMatchOrObserver(
    actorPlayerId: string,
    matchId: string,
  ) {
    const [match] = await this.database
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!match)
      throw new ApplicationError("match_not_found", "Match not found", 404);
    if (match.observerPlayerId === actorPlayerId) return match;
    await this.requireCapability(
      this.database,
      actorPlayerId,
      match.groupId,
      "GROUP_READ",
    );
    return match;
  }

  private async requireCapability(
    db: DatabaseExecutor,
    playerId: string,
    groupId: string,
    capability: GroupCapability,
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
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));
    return match!;
  }

  private invalidTransition(): never {
    throw new ApplicationError(
      "invalid_match_transition",
      "Invalid match transition",
      409,
    );
  }
}
