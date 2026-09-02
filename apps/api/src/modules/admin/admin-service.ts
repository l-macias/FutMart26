import { randomUUID } from "node:crypto";

import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  abuseReports,
  accountSuspensions,
  adminAuditEvents,
  adminGrants,
  authSession,
  authUser,
  groupConnectionInvitations,
  groupInvitations,
  groupMemberships,
  groups,
  matchPlayerInvitations,
  matchParticipants,
  matchSportingResults,
  matchTeamAssignments,
  matches,
  players,
  progressionSnapshots,
  votingBallots,
  votingSessions,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import type { PlayerMediaService } from "../media/player-media-service.js";

type AuditAction = typeof adminAuditEvents.$inferInsert.action;
type TargetType = typeof adminAuditEvents.$inferInsert.targetType;

export class AdminService {
  constructor(
    private readonly database: Database,
    private readonly media: PlayerMediaService,
  ) {}

  async requireAdmin(authUserId: string) {
    const [grant] = await this.database
      .select({ role: adminGrants.role })
      .from(adminGrants)
      .where(eq(adminGrants.authUserId, authUserId))
      .limit(1);
    if (!grant)
      throw new ApplicationError(
        "admin_required",
        "Admin access required",
        403,
      );
    return grant;
  }

  async isSuspended(authUserId: string) {
    const [row] = await this.database
      .select({ id: accountSuspensions.id })
      .from(accountSuspensions)
      .where(
        and(
          eq(accountSuspensions.authUserId, authUserId),
          isNull(accountSuspensions.reactivatedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async search(input: { q: string; limit: number }) {
    const q = input.q.trim();
    const uuidLike = /^[0-9a-f-]{36}$/i.test(q);
    const [playerRows, groupRows, matchRows] = await Promise.all([
      this.database
        .select({
          id: players.id,
          displayName: players.displayName,
          email: authUser.email,
          accountStatus: players.accountStatus,
          suspensionId: accountSuspensions.id,
        })
        .from(players)
        .leftJoin(authUser, eq(authUser.id, players.authUserId))
        .leftJoin(
          accountSuspensions,
          and(
            eq(accountSuspensions.authUserId, players.authUserId),
            isNull(accountSuspensions.reactivatedAt),
          ),
        )
        .where(
          or(
            ilike(players.displayName, `%${escapeLike(q)}%`),
            ilike(authUser.email, `${escapeLike(q)}%`),
            ...(uuidLike ? [eq(players.id, q)] : []),
          ),
        )
        .orderBy(players.displayName, players.id)
        .limit(input.limit),
      this.database
        .select({ id: groups.id, name: groups.name, status: groups.status })
        .from(groups)
        .where(
          or(
            ilike(groups.name, `%${escapeLike(q)}%`),
            ...(uuidLike ? [eq(groups.id, q)] : []),
          ),
        )
        .orderBy(groups.name, groups.id)
        .limit(input.limit),
      uuidLike
        ? this.database
            .select({
              id: matches.id,
              groupId: matches.groupId,
              groupName: groups.name,
              status: matches.status,
              scheduledAt: matches.scheduledAt,
            })
            .from(matches)
            .innerJoin(groups, eq(groups.id, matches.groupId))
            .where(eq(matches.id, q))
            .limit(input.limit)
        : Promise.resolve([]),
    ]);
    return {
      players: playerRows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        accountStatus: row.accountStatus,
        suspended: Boolean(row.suspensionId),
      })),
      groups: groupRows,
      matches: matchRows.map((row) => ({
        ...row,
        scheduledAt: row.scheduledAt.toISOString(),
      })),
    };
  }

  async player(playerId: string) {
    const [row] = await this.database
      .select({
        id: players.id,
        displayName: players.displayName,
        dateOfBirth: players.dateOfBirth,
        profileVisibility: players.profileVisibility,
        accountStatus: players.accountStatus,
        avatarMediaAssetId: players.avatarMediaAssetId,
        authUserId: players.authUserId,
        email: authUser.email,
        emailVerified: authUser.emailVerified,
        suspensionId: accountSuspensions.id,
        suspensionReason: accountSuspensions.reason,
        suspendedAt: accountSuspensions.suspendedAt,
      })
      .from(players)
      .leftJoin(authUser, eq(authUser.id, players.authUserId))
      .leftJoin(
        accountSuspensions,
        and(
          eq(accountSuspensions.authUserId, players.authUserId),
          isNull(accountSuspensions.reactivatedAt),
        ),
      )
      .where(eq(players.id, playerId))
      .limit(1);
    if (!row) this.notFound();
    const [groupsSummary, reports] = await Promise.all([
      this.database
        .select({
          id: groups.id,
          name: groups.name,
          role: groupMemberships.role,
        })
        .from(groupMemberships)
        .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
        .where(
          and(
            eq(groupMemberships.playerId, playerId),
            eq(groupMemberships.status, "ACTIVE"),
          ),
        )
        .limit(20),
      this.database
        .select({ count: sql<number>`count(*)::int` })
        .from(abuseReports)
        .where(
          and(
            eq(abuseReports.targetType, "PLAYER"),
            eq(abuseReports.targetId, playerId),
            eq(abuseReports.status, "OPEN"),
          ),
        ),
    ]);
    return {
      ...row,
      suspended: Boolean(row.suspensionId),
      suspendedAt: row.suspendedAt?.toISOString() ?? null,
      groups: groupsSummary,
      openReportCount: reports[0]?.count ?? 0,
    };
  }

  async group(groupId: string) {
    const [row] = await this.database
      .select({
        id: groups.id,
        name: groups.name,
        status: groups.status,
        visibility: groups.visibility,
        ownerId: players.id,
        ownerName: players.displayName,
      })
      .from(groups)
      .leftJoin(
        groupMemberships,
        and(
          eq(groupMemberships.groupId, groups.id),
          eq(groupMemberships.status, "ACTIVE"),
          eq(groupMemberships.role, "OWNER"),
        ),
      )
      .leftJoin(players, eq(players.id, groupMemberships.playerId))
      .where(eq(groups.id, groupId))
      .limit(1);
    if (!row) this.notFound();
    const [counts] = await this.database
      .select({
        members: sql<number>`count(distinct ${groupMemberships.id}) filter (where ${groupMemberships.status} = 'ACTIVE')::int`,
        activeMatches: sql<number>`count(distinct ${matches.id}) filter (where ${matches.status} in ('DRAFT','OPEN','STARTED'))::int`,
      })
      .from(groups)
      .leftJoin(groupMemberships, eq(groupMemberships.groupId, groups.id))
      .leftJoin(matches, eq(matches.groupId, groups.id))
      .where(eq(groups.id, groupId));
    return { ...row, ...(counts ?? { members: 0, activeMatches: 0 }) };
  }

  async match(matchId: string) {
    const [row] = await this.database
      .select({
        match: matches,
        groupName: groups.name,
        votingSessionId: votingSessions.id,
      })
      .from(matches)
      .innerJoin(groups, eq(groups.id, matches.groupId))
      .leftJoin(votingSessions, eq(votingSessions.matchId, matches.id))
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!row) this.notFound();
    const [snapshots, participants, teams, result] = await Promise.all([
      this.database
        .select({ id: progressionSnapshots.id })
        .from(progressionSnapshots)
        .where(eq(progressionSnapshots.matchId, matchId))
        .limit(1),
      this.database
        .select({
          id: matchParticipants.id,
          kind: matchParticipants.kind,
          playerId: matchParticipants.playerId,
          displayName: players.displayName,
          guestDisplayName: matchParticipants.guestDisplayName,
          status: matchParticipants.status,
          attendance: matchParticipants.attendance,
        })
        .from(matchParticipants)
        .leftJoin(players, eq(players.id, matchParticipants.playerId))
        .where(eq(matchParticipants.matchId, matchId))
        .orderBy(matchParticipants.admissionOrder)
        .limit(100),
      this.database
        .select({
          participantId: matchTeamAssignments.participantId,
          side: matchTeamAssignments.side,
          source: matchTeamAssignments.source,
        })
        .from(matchTeamAssignments)
        .where(eq(matchTeamAssignments.matchId, matchId))
        .limit(100),
      this.database
        .select()
        .from(matchSportingResults)
        .where(eq(matchSportingResults.matchId, matchId))
        .limit(1),
    ]);
    return {
      ...row.match,
      scheduledAt: row.match.scheduledAt.toISOString(),
      groupName: row.groupName,
      closureEditable: row.match.status === "FINISHED" && !row.votingSessionId,
      progressionMaterialized: snapshots.length > 0,
      participants,
      teams,
      result: result[0] ?? null,
    };
  }

  async reports(
    status: "OPEN" | "RESOLVED" | "DISMISSED" = "OPEN",
    targetType?: "PLAYER" | "GROUP" | "MATCH",
    reason?: typeof abuseReports.$inferSelect.reason,
  ) {
    const rows = await this.database
      .select({ report: abuseReports, reporterName: players.displayName })
      .from(abuseReports)
      .innerJoin(players, eq(players.id, abuseReports.reporterPlayerId))
      .where(
        and(
          eq(abuseReports.status, status),
          targetType ? eq(abuseReports.targetType, targetType) : undefined,
          reason ? eq(abuseReports.reason, reason) : undefined,
        ),
      )
      .orderBy(desc(abuseReports.createdAt), desc(abuseReports.id))
      .limit(100);
    return rows.map(({ report, reporterName }) =>
      presentReport(report, reporterName),
    );
  }

  async report(reportId: string) {
    const [row] = await this.database
      .select({ report: abuseReports, reporterName: players.displayName })
      .from(abuseReports)
      .innerJoin(players, eq(players.id, abuseReports.reporterPlayerId))
      .where(eq(abuseReports.id, reportId))
      .limit(1);
    if (!row) this.notFound();
    return presentReport(row.report, row.reporterName);
  }

  async handleReport(
    actor: string,
    requestId: string,
    reportId: string,
    status: "RESOLVED" | "DISMISSED",
    input: { reason: string; resolutionNote?: string },
  ) {
    return this.database.transaction(async (tx) => {
      const [report] = await tx
        .update(abuseReports)
        .set({
          status,
          resolvedAt: new Date(),
          handledByAuthUserId: actor,
          resolutionNote: input.resolutionNote ?? null,
        })
        .where(
          and(eq(abuseReports.id, reportId), eq(abuseReports.status, "OPEN")),
        )
        .returning({ id: abuseReports.id });
      if (!report)
        throw new ApplicationError(
          "report_already_resolved",
          "Report is not open",
          409,
        );
      await this.audit(
        tx,
        actor,
        requestId,
        status === "RESOLVED" ? "REPORT_RESOLVED" : "REPORT_DISMISSED",
        "REPORT",
        reportId,
        input.reason,
      );
    });
  }

  async suspend(
    actor: string,
    requestId: string,
    playerId: string,
    reason: string,
  ) {
    return this.database.transaction(async (tx) => {
      const [player] = await tx
        .select({ authUserId: players.authUserId })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);
      if (!player?.authUserId) this.notFound();
      if (player.authUserId === actor)
        throw new ApplicationError(
          "invalid_moderation_state",
          "Cannot suspend own admin account",
          409,
        );
      const inserted = await tx
        .insert(accountSuspensions)
        .values({
          id: randomUUID(),
          authUserId: player.authUserId,
          reason,
          suspendedByAuthUserId: actor,
        })
        .onConflictDoNothing()
        .returning({ id: accountSuspensions.id });
      if (!inserted[0])
        throw new ApplicationError(
          "already_suspended",
          "Account already suspended",
          409,
        );
      await tx
        .delete(authSession)
        .where(eq(authSession.userId, player.authUserId));
      await this.audit(
        tx,
        actor,
        requestId,
        "ACCOUNT_SUSPENDED",
        "ACCOUNT",
        player.authUserId,
        reason,
        { playerId },
      );
    });
  }

  async reactivate(
    actor: string,
    requestId: string,
    playerId: string,
    reason: string,
  ) {
    return this.database.transaction(async (tx) => {
      const [player] = await tx
        .select({ authUserId: players.authUserId })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);
      if (!player?.authUserId) this.notFound();
      const [updated] = await tx
        .update(accountSuspensions)
        .set({ reactivatedAt: new Date(), reactivatedByAuthUserId: actor })
        .where(
          and(
            eq(accountSuspensions.authUserId, player.authUserId),
            isNull(accountSuspensions.reactivatedAt),
          ),
        )
        .returning({ id: accountSuspensions.id });
      if (!updated)
        throw new ApplicationError(
          "not_suspended",
          "Account is not suspended",
          409,
        );
      await this.audit(
        tx,
        actor,
        requestId,
        "ACCOUNT_REACTIVATED",
        "ACCOUNT",
        player.authUserId,
        reason,
        { playerId },
      );
    });
  }

  async moderatePlayerName(
    actor: string,
    requestId: string,
    playerId: string,
    displayName: string,
    reason: string,
  ) {
    const [updated] = await this.database
      .update(players)
      .set({ displayName, updatedAt: new Date() })
      .where(and(eq(players.id, playerId), eq(players.accountStatus, "ACTIVE")))
      .returning({ id: players.id });
    if (!updated) this.notFound();
    await this.writeAudit(
      actor,
      requestId,
      "PLAYER_NAME_MODERATED",
      "PLAYER",
      playerId,
      reason,
    );
  }

  async removeAvatar(
    actor: string,
    requestId: string,
    playerId: string,
    reason: string,
  ) {
    await this.player(playerId);
    await this.media.removeAvatar(playerId);
    await this.writeAudit(
      actor,
      requestId,
      "PLAYER_AVATAR_REMOVED",
      "PLAYER",
      playerId,
      reason,
    );
  }

  async moderateGroup(
    actor: string,
    requestId: string,
    groupId: string,
    action: "PRIVATE" | "ARCHIVE",
    reason: string,
    name?: string,
  ) {
    if (action === "ARCHIVE") {
      const [active] = await this.database
        .select({ id: matches.id })
        .from(matches)
        .where(
          and(
            eq(matches.groupId, groupId),
            sql`${matches.status} in ('DRAFT','OPEN','STARTED')`,
          ),
        )
        .limit(1);
      if (active)
        throw new ApplicationError(
          "active_matches_prevent_archive",
          "Active matches prevent archive",
          409,
        );
    }
    const values =
      action === "PRIVATE"
        ? { visibility: "PRIVATE" as const, updatedAt: new Date() }
        : { status: "ARCHIVED" as const, updatedAt: new Date() };
    const [updated] = await this.database
      .update(groups)
      .set(values)
      .where(eq(groups.id, groupId))
      .returning({ id: groups.id });
    if (!updated) this.notFound();
    await this.writeAudit(
      actor,
      requestId,
      action === "PRIVATE" ? "GROUP_FORCED_PRIVATE" : "GROUP_ARCHIVED",
      "GROUP",
      groupId,
      reason,
    );
    if (name)
      await this.moderateGroupName(actor, requestId, groupId, name, reason);
  }

  async moderateGroupName(
    actor: string,
    requestId: string,
    groupId: string,
    name: string,
    reason: string,
  ) {
    const [updated] = await this.database
      .update(groups)
      .set({ name, updatedAt: new Date() })
      .where(eq(groups.id, groupId))
      .returning({ id: groups.id });
    if (!updated) this.notFound();
    await this.writeAudit(
      actor,
      requestId,
      "GROUP_NAME_MODERATED",
      "GROUP",
      groupId,
      reason,
    );
  }

  async cancelMatch(
    actor: string,
    requestId: string,
    matchId: string,
    reason: string,
  ) {
    const [updated] = await this.database
      .update(matches)
      .set({
        status: "CANCELLED",
        cancelledAt: new Date(),
        recruitmentEnabled: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(matches.id, matchId),
          sql`${matches.status} in ('DRAFT','OPEN')`,
        ),
      )
      .returning({ id: matches.id });
    if (!updated)
      throw new ApplicationError(
        "invalid_moderation_state",
        "Match cannot be cancelled",
        409,
      );
    await this.writeAudit(
      actor,
      requestId,
      "MATCH_CANCELLED_BY_ADMIN",
      "MATCH",
      matchId,
      reason,
    );
  }

  async voidBallot(
    actor: string,
    requestId: string,
    ballotId: string,
    reason: string,
  ) {
    return this.database.transaction(async (tx) => {
      const [ballot] = await tx
        .select({ id: votingBallots.id, matchId: votingSessions.matchId })
        .from(votingBallots)
        .innerJoin(
          votingSessions,
          eq(votingSessions.id, votingBallots.sessionId),
        )
        .where(eq(votingBallots.id, ballotId))
        .limit(1);
      if (!ballot) this.notFound();
      const [snapshot] = await tx
        .select({ id: progressionSnapshots.id })
        .from(progressionSnapshots)
        .where(eq(progressionSnapshots.matchId, ballot.matchId))
        .limit(1);
      if (snapshot)
        throw new ApplicationError(
          "progression_already_materialized",
          "Progression already materialized",
          409,
        );
      const [updated] = await tx
        .update(votingBallots)
        .set({
          status: "VOIDED",
          voidedAt: new Date(),
          voidedByPlayerId: null,
          voidedByAuthUserId: actor,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(votingBallots.id, ballotId),
            eq(votingBallots.status, "VALID"),
          ),
        )
        .returning({ id: votingBallots.id });
      if (!updated)
        throw new ApplicationError(
          "invalid_moderation_state",
          "Ballot is not valid",
          409,
        );
      await this.audit(
        tx,
        actor,
        requestId,
        "BALLOT_VOIDED",
        "BALLOT",
        ballotId,
        reason,
        { matchId: ballot.matchId },
      );
    });
  }

  async revokeInvitation(
    actor: string,
    requestId: string,
    invitationId: string,
    kind: "GROUP_TOKEN" | "GROUP_DIRECTED" | "MATCH_DIRECTED",
    reason: string,
  ) {
    const now = new Date();
    let changed: boolean;
    if (kind === "GROUP_TOKEN") {
      changed = Boolean(
        (
          await this.database
            .update(groupInvitations)
            .set({ revokedAt: now, updatedAt: now })
            .where(
              and(
                eq(groupInvitations.id, invitationId),
                isNull(groupInvitations.revokedAt),
              ),
            )
            .returning({ id: groupInvitations.id })
        )[0],
      );
    } else if (kind === "GROUP_DIRECTED") {
      changed = Boolean(
        (
          await this.database
            .update(groupConnectionInvitations)
            .set({ status: "REVOKED", revokedAt: now, updatedAt: now })
            .where(
              and(
                eq(groupConnectionInvitations.id, invitationId),
                eq(groupConnectionInvitations.status, "PENDING"),
              ),
            )
            .returning({ id: groupConnectionInvitations.id })
        )[0],
      );
    } else {
      changed = Boolean(
        (
          await this.database
            .update(matchPlayerInvitations)
            .set({ status: "REVOKED", revokedAt: now, updatedAt: now })
            .where(
              and(
                eq(matchPlayerInvitations.id, invitationId),
                eq(matchPlayerInvitations.status, "PENDING"),
              ),
            )
            .returning({ id: matchPlayerInvitations.id })
        )[0],
      );
    }
    if (!changed)
      throw new ApplicationError(
        "invitation_not_revocable",
        "Invitation cannot be revoked",
        409,
      );
    await this.writeAudit(
      actor,
      requestId,
      "INVITATION_REVOKED",
      "INVITATION",
      invitationId,
      reason,
      { kind },
    );
  }

  async auditEvents() {
    const rows = await this.database
      .select()
      .from(adminAuditEvents)
      .orderBy(desc(adminAuditEvents.createdAt), desc(adminAuditEvents.id))
      .limit(200);
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private writeAudit(
    actor: string,
    requestId: string,
    action: AuditAction,
    targetType: TargetType,
    targetId: string,
    reason: string,
    metadata?: Record<string, string>,
  ) {
    return this.audit(
      this.database,
      actor,
      requestId,
      action,
      targetType,
      targetId,
      reason,
      metadata,
    );
  }

  private audit(
    db: Pick<Database, "insert">,
    actor: string,
    requestId: string,
    action: AuditAction,
    targetType: TargetType,
    targetId: string,
    reason: string,
    metadata?: Record<string, string>,
  ) {
    return db.insert(adminAuditEvents).values({
      id: randomUUID(),
      actorAuthUserId: actor,
      action,
      targetType,
      targetId,
      reason,
      requestId,
      metadata,
    });
  }

  private notFound(): never {
    throw new ApplicationError(
      "admin_target_not_found",
      "Target not found",
      404,
    );
  }
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function presentReport(
  report: typeof abuseReports.$inferSelect,
  reporterName: string,
) {
  return {
    id: report.id,
    status: report.status,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    comment: report.comment,
    reporter: { id: report.reporterPlayerId, displayName: reporterName },
    createdAt: report.createdAt.toISOString(),
    handledAt: report.resolvedAt?.toISOString() ?? null,
    resolutionNote: report.resolutionNote,
  };
}
