# ADR-008 — Voting evidence and lifecycle

## Status

Accepted.

## Decision

Each Match has at most one ordinary `VotingSession`. Voting starts effectively without an administrative action at `max(scheduledAt + durationMinutes + gracePeriod, sportingResult.confirmedAt)`, with a V1 grace period of 15 minutes. A read or other Voting operation materializes the session lazily and idempotently; the persisted `openedAt` is the effective start, not the materialization time. The window lasts 18 hours from that start.

Eligibility is derived from the immutable final roster rather than copied into a second snapshot. From the effective Voting start, ordinary final-roster, statistics, and sporting-result corrections are blocked even if no `VotingSession` row exists yet. Stable participant IDs preserve the historical population: played Players vote and are evaluable, played Guests are only evaluable, and no-shows are neither.

A submitted Ballot is immutable in V1. One transaction creates the Ballot, its Player evaluations, and structured strength/improvement evidence. Omitted targets have no evaluation row. Voter identity remains stored for integrity and future moderation, but player-facing read models never expose it.

## Concurrency

The Match lock serializes lazy session materialization, and the VotingSession row is the aggregate lock for ballot submission, deadline enforcement, and early closure. A unique Match/session index prevents concurrent materialization duplicates; a unique session/voter index prevents duplicate ballots; and a unique ballot/target index prevents duplicate evaluations. Two final voters serialize on the session and both ballots commit before the session closes exactly once.

After the deadline, effective state is closed regardless of the persisted row state. Lazy deadline closure records `closedAt = closesAt`. If no session was ever materialized, Progression may create it directly as `CLOSED` once the whole window has elapsed.

## Consequences

- no scheduler is required for deadline correctness;
- roster, statistics, and sporting-result evidence cannot drift after effective Voting starts;
- raw tags remain evidence and do not imply attribute deltas;
- future confidence and anomaly detection can derive denominators and patterns from raw ballots and voter identity;
- ballot voiding has a non-destructive schema seam but no operation or permission is implemented in this slice.
