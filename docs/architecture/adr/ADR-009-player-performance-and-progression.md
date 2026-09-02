# ADR-009 — Player performance and deterministic progression

## Status

Accepted.

## Decision

F5 performance is a discipline-scoped state separate from Player identity. OVR is always derived from six decimal attributes using the stable, system-controlled `ratingProfile`; it is never an independently incremented counter. Guests and no-shows retain Voting evidence but receive no persistent performance.

Each processing operation resolves one immutable, validated, data-only configuration version. The pure engine uses decimal arithmetic at 40 significant digits, quantizes persisted attributes and scalar snapshot values to 12 decimal places with round-half-up, and never uses display OVR in calculations. The stored attributes are the next calculation's inputs, so the same evidence chain and config versions reproduce exactly.

Raw ballots remain evidence. Processing creates one immutable snapshot per Player, Match, and discipline containing the complete before/calculation/after explanation, then updates the current performance in the same transaction. Configuration versions and snapshots are protected from update and delete. Configuration changes apply only to later processing and never recalculate history.

`NO_EVIDENCE` creates a snapshot with unchanged attributes, OVR, and streak. Neutral evidence resets the streak. Tags distribute budget only; clipped budget is not redistributed.

## Ordering and concurrency

The historical order for a Player is `(Match.scheduledAt, Match.id)`. A Match cannot process for that Player while an earlier effectively-closed, eligible Match lacks a snapshot. This prevents request arrival order from becoming sporting history; the UUID is only a stable tie-break for equal scheduled times.

The Match row serializes whole-Match retries and effective Voting closure. Progression derives the effective Voting window from Match timing and sporting-result confirmation, so it does not depend on a prior visit or administrative opening. Once an unmaterialized window has elapsed, Progression may create its session directly as `CLOSED` with `closedAt = closesAt`. Player-performance rows are provisioned through a unique `(playerId, discipline)` constraint and locked in ascending Player ID order. A unique snapshot constraint provides the final idempotency guard. Distinct Matches touching the same Player therefore consume a single before-state chain; later work either observes the earlier commit or fails with `progression_out_of_order` and can be retried.

## Consequences

- processing is safe after response loss and cannot double-progress a Player/Match;
- a closed older Match must be processed before newer history;
- delayed activation resolves one config at processing time and records it permanently;
- no automatic profile inference, retrospective recalculation, void/reprocessing, goalkeeper, cards, tiers, rankings, or public Voting result is introduced.
