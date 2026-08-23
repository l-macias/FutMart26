# Technical Architecture

## Status

**APPROVED / FROZEN BASE**

The major platform choices required for repository scaffold are closed.

## Monorepo

```text
football-platform/
├── apps/
│   ├── web/
│   ├── api/
│   └── admin/
├── packages/
│   ├── contracts/
│   ├── database/
│   ├── auth/
│   ├── ui/
│   ├── football-ui/
│   ├── config/
│   └── observability/
└── docs/
```

Additional packages are introduced only for real ownership or reuse.

## Tooling

- pnpm workspaces
- Turborepo
- TypeScript strict

## Player application

- Next.js 16
- React
- TanStack Query
- typed API client
- Zod where runtime validation is needed at the web boundary

Next.js is selected partly to preserve a clean path to future public/indexable player profiles and rankings without requiring a later migration from a pure SPA architecture.

The application should still behave like a fast mobile-first app.

## Admin application

- Next.js 16
- shared neutral UI primitives
- shared contracts/auth infrastructure
- operational UX distinct from the player-facing game experience

## API

- Fastify
- TypeScript strict
- Zod
- modular monolith

Fastify is the single authority for product/domain behavior.

Do not split domain logic between Next.js and Fastify.

## Database

- PostgreSQL
- Drizzle ORM

Use explicit:

- transactions;
- constraints;
- indexes;
- migrations;
- concurrency control.

Drizzle was selected to stay close to SQL and make important concurrency/performance behavior visible.

## Authentication

- Better Auth
- email/password for V1
- Google OAuth for V1

Authentication identity remains separate from football `Player` identity.

The architecture must allow adding/changing authentication methods without rewriting the sports domain.

## Authorization

Separate concerns:

- platform/Superadmin authorization;
- Group ownership/moderator capabilities;
- membership;
- match-specific roles such as observer.

Better Auth authenticates identity. Domain authorization remains application-owned.

## API topology

```text
Browser
  ↓
Next.js app
  ↓
Typed API Client
  ↓
Fastify
  ↓
Application / Domain
  ↓
Drizzle
  ↓
PostgreSQL
```

Future native clients consume the same Fastify API.

## REST

V1 uses REST/domain-oriented commands.

Avoid generic CRUD when domain actions are clearer.

## Shared contracts

`packages/contracts` may contain:

- request DTO schemas;
- response DTO schemas;
- public enums;
- stable API types.

It must not become a dumping ground for backend entities.

## Database package

`packages/database` owns:

- Drizzle setup;
- schema infrastructure;
- migration tooling;
- database connection infrastructure.

Domain rules do not live here.

## Auth package

`packages/auth` isolates Better Auth integration and shared auth-facing types/configuration.

Do not make unrelated product modules import Better Auth internals.

## UI packages

### `packages/ui`

Neutral primitives.

### `packages/football-ui`

Football/product-specific reusable visual components.

## State management

- server state: TanStack Query;
- local UI state: React;
- additional global client state only when a concrete cross-cutting need appears.

No Redux/global store by default.

## Media

Object-storage abstraction.

Development may use a local adapter.

Production may use S3-compatible storage.

## Jobs/events

Initial implementation can be simple.

Architecture must support:

- internal events;
- idempotent processing;
- transactional outbox where reliability matters;
- future external queue/workers without domain rewrite.

## Observability

From V1:

- structured logs;
- request/operation IDs;
- actor/resource context for critical actions;
- failures/duration;
- relevant config version/effective date;
- error reporting.

## Scaling path

Initial:

```text
Next Web/Admin
      ↓
Fastify API
      ↓
PostgreSQL
```

Evolution when measured need appears:

```text
CDN
 ↓
Web/Admin
 ↓
Load Balancer
 ↓
Fastify API × N
 ↓
PostgreSQL / replicas / cache
 ↓
Workers / Queue
 ↓
Object Storage
```

Do not add distributed infrastructure before evidence requires it.
