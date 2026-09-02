import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  groupInvitations,
  groupConnectionInvitations,
  groupInvitationUsages,
  groupMemberships,
  groups,
  players,
  playerConnections,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { hasGroupCapability } from "./capabilities.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export class InvitationService {
  constructor(private readonly database: Database) {}

  async create(
    actorPlayerId: string,
    groupId: string,
    input:
      | { type: "SINGLE_USE" }
      | { type: "TIME_LIMITED"; expiresAt: Date; maxUses?: number | null },
  ) {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    if (input.type === "TIME_LIMITED" && input.expiresAt <= now)
      throw new ApplicationError(
        "invalid_invitation",
        "Invitation expiry must be in the future",
        400,
      );
    const membership = await this.requireManager(actorPlayerId, groupId);
    const [row] = await this.database
      .insert(groupInvitations)
      .values({
        id: randomUUID(),
        groupId,
        type: input.type,
        tokenHash: hashToken(token),
        createdByPlayerId: actorPlayerId,
        createdByRole: membership.role,
        expiresAt: input.type === "TIME_LIMITED" ? input.expiresAt : null,
        maxUses: input.type === "SINGLE_USE" ? 1 : (input.maxUses ?? null),
      })
      .returning();
    return { ...this.present(row!, now), token };
  }

  async list(actorPlayerId: string, groupId: string) {
    await this.requireManager(actorPlayerId, groupId);
    const rows = await this.database
      .select({
        invitation: groupInvitations,
        createdByDisplayName: players.displayName,
      })
      .from(groupInvitations)
      .innerJoin(players, eq(players.id, groupInvitations.createdByPlayerId))
      .where(eq(groupInvitations.groupId, groupId))
      .orderBy(desc(groupInvitations.createdAt))
      .limit(100);
    return rows.map((row) => ({
      ...this.present(row.invitation, new Date()),
      createdByDisplayName: row.createdByDisplayName,
    }));
  }

  async preview(token: string) {
    const [row] = await this.database
      .select({ invitation: groupInvitations, groupName: groups.name })
      .from(groupInvitations)
      .innerJoin(groups, eq(groups.id, groupInvitations.groupId))
      .where(eq(groupInvitations.tokenHash, hashToken(token)))
      .limit(1);
    if (!row || this.effectiveStatus(row.invitation, new Date()) !== "ACTIVE")
      return { available: false as const };
    return { available: true as const, groupName: row.groupName };
  }

  async join(actorPlayerId: string, token: string) {
    return this.database.transaction(async (tx) => {
      const tokenHash = hashToken(token);
      const locked = await tx.execute(
        sql`select id from ${groupInvitations} where token_hash = ${tokenHash} for update`,
      );
      if (locked.length === 0) this.unavailable();
      const [invitation] = await tx
        .select()
        .from(groupInvitations)
        .where(eq(groupInvitations.tokenHash, tokenHash))
        .limit(1);
      if (!invitation) this.unavailable();
      if (this.effectiveStatus(invitation, new Date()) !== "ACTIVE")
        this.unavailable();
      const [group] = await tx
        .select({ status: groups.status })
        .from(groups)
        .where(eq(groups.id, invitation.groupId))
        .limit(1);
      if (!group || group.status !== "ACTIVE") this.unavailable();

      const admission = await this.admitMember(
        tx,
        invitation.groupId,
        actorPlayerId,
      );
      if (admission.outcome === "ALREADY_MEMBER")
        return {
          outcome: "ALREADY_MEMBER" as const,
          groupId: invitation.groupId,
        };
      await tx.insert(groupInvitationUsages).values({
        id: randomUUID(),
        invitationId: invitation.id,
        playerId: actorPlayerId,
        membershipId: admission.membershipId,
      });
      await tx
        .update(groupInvitations)
        .set({ useCount: invitation.useCount + 1, updatedAt: new Date() })
        .where(eq(groupInvitations.id, invitation.id));
      return { outcome: "JOINED" as const, groupId: invitation.groupId };
    });
  }

  async createDirected(
    actorPlayerId: string,
    groupId: string,
    invitedPlayerId: string,
  ) {
    if (actorPlayerId === invitedPlayerId)
      throw new ApplicationError(
        "invalid_invitation",
        "Cannot invite yourself",
        422,
      );
    const actor = await this.requireManager(actorPlayerId, groupId);
    await this.requireConnection(actorPlayerId, invitedPlayerId);
    const latest = await this.latestMembership(
      groupId,
      invitedPlayerId,
      this.database,
    );
    if (latest?.status === "ACTIVE")
      return { outcome: "ALREADY_MEMBER" as const, groupId };
    if (latest?.status === "BLOCKED")
      throw new ApplicationError(
        "member_blocked",
        "Player cannot join this group",
        409,
      );
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return this.database.transaction(async (tx) => {
      await tx
        .update(groupConnectionInvitations)
        .set({ status: "EXPIRED", respondedAt: now, updatedAt: now })
        .where(
          and(
            eq(groupConnectionInvitations.groupId, groupId),
            eq(groupConnectionInvitations.invitedPlayerId, invitedPlayerId),
            eq(groupConnectionInvitations.status, "PENDING"),
            lt(groupConnectionInvitations.expiresAt, now),
          ),
        );
      const inserted = await tx
        .insert(groupConnectionInvitations)
        .values({
          id: randomUUID(),
          groupId,
          invitedPlayerId,
          invitedByPlayerId: actorPlayerId,
          invitedByRole: actor.role,
          expiresAt,
        })
        .onConflictDoNothing()
        .returning();
      const invitation =
        inserted[0] ??
        (await tx
          .select()
          .from(groupConnectionInvitations)
          .where(
            and(
              eq(groupConnectionInvitations.groupId, groupId),
              eq(groupConnectionInvitations.invitedPlayerId, invitedPlayerId),
              eq(groupConnectionInvitations.status, "PENDING"),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]));
      if (!invitation)
        throw new ApplicationError(
          "concurrency_conflict",
          "Invitation changed concurrently",
          409,
        );
      return {
        outcome: "INVITED" as const,
        invitation: this.presentDirected(invitation),
      };
    });
  }

  async listDirectedFor(actorPlayerId: string) {
    const rows = await this.database
      .select({
        invitation: groupConnectionInvitations,
        groupName: groups.name,
        inviterName: players.displayName,
      })
      .from(groupConnectionInvitations)
      .innerJoin(groups, eq(groups.id, groupConnectionInvitations.groupId))
      .innerJoin(
        players,
        eq(players.id, groupConnectionInvitations.invitedByPlayerId),
      )
      .where(eq(groupConnectionInvitations.invitedPlayerId, actorPlayerId))
      .orderBy(desc(groupConnectionInvitations.createdAt))
      .limit(100);
    return rows.map((row) => ({
      ...this.presentDirected(row.invitation),
      group: { id: row.invitation.groupId, name: row.groupName },
      invitedBy: {
        id: row.invitation.invitedByPlayerId,
        displayName: row.inviterName,
      },
    }));
  }

  async listDirectedForGroup(actorPlayerId: string, groupId: string) {
    await this.requireManager(actorPlayerId, groupId);
    const rows = await this.database
      .select({
        invitation: groupConnectionInvitations,
        invitedPlayerName: players.displayName,
      })
      .from(groupConnectionInvitations)
      .innerJoin(
        players,
        eq(players.id, groupConnectionInvitations.invitedPlayerId),
      )
      .where(eq(groupConnectionInvitations.groupId, groupId))
      .orderBy(desc(groupConnectionInvitations.createdAt))
      .limit(100);
    return rows.map((row) => ({
      ...this.presentDirected(row.invitation),
      invitedPlayer: {
        id: row.invitation.invitedPlayerId,
        displayName: row.invitedPlayerName,
      },
      invitedByPlayerId: row.invitation.invitedByPlayerId,
    }));
  }

  async acceptDirected(actorPlayerId: string, invitationId: string) {
    return this.database.transaction(async (tx) => {
      await tx.execute(
        sql`select id from ${groupConnectionInvitations} where id = ${invitationId} for update`,
      );
      const [invitation] = await tx
        .select()
        .from(groupConnectionInvitations)
        .where(
          and(
            eq(groupConnectionInvitations.id, invitationId),
            eq(groupConnectionInvitations.invitedPlayerId, actorPlayerId),
          ),
        )
        .limit(1);
      if (!invitation)
        throw new ApplicationError(
          "invitation_not_available",
          "Invitation not available",
          404,
        );
      if (invitation.status === "ACCEPTED")
        return {
          outcome: "ALREADY_MEMBER" as const,
          groupId: invitation.groupId,
        };
      if (invitation.status !== "PENDING" || new Date() >= invitation.expiresAt)
        this.unavailable();
      const admission = await this.admitMember(
        tx,
        invitation.groupId,
        actorPlayerId,
      );
      await tx
        .update(groupConnectionInvitations)
        .set({
          status: "ACCEPTED",
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(groupConnectionInvitations.id, invitation.id));
      return { outcome: admission.outcome, groupId: invitation.groupId };
    });
  }

  async rejectDirected(actorPlayerId: string, invitationId: string) {
    return this.database.transaction(async (tx) => {
      await tx.execute(
        sql`select id from ${groupConnectionInvitations} where id = ${invitationId} for update`,
      );
      const [invitation] = await tx
        .select()
        .from(groupConnectionInvitations)
        .where(
          and(
            eq(groupConnectionInvitations.id, invitationId),
            eq(groupConnectionInvitations.invitedPlayerId, actorPlayerId),
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
        .update(groupConnectionInvitations)
        .set({
          status: "REJECTED",
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(groupConnectionInvitations.id, invitationId));
    });
  }

  async revokeDirected(
    actorPlayerId: string,
    groupId: string,
    invitationId: string,
  ) {
    return this.database.transaction(async (tx) => {
      const actor = await this.requireManager(actorPlayerId, groupId, tx);
      await tx.execute(
        sql`select id from ${groupConnectionInvitations} where id = ${invitationId} and group_id = ${groupId} for update`,
      );
      const [invitation] = await tx
        .select()
        .from(groupConnectionInvitations)
        .where(
          and(
            eq(groupConnectionInvitations.id, invitationId),
            eq(groupConnectionInvitations.groupId, groupId),
          ),
        )
        .limit(1);
      if (!invitation) this.unavailable();
      if (
        actor.role === "MODERATOR" &&
        (invitation.invitedByRole === "OWNER" ||
          invitation.invitedByPlayerId !== actorPlayerId)
      )
        throw new ApplicationError("forbidden", "Forbidden", 403);
      if (invitation.status !== "PENDING") return;
      await tx
        .update(groupConnectionInvitations)
        .set({
          status: "REVOKED",
          revokedAt: new Date(),
          revokedByPlayerId: actorPlayerId,
          updatedAt: new Date(),
        })
        .where(eq(groupConnectionInvitations.id, invitation.id));
    });
  }

  async revoke(actorPlayerId: string, groupId: string, invitationId: string) {
    return this.database.transaction(async (tx) => {
      const actor = await this.requireManager(actorPlayerId, groupId, tx);
      await tx.execute(
        sql`select id from ${groupInvitations} where id = ${invitationId} and group_id = ${groupId} for update`,
      );
      const [invitation] = await tx
        .select()
        .from(groupInvitations)
        .where(
          and(
            eq(groupInvitations.id, invitationId),
            eq(groupInvitations.groupId, groupId),
          ),
        )
        .limit(1);
      if (!invitation) this.unavailable();
      if (
        actor.role === "MODERATOR" &&
        (invitation.createdByRole === "OWNER" ||
          invitation.createdByPlayerId !== actorPlayerId)
      )
        throw new ApplicationError("forbidden", "Forbidden", 403);
      if (invitation.revokedAt) return;
      await tx
        .update(groupInvitations)
        .set({
          revokedAt: new Date(),
          revokedByPlayerId: actorPlayerId,
          updatedAt: new Date(),
        })
        .where(eq(groupInvitations.id, invitationId));
    });
  }

  async usages(actorPlayerId: string, groupId: string, invitationId: string) {
    const actor = await this.requireManager(actorPlayerId, groupId);
    if (actor.role !== "OWNER")
      throw new ApplicationError("forbidden", "Forbidden", 403);
    return this.database
      .select({
        playerId: players.id,
        displayName: players.displayName,
        usedAt: groupInvitationUsages.usedAt,
      })
      .from(groupInvitationUsages)
      .innerJoin(players, eq(players.id, groupInvitationUsages.playerId))
      .innerJoin(
        groupInvitations,
        eq(groupInvitations.id, groupInvitationUsages.invitationId),
      )
      .where(
        and(
          eq(groupInvitationUsages.invitationId, invitationId),
          eq(groupInvitations.groupId, groupId),
        ),
      )
      .orderBy(groupInvitationUsages.usedAt)
      .limit(500);
  }

  private effectiveStatus(
    row: typeof groupInvitations.$inferSelect,
    now: Date,
  ) {
    if (row.revokedAt) return "REVOKED" as const;
    if (row.type === "SINGLE_USE" && row.useCount >= 1) return "USED" as const;
    if (row.expiresAt && now >= row.expiresAt) return "EXPIRED" as const;
    if (row.maxUses !== null && row.useCount >= row.maxUses)
      return "EXHAUSTED" as const;
    return "ACTIVE" as const;
  }

  private present(row: typeof groupInvitations.$inferSelect, now: Date) {
    return {
      id: row.id,
      groupId: row.groupId,
      type: row.type,
      status: this.effectiveStatus(row, now),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      maxUses: row.maxUses,
      useCount: row.useCount,
      createdAt: row.createdAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  }

  private unavailable(): never {
    throw new ApplicationError(
      "invitation_not_available",
      "Invitation is not available",
      409,
    );
  }

  private presentDirected(row: typeof groupConnectionInvitations.$inferSelect) {
    return {
      id: row.id,
      status:
        row.status === "PENDING" && new Date() >= row.expiresAt
          ? ("EXPIRED" as const)
          : row.status,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  private latestMembership(
    groupId: string,
    playerId: string,
    db: Database | Transaction,
  ) {
    return db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.playerId, playerId),
        ),
      )
      .orderBy(desc(groupMemberships.createdAt), desc(groupMemberships.id))
      .limit(1)
      .then((rows) => rows[0]);
  }

  private async admitMember(
    tx: Transaction,
    groupId: string,
    playerId: string,
  ) {
    const latest = await this.latestMembership(groupId, playerId, tx);
    if (latest?.status === "BLOCKED")
      throw new ApplicationError(
        "member_blocked",
        "You cannot join this group",
        403,
      );
    if (latest?.status === "ACTIVE")
      return { outcome: "ALREADY_MEMBER" as const, membershipId: latest.id };
    const membershipId = randomUUID();
    await tx.insert(groupMemberships).values({
      id: membershipId,
      groupId,
      playerId,
      role: "MEMBER",
      capabilities: [],
    });
    return { outcome: "JOINED" as const, membershipId };
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

  private async requireManager(
    playerId: string,
    groupId: string,
    db: Database | Transaction = this.database,
  ) {
    const [membership] = await db
      .select({
        id: groupMemberships.id,
        role: groupMemberships.role,
        capabilities: groupMemberships.capabilities,
        groupStatus: groups.status,
      })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
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
      membership.groupStatus !== "ACTIVE" ||
      !hasGroupCapability(
        membership.role,
        membership.capabilities,
        "GROUP_MANAGE_INVITATIONS",
      )
    )
      throw new ApplicationError("forbidden", "Forbidden", 403);
    return membership;
  }
}
