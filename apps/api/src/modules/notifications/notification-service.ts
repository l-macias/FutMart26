import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { NotificationListResponse } from "@football/contracts";
import { idSchema } from "@football/contracts";
import type { Database } from "@football/database";
import {
  groups,
  groupConnectionInvitations,
  matchAwards,
  matchParticipants,
  matchSportingResults,
  matches,
  matchPlayerInvitations,
  notifications,
  playerConnections,
  players,
  playerAchievements,
  progressionSnapshots,
  votingBallots,
  votingSessions,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { votingClosesAt, votingOpensAt } from "../voting/voting-window.js";

const RECONCILIATION_LIMIT = 100;
const cursorSchema = z
  .object({
    version: z.literal(1),
    createdAt: z.iso.datetime(),
    id: idSchema,
  })
  .strict();

type NotificationCursor = z.infer<typeof cursorSchema>;
type NotificationInsert = typeof notifications.$inferInsert;

export class NotificationService {
  constructor(
    private readonly database: Database,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(
    actorPlayerId: string,
    input: { limit: number; cursor?: string },
  ): Promise<NotificationListResponse> {
    await this.reconcile(actorPlayerId);
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    const cursorCondition = cursor
      ? or(
          lt(notifications.createdAt, new Date(cursor.createdAt)),
          and(
            eq(notifications.createdAt, new Date(cursor.createdAt)),
            lt(notifications.id, cursor.id),
          ),
        )
      : undefined;
    const rows = await this.database
      .select({
        notification: notifications,
        groupName: groups.name,
        displayName: players.displayName,
      })
      .from(notifications)
      .leftJoin(matches, eq(matches.id, notifications.matchId))
      .leftJoin(
        groups,
        eq(
          groups.id,
          sql<string>`coalesce(${notifications.groupId}, ${matches.groupId})`,
        ),
      )
      .leftJoin(players, eq(players.id, notifications.relatedPlayerId))
      .where(
        and(
          eq(notifications.recipientPlayerId, actorPlayerId),
          cursorCondition,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    return {
      items: page.map(({ notification, groupName, displayName }) =>
        present(notification, groupName, displayName),
      ),
      nextCursor:
        rows.length > input.limit && page.length > 0
          ? encodeCursor({
              version: 1,
              createdAt: page.at(-1)!.notification.createdAt.toISOString(),
              id: page.at(-1)!.notification.id,
            })
          : null,
    };
  }

  async unreadCount(actorPlayerId: string) {
    await this.reconcile(actorPlayerId);
    const [row] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientPlayerId, actorPlayerId),
          isNull(notifications.readAt),
        ),
      );
    return { count: row?.count ?? 0 };
  }

  async markRead(actorPlayerId: string, notificationId: string) {
    const now = this.clock();
    const [updated] = await this.database
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientPlayerId, actorPlayerId),
          isNull(notifications.readAt),
        ),
      )
      .returning({ readAt: notifications.readAt });
    if (updated) return { readAt: updated.readAt!.toISOString() };

    const [existing] = await this.database
      .select({ readAt: notifications.readAt })
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientPlayerId, actorPlayerId),
        ),
      )
      .limit(1);
    if (!existing)
      throw new ApplicationError(
        "notification_not_found",
        "Notification not found",
        404,
      );
    return { readAt: existing.readAt!.toISOString() };
  }

  async reconcile(actorPlayerId: string) {
    const [
      voting,
      progression,
      cancelled,
      achievements,
      awards,
      connections,
      groupInvites,
      matchInvites,
    ] = await Promise.all([
      this.votingCandidates(actorPlayerId),
      this.progressionCandidates(actorPlayerId),
      this.cancelledCandidates(actorPlayerId),
      this.achievementCandidates(actorPlayerId),
      this.awardCandidates(actorPlayerId),
      this.connectionCandidates(actorPlayerId),
      this.groupInvitationCandidates(actorPlayerId),
      this.matchInvitationCandidates(actorPlayerId),
    ]);
    const now = this.clock();
    const rows: NotificationInsert[] = [];

    for (const candidate of voting) {
      const startsAt = votingOpensAt(
        candidate.scheduledAt,
        candidate.durationMinutes,
        candidate.confirmedAt,
      );
      const closesAt = votingClosesAt(startsAt);
      if (
        now < startsAt ||
        now >= closesAt ||
        candidate.sessionStatus === "CLOSED" ||
        candidate.ballotId
      )
        continue;
      rows.push(
        notificationRow(
          actorPlayerId,
          "VOTING_AVAILABLE",
          candidate.matchId,
          startsAt,
        ),
      );
    }
    for (const candidate of progression)
      rows.push(
        notificationRow(
          actorPlayerId,
          "PROGRESSION_AVAILABLE",
          candidate.matchId,
          candidate.processedAt,
        ),
      );
    for (const candidate of cancelled)
      rows.push(
        notificationRow(
          actorPlayerId,
          "MATCH_CANCELLED",
          candidate.matchId,
          candidate.cancelledAt,
        ),
      );
    for (const candidate of achievements)
      rows.push(
        notificationRow(
          actorPlayerId,
          "ACHIEVEMENT_EARNED",
          candidate.matchId,
          candidate.earnedAt,
          `achievement:${candidate.type}`,
        ),
      );
    for (const candidate of awards)
      rows.push(
        notificationRow(
          actorPlayerId,
          "AWARD_EARNED",
          candidate.matchId,
          candidate.awardedAt,
          `award:${candidate.matchId}:${candidate.type}`,
        ),
      );
    for (const candidate of connections) {
      if (candidate.requesterPlayerId !== actorPlayerId)
        rows.push(
          connectionNotificationRow(
            actorPlayerId,
            "CONNECTION_REQUESTED",
            candidate.id,
            candidate.requesterPlayerId,
            candidate.requestedAt,
          ),
        );
      if (
        candidate.status === "ACCEPTED" &&
        candidate.requesterPlayerId === actorPlayerId
      )
        rows.push(
          connectionNotificationRow(
            actorPlayerId,
            "CONNECTION_ACCEPTED",
            candidate.id,
            candidate.playerLowId === actorPlayerId
              ? candidate.playerHighId
              : candidate.playerLowId,
            candidate.acceptedAt!,
          ),
        );
    }
    for (const invitation of groupInvites)
      rows.push(
        directedNotificationRow(
          actorPlayerId,
          "GROUP_INVITATION_RECEIVED",
          invitation.id,
          invitation.invitedByPlayerId,
          invitation.createdAt,
          { groupId: invitation.groupId },
        ),
      );
    for (const invitation of matchInvites)
      rows.push(
        directedNotificationRow(
          actorPlayerId,
          "MATCH_INVITATION_RECEIVED",
          invitation.id,
          invitation.invitedByPlayerId,
          invitation.createdAt,
          { matchId: invitation.matchId },
        ),
      );

    if (rows.length > 0)
      await this.database
        .insert(notifications)
        .values(rows)
        .onConflictDoNothing({ target: notifications.deduplicationKey });
  }

  async connectionRequested(
    connectionId: string,
    requesterPlayerId: string,
    recipientPlayerId: string,
    createdAt: Date,
  ) {
    await this.insertConnectionNotification(
      recipientPlayerId,
      "CONNECTION_REQUESTED",
      connectionId,
      requesterPlayerId,
      createdAt,
    );
  }

  async connectionAccepted(
    connectionId: string,
    acceptingPlayerId: string,
    recipientPlayerId: string,
    createdAt: Date,
  ) {
    await this.insertConnectionNotification(
      recipientPlayerId,
      "CONNECTION_ACCEPTED",
      connectionId,
      acceptingPlayerId,
      createdAt,
    );
  }

  private async insertConnectionNotification(
    recipientPlayerId: string,
    type: "CONNECTION_REQUESTED" | "CONNECTION_ACCEPTED",
    connectionId: string,
    relatedPlayerId: string,
    createdAt: Date,
  ) {
    await this.database
      .insert(notifications)
      .values(
        connectionNotificationRow(
          recipientPlayerId,
          type,
          connectionId,
          relatedPlayerId,
          createdAt,
        ),
      )
      .onConflictDoNothing({ target: notifications.deduplicationKey });
  }

  private votingCandidates(actorPlayerId: string) {
    return this.database
      .select({
        matchId: matches.id,
        scheduledAt: matches.scheduledAt,
        durationMinutes: matches.durationMinutes,
        confirmedAt: matchSportingResults.confirmedAt,
        sessionStatus: votingSessions.status,
        ballotId: votingBallots.id,
      })
      .from(matchParticipants)
      .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
      .innerJoin(
        matchSportingResults,
        eq(matchSportingResults.matchId, matches.id),
      )
      .leftJoin(votingSessions, eq(votingSessions.matchId, matches.id))
      .leftJoin(
        votingBallots,
        and(
          eq(votingBallots.sessionId, votingSessions.id),
          eq(votingBallots.voterPlayerId, actorPlayerId),
        ),
      )
      .where(
        and(
          eq(matchParticipants.playerId, actorPlayerId),
          eq(matchParticipants.kind, "PLAYER"),
          eq(matchParticipants.status, "CONFIRMED"),
          eq(matchParticipants.attendance, "PLAYED"),
          eq(matches.status, "FINISHED"),
          eq(matchSportingResults.status, "CONFIRMED"),
          sql`${matchSportingResults.confirmedAt} is not null`,
        ),
      )
      .orderBy(desc(matchSportingResults.confirmedAt))
      .limit(RECONCILIATION_LIMIT)
      .then((rows) =>
        rows.filter(
          (row): row is typeof row & { confirmedAt: Date } =>
            row.confirmedAt !== null,
        ),
      );
  }

  private progressionCandidates(actorPlayerId: string) {
    return this.database
      .select({
        matchId: progressionSnapshots.matchId,
        processedAt: progressionSnapshots.processedAt,
      })
      .from(progressionSnapshots)
      .where(
        and(
          eq(progressionSnapshots.playerId, actorPlayerId),
          eq(progressionSnapshots.discipline, "F5"),
        ),
      )
      .orderBy(desc(progressionSnapshots.processedAt))
      .limit(RECONCILIATION_LIMIT);
  }

  private cancelledCandidates(actorPlayerId: string) {
    return this.database
      .select({ matchId: matches.id, cancelledAt: matches.cancelledAt })
      .from(matchParticipants)
      .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
      .where(
        and(
          eq(matchParticipants.playerId, actorPlayerId),
          eq(matchParticipants.kind, "PLAYER"),
          inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
          eq(matches.status, "CANCELLED"),
          sql`${matches.cancelledAt} is not null`,
        ),
      )
      .orderBy(desc(matches.cancelledAt))
      .limit(RECONCILIATION_LIMIT)
      .then((rows) =>
        rows.filter(
          (row): row is typeof row & { cancelledAt: Date } =>
            row.cancelledAt !== null,
        ),
      );
  }

  private achievementCandidates(actorPlayerId: string) {
    return this.database
      .select({
        matchId: playerAchievements.sourceMatchId,
        type: playerAchievements.type,
        earnedAt: playerAchievements.earnedAt,
      })
      .from(playerAchievements)
      .where(eq(playerAchievements.playerId, actorPlayerId))
      .orderBy(desc(playerAchievements.earnedAt))
      .limit(RECONCILIATION_LIMIT);
  }

  private awardCandidates(actorPlayerId: string) {
    return this.database
      .select({
        matchId: matchAwards.matchId,
        type: matchAwards.type,
        awardedAt: matchAwards.awardedAt,
      })
      .from(matchAwards)
      .where(eq(matchAwards.playerId, actorPlayerId))
      .orderBy(desc(matchAwards.awardedAt))
      .limit(RECONCILIATION_LIMIT);
  }

  private connectionCandidates(actorPlayerId: string) {
    return this.database
      .select()
      .from(playerConnections)
      .where(
        or(
          eq(playerConnections.playerLowId, actorPlayerId),
          eq(playerConnections.playerHighId, actorPlayerId),
        ),
      )
      .orderBy(desc(playerConnections.updatedAt))
      .limit(RECONCILIATION_LIMIT);
  }

  private groupInvitationCandidates(actorPlayerId: string) {
    return this.database
      .select()
      .from(groupConnectionInvitations)
      .where(eq(groupConnectionInvitations.invitedPlayerId, actorPlayerId))
      .orderBy(desc(groupConnectionInvitations.createdAt))
      .limit(RECONCILIATION_LIMIT);
  }

  private matchInvitationCandidates(actorPlayerId: string) {
    return this.database
      .select()
      .from(matchPlayerInvitations)
      .where(eq(matchPlayerInvitations.invitedPlayerId, actorPlayerId))
      .orderBy(desc(matchPlayerInvitations.createdAt))
      .limit(RECONCILIATION_LIMIT);
  }
}

function notificationRow(
  recipientPlayerId: string,
  type: typeof notifications.$inferInsert.type,
  matchId: string,
  createdAt: Date,
  eventKey = matchId,
): NotificationInsert {
  return {
    id: randomUUID(),
    recipientPlayerId,
    type,
    matchId,
    deduplicationKey: `${type.toLowerCase()}:${eventKey}:${recipientPlayerId}`,
    createdAt,
  };
}

function connectionNotificationRow(
  recipientPlayerId: string,
  type: "CONNECTION_REQUESTED" | "CONNECTION_ACCEPTED",
  connectionId: string,
  relatedPlayerId: string,
  createdAt: Date,
): NotificationInsert {
  return {
    id: randomUUID(),
    recipientPlayerId,
    type,
    relatedPlayerId,
    deduplicationKey: `${type.toLowerCase()}:${connectionId}:${recipientPlayerId}`,
    createdAt,
  };
}

function directedNotificationRow(
  recipientPlayerId: string,
  type: "GROUP_INVITATION_RECEIVED" | "MATCH_INVITATION_RECEIVED",
  invitationId: string,
  relatedPlayerId: string,
  createdAt: Date,
  target: { groupId: string } | { matchId: string },
): NotificationInsert {
  return {
    id: randomUUID(),
    recipientPlayerId,
    type,
    relatedPlayerId,
    ...target,
    deduplicationKey: `${type.toLowerCase()}:${invitationId}:${recipientPlayerId}`,
    createdAt,
  };
}

function present(
  notification: typeof notifications.$inferSelect,
  groupName: string | null,
  relatedPlayerName: string | null,
): NotificationListResponse["items"][number] {
  const copy = {
    VOTING_AVAILABLE: {
      title: "Ya podés votar",
      body: `${groupName} · Evaluá a quienes jugaron.`,
      path: "voting",
    },
    PROGRESSION_AVAILABLE: {
      title: "Tu progreso está listo",
      body: `${groupName} · Revisá cómo cambió tu rendimiento.`,
      path: "progression",
    },
    MATCH_CANCELLED: {
      title: "Partido cancelado",
      body: `${groupName} · La convocatoria fue cancelada.`,
      path: null,
    },
    ACHIEVEMENT_EARNED: {
      title: "Nuevo logro",
      body: `${groupName} · Sumaste un nuevo hito a tu carrera.`,
      path: null,
    },
    AWARD_EARNED: {
      title: "Premio del partido",
      body: `${groupName} · Recibiste un reconocimiento por tu rendimiento.`,
      path: "progression",
    },
    CONNECTION_REQUESTED: {
      title: "Nueva solicitud de conexión",
      body: `${relatedPlayerName ?? "Un jugador"} quiere conectar con vos.`,
      path: null,
    },
    CONNECTION_ACCEPTED: {
      title: "Conexión aceptada",
      body: `${relatedPlayerName ?? "Un jugador"} aceptó tu solicitud.`,
      path: null,
    },
    GROUP_INVITATION_RECEIVED: {
      title: "Invitación a un grupo",
      body: `${relatedPlayerName ?? "Un jugador"} te invitó a ${groupName ?? "un grupo"}.`,
      path: null,
    },
    MATCH_INVITATION_RECEIVED: {
      title: "Invitación a un partido",
      body: `${relatedPlayerName ?? "Un jugador"} te invitó a jugar con ${groupName ?? "su grupo"}.`,
      path: null,
    },
  }[notification.type];
  return {
    id: notification.id,
    type: notification.type,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
    title: copy.title,
    body: copy.body,
    target: {
      href:
        notification.type === "CONNECTION_REQUESTED"
          ? "/connections"
          : notification.type === "CONNECTION_ACCEPTED"
            ? `/players/${notification.relatedPlayerId}`
            : notification.type === "GROUP_INVITATION_RECEIVED" ||
                notification.type === "MATCH_INVITATION_RECEIVED"
              ? "/invitations"
              : notification.type === "ACHIEVEMENT_EARNED"
                ? "/profile"
                : `/play/matches/${notification.matchId}${copy.path ? `/${copy.path}` : ""}`,
    },
  };
}

function encodeCursor(cursor: NotificationCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): NotificationCursor {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new ApplicationError(
      "invalid_cursor",
      "Invalid notification cursor",
      400,
    );
  }
}
