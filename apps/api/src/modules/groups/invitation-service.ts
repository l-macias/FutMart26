import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  groupInvitations,
  groupInvitationUsages,
  groupMemberships,
  groups,
  players,
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
      .select()
      .from(groupInvitations)
      .where(eq(groupInvitations.groupId, groupId))
      .orderBy(desc(groupInvitations.createdAt))
      .limit(100);
    return rows.map((row) => this.present(row, new Date()));
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

      const history = await tx
        .select()
        .from(groupMemberships)
        .where(
          and(
            eq(groupMemberships.groupId, invitation.groupId),
            eq(groupMemberships.playerId, actorPlayerId),
          ),
        )
        .orderBy(desc(groupMemberships.createdAt), desc(groupMemberships.id))
        .limit(1);
      const latest = history[0];
      if (latest?.status === "BLOCKED")
        throw new ApplicationError(
          "member_blocked",
          "You cannot join this group",
          403,
        );
      if (latest?.status === "ACTIVE")
        return {
          outcome: "ALREADY_MEMBER" as const,
          groupId: invitation.groupId,
        };

      const membershipId = randomUUID();
      await tx.insert(groupMemberships).values({
        id: membershipId,
        groupId: invitation.groupId,
        playerId: actorPlayerId,
        role: "MEMBER",
        capabilities: [],
      });
      await tx.insert(groupInvitationUsages).values({
        id: randomUUID(),
        invitationId: invitation.id,
        playerId: actorPlayerId,
        membershipId,
      });
      await tx
        .update(groupInvitations)
        .set({ useCount: invitation.useCount + 1, updatedAt: new Date() })
        .where(eq(groupInvitations.id, invitation.id));
      return { outcome: "JOINED" as const, groupId: invitation.groupId };
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
