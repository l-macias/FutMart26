# AGENTS.md

## Mission

Implement the approved F5 Groups MVP inside its documented product, architecture and visual boundaries.

Do not invent product scope, architecture, visual language or infrastructure during feature implementation.

## Approved technical stack

- pnpm workspaces
- Turborepo
- Next.js 16 for `apps/web`
- Next.js 16 for `apps/admin`
- Fastify for `apps/api`
- TypeScript strict
- PostgreSQL
- Drizzle ORM
- Zod
- Better Auth
- TanStack Query
- REST/domain-oriented API

## Critical architecture boundary

Next.js is not the product backend.

Product/domain mutations and rules belong behind the Fastify API.

Do not place domain behavior into:

- Next Server Actions;
- Next Route Handlers;
- React components;
- client stores.

Server Actions/Route Handlers may only be used for narrowly justified web-delivery concerns that do not duplicate or bypass the Fastify domain API.

## Authentication boundary

Authentication-library state is not the football domain model.

Keep authentication identity separate from `Player` and discipline profiles.

Do not couple domain rules directly to Better Auth table shapes.

## Context loading

Read only the documentation relevant to the task, but never skip governing documents for high-risk work.

### Product/domain

- `docs/product/PRODUCT_CONSTITUTION.md`
- `docs/product/MVP_SCOPE.md`
- `docs/product/DOMAIN_RULES.md`
- `docs/product/FUTURE_REQUIREMENTS.md`
- `docs/product/SCENARIOS.md` when behavior/edge cases matter.

### Architecture

- `docs/architecture/ARCHITECTURE_PRINCIPLES.md`
- `docs/architecture/TECHNICAL_ARCHITECTURE.md`
- `docs/architecture/MODULE_BOUNDARIES.md`
- `docs/architecture/FRONTEND_ARCHITECTURE.md`
- `docs/architecture/BACKEND_ARCHITECTURE.md`
- `docs/architecture/DATA_ARCHITECTURE.md`
- `docs/architecture/SCALABILITY_AND_CONCURRENCY.md`
- `docs/architecture/SECURITY.md`
- relevant ADRs under `docs/architecture/adr/`.

### Engineering

- `docs/engineering/AI_ENGINEERING_RULES.md`
- `docs/engineering/DEVELOPMENT_WORKFLOW.md`
- `docs/engineering/TASK_LEVELS.md`
- `docs/engineering/DEFINITION_OF_DONE.md`

### UX/visual

- `docs/ux/UX_PRINCIPLES.md`
- `docs/ux/INFORMATION_ARCHITECTURE.md`
- `docs/ux/USER_FLOWS.md`
- `docs/ux/VISUAL_DIRECTION.md`
- `docs/ux/DESIGN_SYSTEM.md`
- `docs/ux/CARD_SYSTEM.md`
- `docs/ux/MOTION_SYSTEM.md`
- `docs/ux/COMPONENT_PRINCIPLES.md`

## Non-negotiable rules

1. Do not broaden MVP scope without explicit approval.
2. Do not implement future requirements; preserve their viability.
3. Do not break domain invariants.
4. Every concurrent mutation must consider races, idempotency, transaction boundaries and retries.
5. Never trust frontend authorization.
6. Keep the API stateless.
7. Do not introduce microservices, distributed queues, sharding or speculative infrastructure without measured need.
8. Preserve module ownership; no direct cross-module persistence writes.
9. Do not refactor unrelated areas.
10. Product configuration changes apply prospectively unless explicitly specified otherwise.
11. Preserve historical evidence and progression snapshots.
12. Queries over potentially large collections must be bounded.
13. Avoid N+1 query patterns.
14. External notification/storage failures must not corrupt already-confirmed sporting operations.
15. Use design tokens; do not invent repeated CSS values in feature code.
16. Do not create generic SaaS/dashboard visuals by default.
17. Do not introduce new brand colors, fonts, tier styles, card geometry or motion timing outside the design system.
18. Do not duplicate UI primitives or football product components.
19. Player cards must respect the hybrid Card System contract.
20. If a requested implementation blocks F7, F11, Leagues/Competitions, monetization or horizontal scaling, report the consequence before proceeding.
21. Prefer few, justified dependencies over library accumulation.
22. Drizzle queries/transactions must remain explicit enough to reason about performance and concurrency.
23. Better Auth handles authentication; it does not own football authorization semantics.
24. Group roles/capabilities and Superadmin authority are separate authorization concerns.

## No-spaghetti rules

Avoid:

- god services;
- giant route/controllers;
- circular feature imports;
- business logic hidden in `utils`;
- enormous global client stores;
- ORM entities leaking everywhere;
- arbitrary shared folders;
- duplicated domain validation;
- component APIs with dozens of unrelated flags;
- CSS copied between screens;
- domain logic implemented twice in Next and Fastify.

Prefer:

- high cohesion;
- small explicit interfaces;
- feature ownership;
- narrow contracts;
- local code until reuse is proven;
- domain/application events for derived consequences.

## Work pattern

For non-trivial tasks:

1. inspect;
2. identify affected boundaries/invariants;
3. plan proportional to risk;
4. implement only approved scope;
5. validate;
6. review the diff;
7. report changes, evidence and remaining risks.

Do not claim completion without validation evidence.
