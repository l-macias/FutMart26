import { and, eq, or, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  groupConnectionInvitations,
  groupMemberships,
  matchPlayerInvitations,
  matches,
  notifications,
  playerConnections,
  playerFootballPreferences,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { GroupService } from "../groups/group-service.js";
import { PlayerMediaService } from "../media/player-media-service.js";

export class AccountDeletionService {
  constructor(
    private readonly database: Database,
    private readonly groups: GroupService,
    private readonly media: PlayerMediaService,
  ) {}

  async anonymizeBeforeAuthDeletion(authUserId: string) {
    const [player] = await this.database
      .select({ id: players.id, accountStatus: players.accountStatus })
      .from(players)
      .where(eq(players.authUserId, authUserId))
      .limit(1);
    if (!player || player.accountStatus === "ANONYMIZED") return;

    const memberships = await this.database
      .select({
        groupId: groupMemberships.groupId,
        role: groupMemberships.role,
      })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.playerId, player.id),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      );
    await this.preflightOwnership(player.id, memberships);
    for (const membership of memberships)
      await this.groups.leave(player.id, membership.groupId);

    await this.media.removeAvatar(player.id);
    const now = new Date();
    await this.database.transaction(async (tx) => {
      await tx
        .delete(playerConnections)
        .where(
          or(
            eq(playerConnections.playerLowId, player.id),
            eq(playerConnections.playerHighId, player.id),
          ),
        );
      await tx
        .delete(groupConnectionInvitations)
        .where(
          or(
            eq(groupConnectionInvitations.invitedPlayerId, player.id),
            eq(groupConnectionInvitations.invitedByPlayerId, player.id),
          ),
        );
      await tx
        .delete(matchPlayerInvitations)
        .where(
          or(
            eq(matchPlayerInvitations.invitedPlayerId, player.id),
            eq(matchPlayerInvitations.invitedByPlayerId, player.id),
          ),
        );
      await tx
        .delete(notifications)
        .where(eq(notifications.recipientPlayerId, player.id));
      await tx
        .delete(playerFootballPreferences)
        .where(eq(playerFootballPreferences.playerId, player.id));
      await tx
        .update(players)
        .set({
          displayName: "Jugador eliminado",
          dateOfBirth: null,
          profileVisibility: "PRIVATE",
          accountStatus: "ANONYMIZED",
          anonymizedAt: now,
          avatarMediaAssetId: null,
          updatedAt: now,
        })
        .where(eq(players.id, player.id));
    });
  }

  private async preflightOwnership(
    playerId: string,
    memberships: Array<{ groupId: string; role: string }>,
  ) {
    for (const membership of memberships.filter(
      (item) => item.role === "OWNER",
    )) {
      const result = await this.database.execute<{
        other_members: number;
        active_matches: number;
      }>(sql`
        select
          (select count(*)::int from ${groupMemberships}
            where ${groupMemberships.groupId} = ${membership.groupId}
              and ${groupMemberships.status} = 'ACTIVE'
              and ${groupMemberships.playerId} <> ${playerId}) as other_members,
          (select count(*)::int from ${matches}
            where ${matches.groupId} = ${membership.groupId}
              and ${matches.status} in ('DRAFT', 'OPEN', 'STARTED')) as active_matches
      `);
      const row = Array.from(result)[0];
      if (
        Number(row?.other_members ?? 0) === 0 &&
        Number(row?.active_matches ?? 0) > 0
      )
        throw new ApplicationError(
          "account_deletion_requires_group_resolution",
          "Resolve active matches or transfer group ownership first",
          409,
        );
    }
  }
}
