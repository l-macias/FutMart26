import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";

import type { Database } from "@football/database";
import {
  groupMemberships,
  matchParticipants,
  matches,
  matchTeamAssignments,
  playerPerformances,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { hasGroupCapability } from "../groups/capabilities.js";
import { MATCHMAKING_V1_CONFIG, proposeMatchTeams } from "./matchmaking.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type AssignmentInput = { participantId: string; side: "TEAM_A" | "TEAM_B" };

export class MatchTeamService {
  constructor(private readonly database: Database) {}

  async replace(
    actorPlayerId: string,
    matchId: string,
    assignments: AssignmentInput[],
  ) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockEditableMatch(tx, actorPlayerId, matchId);
      await this.replaceLocked(
        tx,
        match.id,
        actorPlayerId,
        assignments,
        "MANUAL",
        null,
      );
      return this.readLocked(tx, match.id);
    });
  }

  async generate(actorPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockEditableMatch(tx, actorPlayerId, matchId);
      const participants = await this.confirmedParticipants(tx, match.id);
      if (participants.length > MATCHMAKING_V1_CONFIG.maxParticipants)
        throw new ApplicationError(
          "invalid_team_assignment",
          "Roster exceeds F5 matchmaking bound",
          409,
        );
      const performances = await tx
        .select({
          playerId: playerPerformances.playerId,
          internalOvr: playerPerformances.internalOvr,
          ratingProfile: playerPerformances.ratingProfile,
        })
        .from(playerPerformances)
        .where(
          and(
            eq(playerPerformances.discipline, "F5"),
            inArray(
              playerPerformances.playerId,
              participants.flatMap((participant) =>
                participant.playerId ? [participant.playerId] : [],
              ),
            ),
          ),
        );
      const byPlayer = new Map(performances.map((row) => [row.playerId, row]));
      const proposal = proposeMatchTeams(
        participants.map((participant) => {
          const performance = participant.playerId
            ? byPlayer.get(participant.playerId)
            : undefined;
          return {
            participantId: participant.id,
            internalOvr:
              performance?.internalOvr ??
              MATCHMAKING_V1_CONFIG.defaultInternalOvr,
            ratingProfile: performance?.ratingProfile ?? "LIBRE",
            // No persisted goalkeeper preference exists yet. The pure engine accepts it,
            // but production deliberately reports missing coverage rather than inventing it.
            willingToPlayGoalkeeper: false,
          };
        }),
      );
      await this.replaceLocked(
        tx,
        match.id,
        actorPlayerId,
        proposal.assignments,
        "INTELLIGENT",
        proposal.algorithmVersion,
      );
      return {
        ...(await this.readLocked(tx, match.id)),
        diagnostics: proposal.diagnostics,
      };
    });
  }

  async get(actorPlayerId: string, matchId: string) {
    const match = await this.requireReadableMatch(actorPlayerId, matchId);
    return this.readLocked(this.database, match.id);
  }

  private async replaceLocked(
    tx: Transaction,
    matchId: string,
    actorPlayerId: string,
    assignments: AssignmentInput[],
    source: "MANUAL" | "INTELLIGENT",
    algorithmVersion: string | null,
  ) {
    if (
      new Set(assignments.map((item) => item.participantId)).size !==
      assignments.length
    )
      throw new ApplicationError(
        "invalid_team_assignment",
        "Participant assigned more than once",
        409,
      );
    const confirmed = await this.confirmedParticipants(tx, matchId);
    const eligible = new Set(confirmed.map((row) => row.id));
    if (assignments.some((item) => !eligible.has(item.participantId)))
      throw new ApplicationError(
        "invalid_team_assignment",
        "Only confirmed Match participants can be assigned",
        409,
      );
    await tx
      .delete(matchTeamAssignments)
      .where(eq(matchTeamAssignments.matchId, matchId));
    if (assignments.length > 0) {
      const now = new Date();
      await tx.insert(matchTeamAssignments).values(
        assignments.map((item) => ({
          id: randomUUID(),
          matchId,
          participantId: item.participantId,
          side: item.side,
          source,
          algorithmVersion,
          updatedByPlayerId: actorPlayerId,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
  }

  private confirmedParticipants(db: Database | Transaction, matchId: string) {
    return db
      .select({
        id: matchParticipants.id,
        playerId: matchParticipants.playerId,
      })
      .from(matchParticipants)
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.status, "CONFIRMED"),
        ),
      )
      .orderBy(asc(matchParticipants.admissionOrder))
      .limit(20);
  }

  private async readLocked(db: Database | Transaction, matchId: string) {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    const rows = await db
      .select({
        participantId: matchTeamAssignments.participantId,
        side: matchTeamAssignments.side,
        source: matchTeamAssignments.source,
        algorithmVersion: matchTeamAssignments.algorithmVersion,
        kind: matchParticipants.kind,
        playerId: matchParticipants.playerId,
        playerName: players.displayName,
        guestName: matchParticipants.guestDisplayName,
        internalOvr: playerPerformances.internalOvr,
      })
      .from(matchTeamAssignments)
      .innerJoin(
        matchParticipants,
        eq(matchParticipants.id, matchTeamAssignments.participantId),
      )
      .leftJoin(players, eq(players.id, matchParticipants.playerId))
      .leftJoin(
        playerPerformances,
        and(
          eq(playerPerformances.playerId, matchParticipants.playerId),
          eq(playerPerformances.discipline, "F5"),
        ),
      )
      .where(eq(matchTeamAssignments.matchId, matchId))
      .orderBy(
        asc(matchTeamAssignments.side),
        asc(matchParticipants.admissionOrder),
      );
    const side = (value: "TEAM_A" | "TEAM_B") => {
      const participants = rows
        .filter((row) => row.side === value)
        .map((row) => ({
          participantId: row.participantId,
          kind: row.kind,
          playerId: row.playerId,
          displayName: row.kind === "PLAYER" ? row.playerName : row.guestName,
          internalOvr:
            row.internalOvr ?? MATCHMAKING_V1_CONFIG.defaultInternalOvr,
        }));
      const averageOvr =
        participants.length === 0
          ? null
          : participants
              .reduce((sum, item) => sum.plus(item.internalOvr), new Decimal(0))
              .dividedBy(participants.length)
              .toDecimalPlaces(6)
              .toFixed(6);
      return { participants, averageOvr };
    };
    return {
      TEAM_A: side("TEAM_A"),
      TEAM_B: side("TEAM_B"),
      source: rows[0]?.source ?? null,
      algorithmVersion: rows[0]?.algorithmVersion ?? null,
      locked: match?.status === "STARTED" || match?.status === "FINISHED",
      diagnostics:
        rows[0]?.source === "INTELLIGENT"
          ? (["NO_KEEPER_COVERAGE"] as string[])
          : [],
    };
  }

  private async lockEditableMatch(
    tx: Transaction,
    actorPlayerId: string,
    matchId: string,
  ) {
    const locked = await tx.execute(
      sql`select id from ${matches} where id = ${matchId} for update`,
    );
    if (locked.length === 0)
      throw new ApplicationError("match_not_found", "Match not found", 404);
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));
    await this.requireCapability(
      tx,
      actorPlayerId,
      match!.groupId,
      "MATCH_MANAGE_TEAMS",
    );
    if (match!.status !== "OPEN")
      throw new ApplicationError(
        "teams_locked",
        "Teams can only be edited before Match start",
        409,
      );
    return match!;
  }

  private async requireReadableMatch(actorPlayerId: string, matchId: string) {
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
}
