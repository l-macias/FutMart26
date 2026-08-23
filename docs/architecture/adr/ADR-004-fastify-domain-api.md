# ADR-004 — Fastify as the Domain API

## Status

Accepted.

## Context

The player web app uses Next.js, which can host server-side code.

However, the product is expected to evolve toward multiple clients and contains substantial domain logic, concurrency rules and background processing.

Splitting business logic between Next and another backend would create duplicated authority and long-term maintenance problems.

## Decision

Use **Fastify** as the product/domain API.

The API is a modular monolith.

## Boundary

```text
Clients
  ↓
Fastify HTTP/Application Boundary
  ↓
Modules / Domain
  ↓
Persistence / Infrastructure
```

Next.js consumes Fastify rather than bypassing it for domain mutations.

## Reasons

- clear source of truth for product behavior;
- mobile/native clients can reuse the API;
- better isolation of business rules;
- easier concurrency/integrity reasoning;
- framework-neutral domain evolution;
- straightforward horizontal scaling.

## Consequences

Positive:

- clear responsibilities;
- no Next-only backend lock-in;
- strong testable API boundary.

Costs:

- separate API application/deployment;
- an extra network boundary compared with putting everything in Next.

The maintenance/scaling benefits justify that cost.
