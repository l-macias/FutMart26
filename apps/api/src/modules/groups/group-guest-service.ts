import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  groupGuests,
  groupMemberships,
  groups,
  matchParticipants,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { hasGroupCapability, type GroupCapability } from "./capabilities.js";

export function normalizeGuestName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export class GroupGuestService {
  constructor(private readonly database: Database) {}

  async create(actorPlayerId: string, groupId: string, displayName: string) {
    // Any active member may create a local identity for a Guest they intend to add.
    // Lifecycle administration remains protected by GROUP_MANAGE_GUESTS.
    await this.requireCapability(actorPlayerId, groupId, "GROUP_READ");
    const normalizedDisplayName = normalizeGuestName(displayName);
    try {
      const [guest] = await this.database
        .insert(groupGuests)
        .values({
          id: randomUUID(),
          groupId,
          displayName: displayName.trim().replace(/\s+/g, " "),
          normalizedDisplayName,
          createdByPlayerId: actorPlayerId,
        })
        .returning();
      return guest!;
    } catch (error) {
      if (this.isUniqueViolation(error))
        throw new ApplicationError(
          "guest_name_conflict",
          "An active or archived Guest already uses that name",
          409,
        );
      throw error;
    }
  }

  async list(
    actorPlayerId: string,
    groupId: string,
    limit: number,
    offset: number,
  ) {
    await this.requireCapability(actorPlayerId, groupId, "GROUP_READ");
    return this.database
      .select({
        id: groupGuests.id,
        displayName: groupGuests.displayName,
        status: groupGuests.status,
        createdAt: groupGuests.createdAt,
        matchesPlayed: sql<number>`count(${matchParticipants.id}) filter (where ${matchParticipants.attendance} = 'PLAYED')::int`,
        lastParticipationAt: sql<Date | null>`max(${matchParticipants.joinedAt})`,
      })
      .from(groupGuests)
      .leftJoin(
        matchParticipants,
        eq(matchParticipants.groupGuestId, groupGuests.id),
      )
      .where(eq(groupGuests.groupId, groupId))
      .groupBy(groupGuests.id)
      .orderBy(asc(groupGuests.normalizedDisplayName), asc(groupGuests.id))
      .limit(limit)
      .offset(offset);
  }

  async rename(
    actorPlayerId: string,
    groupId: string,
    guestId: string,
    displayName: string,
  ) {
    await this.requireCapability(actorPlayerId, groupId, "GROUP_MANAGE_GUESTS");
    try {
      const updated = await this.database
        .update(groupGuests)
        .set({
          displayName: displayName.trim().replace(/\s+/g, " "),
          normalizedDisplayName: normalizeGuestName(displayName),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(groupGuests.id, guestId),
            eq(groupGuests.groupId, groupId),
            sql`${groupGuests.status} <> 'DELETED'`,
          ),
        )
        .returning({ id: groupGuests.id });
      if (updated.length === 0) this.notFound();
    } catch (error) {
      if (this.isUniqueViolation(error))
        throw new ApplicationError(
          "guest_name_conflict",
          "An active or archived Guest already uses that name",
          409,
        );
      throw error;
    }
  }

  async archive(actorPlayerId: string, groupId: string, guestId: string) {
    await this.setStatus(actorPlayerId, groupId, guestId, "ARCHIVED");
  }

  async restore(actorPlayerId: string, groupId: string, guestId: string) {
    await this.requireCapability(actorPlayerId, groupId, "GROUP_MANAGE_GUESTS");
    const [guest] = await this.database
      .select()
      .from(groupGuests)
      .where(and(eq(groupGuests.id, guestId), eq(groupGuests.groupId, groupId)))
      .limit(1);
    if (!guest) this.notFound();
    if (guest.status === "DELETED")
      throw new ApplicationError(
        "guest_not_reusable",
        "Deleted Guest identities cannot be restored",
        409,
      );
    if (guest.status === "ACTIVE") return;
    try {
      await this.database
        .update(groupGuests)
        .set({
          status: "ACTIVE",
          archivedAt: null,
          archivedByPlayerId: null,
          updatedAt: new Date(),
        })
        .where(eq(groupGuests.id, guestId));
    } catch (error) {
      if (this.isUniqueViolation(error))
        throw new ApplicationError(
          "guest_name_conflict",
          "Another reusable Guest uses that name",
          409,
        );
      throw error;
    }
  }

  async remove(actorPlayerId: string, groupId: string, guestId: string) {
    await this.requireCapability(actorPlayerId, groupId, "GROUP_MANAGE_GUESTS");
    const result = await this.database
      .update(groupGuests)
      .set({
        status: "DELETED",
        deletedAt: new Date(),
        deletedByPlayerId: actorPlayerId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(groupGuests.id, guestId),
          eq(groupGuests.groupId, groupId),
          sql`${groupGuests.status} <> 'DELETED'`,
        ),
      )
      .returning({ id: groupGuests.id });
    if (result.length === 0) this.notFound();
  }

  async getPolicy(actorPlayerId: string, groupId: string) {
    await this.requireCapability(actorPlayerId, groupId, "GROUP_READ");
    const [group] = await this.database
      .select({
        guestsEnabled: groups.guestsEnabled,
        defaultGuestAllowancePerMember: groups.defaultGuestAllowancePerMember,
        guestAllowanceOverride: groupMemberships.guestAllowanceOverride,
        role: groupMemberships.role,
        capabilities: groupMemberships.capabilities,
      })
      .from(groups)
      .innerJoin(
        groupMemberships,
        and(
          eq(groupMemberships.groupId, groups.id),
          eq(groupMemberships.playerId, actorPlayerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .where(eq(groups.id, groupId))
      .limit(1);
    if (!group)
      throw new ApplicationError("group_not_found", "Group not found", 404);
    const canOverride =
      group.role === "OWNER" ||
      hasGroupCapability(
        group.role,
        group.capabilities,
        "MATCH_GUEST_OVERRIDE",
      );
    return {
      guestsEnabled: group.guestsEnabled,
      defaultGuestAllowancePerMember: group.defaultGuestAllowancePerMember,
      effectiveAllowance: canOverride
        ? null
        : (group.guestAllowanceOverride ??
          group.defaultGuestAllowancePerMember),
      canOverride,
    };
  }

  async updatePolicy(
    actorPlayerId: string,
    groupId: string,
    patch: { guestsEnabled?: boolean; defaultGuestAllowancePerMember?: number },
  ) {
    await this.requireCapability(
      actorPlayerId,
      groupId,
      "GROUP_MANAGE_GUEST_POLICY",
    );
    await this.database
      .update(groups)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(groups.id, groupId));
  }

  async updateAllowance(
    actorPlayerId: string,
    groupId: string,
    targetPlayerId: string,
    override: number | null,
  ) {
    await this.requireCapability(
      actorPlayerId,
      groupId,
      "GROUP_MANAGE_GUEST_POLICY",
    );
    const updated = await this.database
      .update(groupMemberships)
      .set({ guestAllowanceOverride: override, updatedAt: new Date() })
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.playerId, targetPlayerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .returning({ id: groupMemberships.id });
    if (updated.length === 0)
      throw new ApplicationError(
        "membership_not_found",
        "Active membership not found",
        404,
      );
  }

  private async setStatus(
    actorPlayerId: string,
    groupId: string,
    guestId: string,
    status: "ARCHIVED",
  ) {
    await this.requireCapability(actorPlayerId, groupId, "GROUP_MANAGE_GUESTS");
    const updated = await this.database
      .update(groupGuests)
      .set({
        status,
        archivedAt: new Date(),
        archivedByPlayerId: actorPlayerId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(groupGuests.id, guestId),
          eq(groupGuests.groupId, groupId),
          eq(groupGuests.status, "ACTIVE"),
        ),
      )
      .returning({ id: groupGuests.id });
    if (updated.length === 0) this.notFound();
  }

  private async requireCapability(
    playerId: string,
    groupId: string,
    capability: GroupCapability,
  ) {
    const [membership] = await this.database
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
    return membership;
  }

  private notFound(): never {
    throw new ApplicationError("guest_not_found", "Guest not found", 404);
  }

  private isUniqueViolation(error: unknown) {
    let current = error;
    while (typeof current === "object" && current !== null) {
      if ("code" in current && current.code === "23505") return true;
      if (!("cause" in current)) break;
      current = current.cause;
    }
    return false;
  }
}
