# ADR-002 — Drizzle ORM with PostgreSQL

## Status

Accepted.

## Context

The product contains important concurrency and integrity requirements:

- last-slot registration races;
- deterministic waitlists;
- promotions;
- ownership transfer;
- voting uniqueness;
- guest linking;
- historical progression.

The data layer should remain explicit enough to reason about SQL, indexes, transactions and locks.

## Decision

Use:

- PostgreSQL as primary system of record;
- Drizzle ORM as data-access/mapping layer.

## Reasons

- strong TypeScript integration;
- close relationship to SQL;
- explicit query behavior;
- good fit for deliberate transaction handling;
- suitable for schema/index/migration reasoning;
- less pressure to hide important database semantics.

## Constraints

- do not expose Drizzle row types as domain contracts;
- do not place domain rules in database helpers;
- use DB constraints as part of correctness;
- inspect generated/executed SQL for critical or high-volume paths;
- concurrency-sensitive flows require integration tests against real PostgreSQL.

## Rejected alternative

Prisma.

Prisma is productive and valid, but Drizzle better matches the desired explicitness around SQL/concurrency for this system.
