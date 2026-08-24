# ADR-006 — Match admission and unified participant queue

## Status

Accepted.

## Decision

`match_participants` represents Match occupancy for both authenticated Players and Guests. A strict kind/identity check keeps the two identities distinct: Player rows reference `players`; Guest rows contain match-local display data and creator evidence. This is not a generic identity hierarchy and does not link Guests to Players.

Every admission, cancellation, promotion and capacity change locks the parent Match row with `SELECT ... FOR UPDATE`. The locked Match owns a monotonically increasing `nextAdmissionOrder`; every new attempt receives the next value. Player and Guest attempts therefore share one deterministic queue. A cancelled Player rejoining creates a new attempt and cannot recover an earlier position.

The application counts active confirmed occupants only while holding the Match lock. If capacity is available the new attempt is `CONFIRMED`; otherwise it is `WAITLISTED`. Cancelling a confirmed participant and promoting waitlisted participants happen in the same transaction. Starting the Match records `rosterLockedAt` and blocks further admissions and promotions.

## Database protections

- unique `(match_id, admission_order)`;
- partial unique active Player participation per Match;
- check constraint enforcing the Player/Guest identity shape;
- explicit restrictive foreign keys preserving history.

PostgreSQL cannot express the cross-row capacity limit as a simple CHECK constraint. Correctness therefore depends on the mandatory Match-row locking protocol, covered by PostgreSQL concurrency tests.

## Consequences

- Player and Guest capacity and waitlist ordering cannot diverge;
- concurrent operations serialize per Match while unrelated Matches remain independent;
- internal ordering is stable and never supplied by clients;
- future Guest linking can reference the guest participant without changing admission semantics;
- `locationText` remains display-only; future Venue and geographic dimensions require separate identifiers rather than interpreting it as a key.
