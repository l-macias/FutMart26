# ADR-005 — Group ownership concurrency

## Status

Accepted.

## Decision

Active ownership is represented by an active GroupMembership with role OWNER. PostgreSQL enforces at most one active owner per Group with a partial unique index.

Every operation that can replace or remove an owner locks the Group row with `SELECT ... FOR UPDATE`, re-reads current active memberships, and performs the complete transition in one transaction. Group creation inserts the Group and creator OWNER membership atomically. These protocols guarantee at least one owner for every ACTIVE Group; the partial index guarantees at most one.

Automatic succession is deterministic: oldest active moderator by `roleGrantedAt`, then oldest other active member by `joinedAt`, with membership UUID as final tie-breaker. If no candidate remains, the Group is archived in the same transaction.

## Consequences

- concurrent ownership mutations serialize per Group;
- unrelated Groups remain independent;
- no externally observable state has zero or two active owners;
- role history is preserved separately from current authorization state.
