import type { EffectiveMatchPhase } from "@football/contracts";

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

export function matchAcceptsRegistration(
  match: Pick<MatchPhaseInput, "status" | "scheduledAt" | "durationMinutes">,
  now: Date,
): boolean {
  return match.status === "OPEN" && effectiveMatchPhase(match, now) === "OPEN";
}
