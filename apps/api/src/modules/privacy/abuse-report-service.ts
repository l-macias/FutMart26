import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  abuseReports,
  groupMemberships,
  groups,
  matchParticipants,
  matches,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";

type ReportInput = {
  targetType: "PLAYER" | "GROUP" | "MATCH";
  targetId: string;
  reason:
    | "HARASSMENT"
    | "INAPPROPRIATE_CONTENT"
    | "IMPERSONATION"
    | "SPAM"
    | "SAFETY"
    | "OTHER";
  comment?: string | null;
};

export class AbuseReportLimiter {
  private readonly attempts = new Map<string, number[]>();
  consume(playerId: string, now = Date.now()) {
    const active = (this.attempts.get(playerId) ?? []).filter(
      (timestamp) => timestamp > now - 60 * 60_000,
    );
    if (active.length >= 5) return false;
    active.push(now);
    this.attempts.set(playerId, active);
    return true;
  }
}

export class AbuseReportService {
  constructor(
    private readonly database: Database,
    private readonly limiter = new AbuseReportLimiter(),
  ) {}

  async create(reporterPlayerId: string, input: ReportInput) {
    if (!this.limiter.consume(reporterPlayerId))
      throw new ApplicationError(
        "report_rate_limited",
        "Too many reports",
        429,
      );
    await this.requireVisibleTarget(reporterPlayerId, input);
    const [report] = await this.database
      .insert(abuseReports)
      .values({
        id: randomUUID(),
        reporterPlayerId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        comment: input.comment?.trim() || null,
      })
      .returning({ id: abuseReports.id, status: abuseReports.status });
    return report!;
  }

  private async requireVisibleTarget(
    reporterPlayerId: string,
    input: ReportInput,
  ) {
    if (input.targetType === "PLAYER") {
      if (input.targetId === reporterPlayerId)
        throw new ApplicationError(
          "invalid_report_target",
          "Invalid report target",
          400,
        );
      const [target] = await this.database
        .select({ id: players.id })
        .from(players)
        .where(
          and(
            eq(players.id, input.targetId),
            eq(players.accountStatus, "ACTIVE"),
          ),
        )
        .limit(1);
      if (!target) throw this.notFound();
      return;
    }
    if (input.targetType === "GROUP") {
      const [target] = await this.database
        .select({ id: groups.id })
        .from(groups)
        .leftJoin(
          groupMemberships,
          and(
            eq(groupMemberships.groupId, groups.id),
            eq(groupMemberships.playerId, reporterPlayerId),
            eq(groupMemberships.status, "ACTIVE"),
          ),
        )
        .where(
          and(
            eq(groups.id, input.targetId),
            or(
              eq(groups.visibility, "PUBLIC"),
              eq(groupMemberships.playerId, reporterPlayerId),
            ),
          ),
        )
        .limit(1);
      if (!target) throw this.notFound();
      return;
    }
    const [target] = await this.database
      .select({ id: matches.id })
      .from(matches)
      .leftJoin(
        groupMemberships,
        and(
          eq(groupMemberships.groupId, matches.groupId),
          eq(groupMemberships.playerId, reporterPlayerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .leftJoin(
        matchParticipants,
        and(
          eq(matchParticipants.matchId, matches.id),
          eq(matchParticipants.playerId, reporterPlayerId),
        ),
      )
      .where(
        and(
          eq(matches.id, input.targetId),
          or(
            eq(groupMemberships.playerId, reporterPlayerId),
            eq(matchParticipants.playerId, reporterPlayerId),
          ),
        ),
      )
      .limit(1);
    if (!target) throw this.notFound();
  }

  private notFound() {
    return new ApplicationError(
      "report_target_not_found",
      "Report target not found",
      404,
    );
  }
}
