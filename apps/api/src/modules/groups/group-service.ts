import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "@football/database";
import {
  groupMemberships,
  groupRoleChanges,
  groups,
  players,
} from "@football/database/schema";
import { ApplicationError } from "../errors.js";
import {
  groupCapabilities,
  type GroupCapability,
  hasGroupCapability,
} from "./capabilities.js";

type MembershipRole = "OWNER" | "MODERATOR" | "MEMBER";
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | Transaction;

export class GroupService {
  constructor(private readonly database: Database) {}

  async create(actorPlayerId: string, name: string) {
    return this.database.transaction(async (tx) => {
      const groupId = randomUUID();
      const membershipId = randomUUID();
      const [group] = await tx
        .insert(groups)
        .values({ id: groupId, name, createdByPlayerId: actorPlayerId })
        .returning();
      await tx.insert(groupMemberships).values({
        id: membershipId,
        groupId,
        playerId: actorPlayerId,
        role: "OWNER",
      });
      return {
        ...group!,
        role: "OWNER" as const,
        capabilities: groupCapabilities("OWNER", []),
      };
    });
  }

  async listForPlayer(playerId: string) {
    const memberships = await this.database
      .select({
        id: groups.id,
        name: groups.name,
        status: groups.status,
        role: groupMemberships.role,
        capabilities: groupMemberships.capabilities,
      })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(
        and(
          eq(groupMemberships.playerId, playerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(groupMemberships.joinedAt))
      .limit(100);
    return memberships.map((membership) => ({
      ...membership,
      capabilities: groupCapabilities(membership.role, membership.capabilities),
    }));
  }

  async get(actorPlayerId: string, groupId: string) {
    const membership = await this.requireCapability(
      this.database,
      actorPlayerId,
      groupId,
      "GROUP_READ",
    );
    const [group] = await this.database
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);
    if (!group)
      throw new ApplicationError("group_not_found", "Group not found", 404);
    return {
      id: group.id,
      name: group.name,
      status: group.status,
      role: membership.role,
      capabilities: groupCapabilities(membership.role, membership.capabilities),
    };
  }

  async members(actorPlayerId: string, groupId: string) {
    await this.requireCapability(
      this.database,
      actorPlayerId,
      groupId,
      "GROUP_READ",
    );
    const memberships = await this.database
      .select({
        id: groupMemberships.id,
        role: groupMemberships.role,
        capabilities: groupMemberships.capabilities,
        status: groupMemberships.status,
        joinedAt: groupMemberships.joinedAt,
        playerId: players.id,
        displayName: players.displayName,
      })
      .from(groupMemberships)
      .innerJoin(players, eq(players.id, groupMemberships.playerId))
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(groupMemberships.joinedAt), asc(groupMemberships.id))
      .limit(500);
    return memberships.map((membership) => ({
      ...membership,
      capabilities: groupCapabilities(membership.role, membership.capabilities),
    }));
  }

  async changeModerator(
    actorPlayerId: string,
    groupId: string,
    targetPlayerId: string,
    nextRole: "MODERATOR" | "MEMBER",
  ) {
    return this.database.transaction(async (tx) => {
      await this.lockActiveGroup(tx, groupId);
      await this.requireCapability(
        tx,
        actorPlayerId,
        groupId,
        "GROUP_MANAGE_MODERATORS",
      );
      const target = await this.requireActiveMembership(
        tx,
        targetPlayerId,
        groupId,
      );
      if (target.role === "OWNER" || target.role === nextRole)
        throw new ApplicationError(
          "invalid_role_transition",
          "Invalid role transition",
          409,
        );
      await tx
        .update(groupMemberships)
        .set({
          role: nextRole,
          capabilities:
            nextRole === "MODERATOR" ? ["GROUP_MANAGE_MEMBERS"] : [],
          roleGrantedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(groupMemberships.id, target.id));
      await this.recordRoleChange(
        tx,
        groupId,
        target.id,
        actorPlayerId,
        target.role,
        nextRole,
      );
    });
  }

  async transferOwnership(
    actorPlayerId: string,
    groupId: string,
    targetPlayerId: string,
  ) {
    return this.database.transaction(async (tx) => {
      await this.lockActiveGroup(tx, groupId);
      const actor = await this.requireCapability(
        tx,
        actorPlayerId,
        groupId,
        "GROUP_TRANSFER_OWNERSHIP",
      );
      const target = await this.requireActiveMembership(
        tx,
        targetPlayerId,
        groupId,
      );
      if (actor.id === target.id || actor.role !== "OWNER")
        throw new ApplicationError(
          "invalid_role_transition",
          "Target must be another active member",
          409,
        );
      const now = new Date();
      await tx
        .update(groupMemberships)
        .set({
          role: "MEMBER",
          capabilities: [],
          roleGrantedAt: now,
          updatedAt: now,
        })
        .where(eq(groupMemberships.id, actor.id));
      await tx
        .update(groupMemberships)
        .set({
          role: "OWNER",
          capabilities: [],
          roleGrantedAt: now,
          updatedAt: now,
        })
        .where(eq(groupMemberships.id, target.id));
      await this.recordRoleChange(
        tx,
        groupId,
        actor.id,
        actorPlayerId,
        "OWNER",
        "MEMBER",
      );
      await this.recordRoleChange(
        tx,
        groupId,
        target.id,
        actorPlayerId,
        target.role,
        "OWNER",
      );
    });
  }

  async leave(actorPlayerId: string, groupId: string) {
    return this.database.transaction(async (tx) => {
      await this.lockActiveGroup(tx, groupId);
      const actor = await this.requireActiveMembership(
        tx,
        actorPlayerId,
        groupId,
      );
      if (actor.role !== "OWNER")
        return this.endMembership(tx, actor.id, "LEFT");
      const candidates = await tx
        .select()
        .from(groupMemberships)
        .where(
          and(
            eq(groupMemberships.groupId, groupId),
            eq(groupMemberships.status, "ACTIVE"),
            sql`${groupMemberships.id} <> ${actor.id}`,
          ),
        )
        .orderBy(
          sql`case when ${groupMemberships.role} = 'MODERATOR' then 0 else 1 end`,
          sql`case when ${groupMemberships.role} = 'MODERATOR' then ${groupMemberships.roleGrantedAt} end asc`,
          asc(groupMemberships.joinedAt),
          asc(groupMemberships.id),
        )
        .limit(1);
      const successor = candidates[0];
      await this.endMembership(tx, actor.id, "LEFT");
      if (!successor) {
        await tx
          .update(groups)
          .set({ status: "ARCHIVED", updatedAt: new Date() })
          .where(eq(groups.id, groupId));
        return;
      }
      await tx
        .update(groupMemberships)
        .set({
          role: "OWNER",
          capabilities: [],
          roleGrantedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(groupMemberships.id, successor.id));
      await this.recordRoleChange(
        tx,
        groupId,
        successor.id,
        actorPlayerId,
        successor.role,
        "OWNER",
      );
    });
  }

  async remove(actorPlayerId: string, groupId: string, targetPlayerId: string) {
    return this.database.transaction(async (tx) => {
      await this.lockActiveGroup(tx, groupId);
      const actor = await this.requireCapability(
        tx,
        actorPlayerId,
        groupId,
        "GROUP_MANAGE_MEMBERS",
      );
      const target = await this.requireActiveMembership(
        tx,
        targetPlayerId,
        groupId,
      );
      if (target.role === "OWNER" || actor.id === target.id)
        throw new ApplicationError(
          "ownership_invariant_violation",
          "Owner cannot be removed",
          409,
        );
      await this.endMembership(tx, target.id, "REMOVED");
    });
  }

  private async lockActiveGroup(db: DatabaseExecutor, groupId: string) {
    const result = await db.execute(
      sql`select id from ${groups} where id = ${groupId} and status = 'ACTIVE' for update`,
    );
    if (result.length === 0)
      throw new ApplicationError(
        "group_not_found",
        "Active group not found",
        404,
      );
  }

  private async requireActiveMembership(
    db: DatabaseExecutor,
    playerId: string,
    groupId: string,
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
    if (!membership)
      throw new ApplicationError(
        "membership_not_found",
        "Active membership not found",
        404,
      );
    return membership;
  }

  private async requireCapability(
    db: DatabaseExecutor,
    playerId: string,
    groupId: string,
    capability: GroupCapability,
  ) {
    const membership = await this.requireActiveMembership(
      db,
      playerId,
      groupId,
    );
    if (
      !hasGroupCapability(membership.role, membership.capabilities, capability)
    )
      throw new ApplicationError("forbidden", "Forbidden", 403);
    return membership;
  }

  private async endMembership(
    db: DatabaseExecutor,
    membershipId: string,
    status: "LEFT" | "REMOVED",
  ) {
    await db
      .update(groupMemberships)
      .set({ status, endedAt: new Date(), updatedAt: new Date() })
      .where(eq(groupMemberships.id, membershipId));
  }

  private async recordRoleChange(
    db: DatabaseExecutor,
    groupId: string,
    membershipId: string,
    actorPlayerId: string,
    previousRole: MembershipRole,
    nextRole: MembershipRole,
  ) {
    await db.insert(groupRoleChanges).values({
      id: randomUUID(),
      groupId,
      membershipId,
      changedByPlayerId: actorPlayerId,
      previousRole,
      nextRole,
    });
  }
}
