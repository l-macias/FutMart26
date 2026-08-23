# Backend Architecture

## Style

Modular monolith with explicit responsibility boundaries.

Preferred framework: Fastify unless architecture evaluation demonstrates a stronger alternative.

## Conceptual structure

```text
apps/api/src/
├── app/
├── http/
├── infrastructure/
└── modules/
    ├── identity/
    ├── disciplines/
    ├── groups/
    ├── matches/
    ├── participation/
    ├── matchmaking/
    ├── voting/
    ├── ratings/
    ├── cards/
    ├── awards/
    ├── achievements/
    ├── stats/
    ├── notifications/
    └── administration/
```

A module may contain:

```text
domain/
application/
infrastructure/
http/
```

only when useful. Do not create empty layers or one-class-per-file ceremony mechanically.

## Request flow

Preferred direction:

```text
HTTP
 ↓
validation/authentication
 ↓
application command/query
 ↓
domain/module logic
 ↓
repository/transaction
 ↓
result
```

Controllers/routes stay thin.

## Cross-module interaction

Prefer:

- public module interfaces;
- application services;
- domain/application events;
- stable contracts.

Avoid:

- importing another module's internal repositories;
- direct writes to another module's tables;
- shared god-services.

## Transactions

Application use cases own transactional boundaries when multiple persistent changes must commit atomically.

External I/O must not extend critical database transactions.

## Events

Examples:

- `ParticipantPromoted`;
- `RosterConfirmed`;
- `VotingClosed`;
- `ProgressionCalculated`;
- `CardEarned`;
- `AchievementEarned`.

Events decouple consequences without requiring microservices.

## Background processing

Rating/progression, cards, achievements and notifications may be processed asynchronously when user-facing correctness permits it.

Processing must be:

- retryable;
- idempotent;
- observable.

## Repositories

Repositories expose domain/application needs, not generic table CRUD.

Avoid leaking ORM types through the domain boundary.

## Authorization

Authorization belongs server-side and close to the application use case/resource context.

Do not centralize every authorization decision into a single unmaintainable function.

## Error model

Define stable application errors:

- validation;
- unauthorized;
- forbidden;
- not found;
- conflict;
- invariant violation;
- concurrency conflict;
- external dependency failure.

Map them consistently to HTTP responses.

## Configuration

Runtime product configuration is accessed through validated configuration services/snapshots.

Do not call arbitrary admin tables from every domain object.

## No spaghetti rules

Prohibited patterns:

- 1000-line service classes;
- controllers containing domain logic;
- circular feature dependencies;
- "utils" modules containing hidden business rules;
- direct cross-module SQL mutations;
- duplicated validation rules;
- massive shared global state;
- catch-and-ignore error handling.
