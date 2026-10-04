import type { EffectiveMatchPhase } from "@football/contracts";

import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { VOTING_V1_CONFIG } from "../voting/voting-config.js";
import { votingClosesAt, votingOpensAt } from "../voting/voting-window.js";

type MatchLifecycle = "DRAFT" | "OPEN" | "STARTED" | "FINISHED" | "CANCELLED";

export type MatchPhaseInput = {
  status: MatchLifecycle;
  scheduledAt: Date;
  durationMinutes: number;
  resultConfirmedAt?: Date | null;
  voting?: {
    status: "OPEN" | "CLOSED";
    opensAt: Date;
    closesAt: Date;
  } | null;
};

type MatchPhaseSqlInput = {
  status: SQLWrapper;
  scheduledAt: SQLWrapper;
  durationMinutes: SQLWrapper;
  resultConfirmedAt: SQLWrapper;
  votingStatus: SQLWrapper;
  votingOpensAt: SQLWrapper;
  votingClosesAt: SQLWrapper;
};

type OperationallyActiveMatchSqlInput = Pick<
  MatchPhaseSqlInput,
  "status" | "scheduledAt" | "durationMinutes"
>;

export function matchEndsAt(scheduledAt: Date, durationMinutes: number): Date {
  return new Date(scheduledAt.getTime() + durationMinutes * 60_000);
}

export function effectiveMatchPhase(
  match: MatchPhaseInput,
  now: Date,
): EffectiveMatchPhase {
  if (match.status === "DRAFT") return "DRAFT";
  if (match.status === "CANCELLED") return "CANCELLED";
  if (match.status === "FINISHED") {
    const inferredVoting = match.resultConfirmedAt
      ? (() => {
          const opensAt = votingOpensAt(
            match.scheduledAt,
            match.durationMinutes,
            match.resultConfirmedAt,
          );
          return {
            status: "OPEN" as const,
            opensAt,
            closesAt: votingClosesAt(opensAt),
          };
        })()
      : null;
    const voting = match.voting ?? inferredVoting;
    if (
      voting?.status === "OPEN" &&
      now >= voting.opensAt &&
      now < voting.closesAt
    )
      return "VOTING_OPEN";
    return "FINISHED";
  }

  const endsAt = matchEndsAt(match.scheduledAt, match.durationMinutes);
  if (now >= endsAt) return "AWAITING_RESULT";
  if (match.status === "STARTED" || now >= match.scheduledAt)
    return "IN_PROGRESS";
  return "OPEN";
}

/**
 * SQL projection of effectiveMatchPhase for bounded server-side read models.
 * Keep changes here aligned with the in-memory authority above.
 */
export function effectiveMatchPhaseSql(
  match: MatchPhaseSqlInput,
  now: Date,
): SQL<EffectiveMatchPhase> {
  const nowIso = now.toISOString();
  const inferredVotingOpensAt = sql`greatest(
    ${match.scheduledAt} + ((${match.durationMinutes} + ${VOTING_V1_CONFIG.gracePeriodMinutes}) * interval '1 minute'),
    ${match.resultConfirmedAt}
  )`;
  return sql<EffectiveMatchPhase>`case
    when ${match.status} = 'DRAFT' then 'DRAFT'
    when ${match.status} = 'CANCELLED' then 'CANCELLED'
    when ${match.status} = 'FINISHED' and (
      (
        ${match.votingStatus} = 'OPEN'
        and ${nowIso}::timestamptz >= ${match.votingOpensAt}
        and ${nowIso}::timestamptz < ${match.votingClosesAt}
      ) or (
        ${match.votingStatus} is null
        and ${match.resultConfirmedAt} is not null
        and ${nowIso}::timestamptz >= ${inferredVotingOpensAt}
        and ${nowIso}::timestamptz < ${inferredVotingOpensAt} + (${VOTING_V1_CONFIG.durationHours} * interval '1 hour')
      )
    ) then 'VOTING_OPEN'
    when ${match.status} = 'FINISHED' then 'FINISHED'
    when ${match.scheduledAt} + (${match.durationMinutes} * interval '1 minute') <= ${nowIso}::timestamptz then 'AWAITING_RESULT'
    when ${match.status} = 'STARTED' or ${match.scheduledAt} <= ${nowIso}::timestamptz then 'IN_PROGRESS'
    else 'OPEN'
  end`;
}

export function matchIsOperationallyActiveSql(
  match: OperationallyActiveMatchSqlInput,
  now: Date,
): SQL<boolean> {
  return sql<boolean>`(
    ${match.status} = 'DRAFT' or (
      ${match.status} in ('OPEN', 'STARTED')
      and ${match.scheduledAt} + (${match.durationMinutes} * interval '1 minute') > ${now.toISOString()}::timestamptz
    )
  )`;
}

export function matchAcceptsRegistration(
  match: Pick<MatchPhaseInput, "status" | "scheduledAt" | "durationMinutes">,
  now: Date,
): boolean {
  return match.status === "OPEN" && effectiveMatchPhase(match, now) === "OPEN";
}
