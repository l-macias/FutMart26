import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  groupMemberships,
  groups,
  matchParticipants,
  matchPlayerInvitations,
  matches,
  playerConnections,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { hasGroupCapability } from "../groups/capabilities.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class MatchInvitationService {
  constructor(private readonly database: Database) {}

  async create(
    actorPlayerId: string,
    matchId: string,
    invitedPlayerId: string,
  ) {
    if (actorPlayerId === invitedPlayerId)
      throw new ApplicationError(
        "invalid_invitation",
        "Cannot invite yourself",
        422,
      );
    const match = await this.requireManager(actorPlayerId, matchId);
    if (match.status !== "OPEN" || match.rosterLockedAt)
      throw new ApplicationError("match_not_open", "Match is not open", 409);
    await this.requireConnection(actorPlayerId, invitedPlayerId);
    const [membership] = await this.database
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, match.groupId),
          eq(groupMemberships.playerId, invitedPlayerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (!membership)
      throw new ApplicationError(
        "membership_required",
        "Player must join the Group first",
        409,
      );
    const [participant] = await this.database
      .select({ id: matchParticipants.id })
      .from(matchParticipants)
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.kind, "PLAYER"),
          eq(matchParticipants.playerId, invitedPlayerId),
          inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
        ),
      )
      .limit(1);
    if (participant)
      return { outcome: "ALREADY_PARTICIPATING" as const, matchId };
    const inserted = await this.database
      .insert(matchPlayerInvitations)
      .values({
        id: randomUUID(),
        matchId,
        invitedPlayerId,
        invitedByPlayerId: actorPlayerId,
      })
      .onConflictDoNothing()
      .returning();
    const invitation =
      inserted[0] ?? (await this.pending(matchId, invitedPlayerId));
    return {
      outcome: "INVITED" as const,
      invitation: this.present(invitation!),
    };
  }

  async listFor(actorPlayerId: string) {
    const rows = await this.database
      .select({
        invitation: matchPlayerInvitations,
        match: matches,
        groupName: groups.name,
        inviterName: players.displayName,
      })
      .from(matchPlayerInvitations)
      .innerJoin(matches, eq(matches.id, matchPlayerInvitations.matchId))
      .innerJoin(groups, eq(groups.id, matches.groupId))
      .innerJoin(
        players,
        eq(players.id, matchPlayerInvitations.invitedByPlayerId),
      )
      .where(eq(matchPlayerInvitations.invitedPlayerId, actorPlayerId))
      .orderBy(desc(matchPlayerInvitations.createdAt))
      .limit(100);
    return rows.map(({ invitation, match, groupName, inviterName }) => ({
      ...this.present(invitation),
      match: {
        id: match.id,
        groupId: match.groupId,
        groupName,
        scheduledAt: match.scheduledAt.toISOString(),
        locationText: match.locationText,
      },
      invitedBy: { id: invitation.invitedByPlayerId, displayName: inviterName },
    }));
  }

  async reject(actorPlayerId: string, invitationId: string) {
    return this.database.transaction(async (tx) => {
      await tx.execute(
        sql`select id from ${matchPlayerInvitations} where id = ${invitationId} for update`,
      );
      const [invitation] = await tx
        .select()
        .from(matchPlayerInvitations)
        .where(
          and(
            eq(matchPlayerInvitations.id, invitationId),
            eq(matchPlayerInvitations.invitedPlayerId, actorPlayerId),
          ),
        )
        .limit(1);
      if (!invitation)
        throw new ApplicationError(
          "invitation_not_available",
          "Invitation not available",
          404,
        );
      if (invitation.status === "REJECTED") return;
      if (invitation.status !== "PENDING") this.unavailable();
      await tx
        .update(matchPlayerInvitations)
        .set({
          status: "REJECTED",
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(matchPlayerInvitations.id, invitationId));
    });
  }

  async revoke(actorPlayerId: string, matchId: string, invitationId: string) {
    return this.database.transaction(async (tx) => {
      await this.requireManager(actorPlayerId, matchId, tx);
      await tx.execute(
        sql`select id from ${matchPlayerInvitations} where id = ${invitationId} and match_id = ${matchId} for update`,
      );
      const [invitation] = await tx
        .select()
        .from(matchPlayerInvitations)
        .where(
          and(
            eq(matchPlayerInvitations.id, invitationId),
            eq(matchPlayerInvitations.matchId, matchId),
          ),
        )
        .limit(1);
      if (!invitation)
        throw new ApplicationError(
          "invitation_not_available",
          "Invitation not available",
          404,
        );
      if (invitation.status === "REVOKED") return;
      if (invitation.status !== "PENDING") this.unavailable();
      await tx
        .update(matchPlayerInvitations)
        .set({
          status: "REVOKED",
          revokedAt: new Date(),
          revokedByPlayerId: actorPlayerId,
          updatedAt: new Date(),
        })
        .where(eq(matchPlayerInvitations.id, invitationId));
    });
  }

  private pending(matchId: string, playerId: string) {
    return this.database
      .select()
      .from(matchPlayerInvitations)
      .where(
        and(
          eq(matchPlayerInvitations.matchId, matchId),
          eq(matchPlayerInvitations.invitedPlayerId, playerId),
          eq(matchPlayerInvitations.status, "PENDING"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);
  }

  private present(row: typeof matchPlayerInvitations.$inferSelect) {
    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private unavailable(): never {
    throw new ApplicationError(
      "invitation_not_available",
      "Invitation not available",
      409,
    );
  }

  private async requireManager(
    actorPlayerId: string,
    matchId: string,
    database: Database | Transaction = this.database,
  ) {
    const [row] = await database
      .select({
        match: matches,
        role: groupMemberships.role,
        capabilities: groupMemberships.capabilities,
        groupStatus: groups.status,
      })
      .from(matches)
      .innerJoin(groups, eq(groups.id, matches.groupId))
      .innerJoin(
        groupMemberships,
        and(
          eq(groupMemberships.groupId, matches.groupId),
          eq(groupMemberships.playerId, actorPlayerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!row)
      throw new ApplicationError("match_not_found", "Match not found", 404);
    if (
      row.groupStatus !== "ACTIVE" ||
      !hasGroupCapability(row.role, row.capabilities, "MATCH_MANAGE")
    )
      throw new ApplicationError("forbidden", "Forbidden", 403);
    return row.match;
  }

  private async requireConnection(first: string, second: string) {
    const [low, high] = first < second ? [first, second] : [second, first];
    const [connection] = await this.database
      .select({ id: playerConnections.id })
      .from(playerConnections)
      .where(
        and(
          eq(playerConnections.playerLowId, low),
          eq(playerConnections.playerHighId, high),
          eq(playerConnections.status, "ACCEPTED"),
        ),
      )
      .limit(1);
    if (!connection)
      throw new ApplicationError(
        "connection_required",
        "An accepted connection is required",
        409,
      );
  }
}
