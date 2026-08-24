# ADR-008 — Voting evidence and lifecycle

## Status

Accepted.

## Decision

Each Match has at most one ordinary `VotingSession`. Opening is explicit, idempotent, and allowed only after the final roster is confirmed and the configured grace period has elapsed. The session stores its opening and deadline; reads and writes enforce the deadline even without a scheduler, and may persist a lazy transition to `CLOSED`.

Eligibility is derived from the immutable final roster rather than copied into a second snapshot. Once a VotingSession exists, ordinary roster confirmation and correction are blocked. Stable participant IDs preserve the historical population: played Players vote and are evaluable, played Guests are only evaluable, and no-shows are neither.

A submitted Ballot is immutable in V1. One transaction creates the Ballot, its Player evaluations, and structured strength/improvement evidence. Omitted targets have no evaluation row. Voter identity remains stored for integrity and future moderation, but player-facing read models never expose it.

## Concurrency

The VotingSession row is the aggregate lock for ballot submission, deadline enforcement, and early closure. A unique Match/session index prevents concurrent opening duplicates; a unique session/voter index prevents duplicate ballots; and a unique ballot/target index prevents duplicate evaluations. Two final voters serialize on the session and both ballots commit before the session closes exactly once.

## Consequences

- no scheduler is required for deadline correctness;
- roster evidence cannot drift after ordinary Voting opens;
- raw tags remain evidence and do not imply attribute deltas;
- future confidence and anomaly detection can derive denominators and patterns from raw ballots and voter identity;
- ballot voiding has a non-destructive schema seam but no operation or permission is implemented in this slice.
