import { VOTING_V1_CONFIG } from "./voting-config.js";

export function votingEligibleAfter(
  scheduledAt: Date,
  durationMinutes: number,
): Date {
  return new Date(
    scheduledAt.getTime() +
      (durationMinutes + VOTING_V1_CONFIG.gracePeriodMinutes) * 60_000,
  );
}

export function votingOpensAt(
  scheduledAt: Date,
  durationMinutes: number,
  sportingResultConfirmedAt: Date,
): Date {
  const eligibleAfter = votingEligibleAfter(scheduledAt, durationMinutes);
  return new Date(
    Math.max(eligibleAfter.getTime(), sportingResultConfirmedAt.getTime()),
  );
}

export function votingClosesAt(openedAt: Date): Date {
  return new Date(
    openedAt.getTime() + VOTING_V1_CONFIG.durationHours * 3_600_000,
  );
}
