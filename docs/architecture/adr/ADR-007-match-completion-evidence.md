# ADR-007 — Match completion evidence

## Status

Accepted.

## Decision

Admission and attendance remain separate dimensions. `match_participants.status` preserves the locked admission history, while nullable `attendance` records `PLAYED` or `NO_SHOW` only after a Match has finished. Final-roster confirmation submits the complete set of participants that were confirmed at roster lock and updates it atomically while holding the Match row lock.

Objective goals and assists are aggregate counters owned by the Match participant. This preserves Player and Guest identity without introducing event sourcing or a Guest-to-Player link. A Match has at most one observer, represented by a match-local reference to a real Player; observer authority is limited to statistics and never implies participation or voting eligibility.

Voting eligibility is derived from participant kind and confirmed attendance. It is not persisted: a played Player can vote and be evaluated, a played Guest can only be evaluated, and a no-show can do neither.

Sporting result persistence uses the locked Match-scoped team assignments. A confirmed result records the authoritative Team A/Team B score and validates it against aggregate goals and assists from participants whose final attendance is `PLAYED`; `NOT_PLAYED` remains distinct from a valid `0-0` draw.

## Concurrency and correction boundary

Finish, final-roster confirmation and correction, statistics writes, result writes, and observer changes serialize on the parent Match with `SELECT ... FOR UPDATE`. Ordinary roster, statistics, and sporting-result corrections are allowed only before the effective Voting start. That boundary is authoritative even when no `voting_sessions` row has been materialized yet.

## Consequences

- confirmed admission is not evidence that a participant played;
- waitlisted and cancelled attempts cannot enter the final roster;
- Player and Guest statistics use the same participant identity;
- observer assignment does not grant Group-wide capabilities;
- historical team assignments remain the source for attributing result and statistics by side.
