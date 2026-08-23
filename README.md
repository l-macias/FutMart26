# Football Platform — Development OS v2.1

Este paquete documental gobierna la implementación del MVP **F5 Groups**.

## Estado

- Product Discovery v1.0: **FROZEN**
- Technical Architecture: **FROZEN BASE**
- Visual Direction: **APPROVED BASE**
- Implementation scaffold: **NOT STARTED**

## Stack técnico aprobado

- Monorepo: pnpm workspaces + Turborepo
- Player Web: Next.js 16 + React + TypeScript strict
- Admin Web: Next.js 16 + React + TypeScript strict
- API: Fastify
- Database: PostgreSQL
- Data access: Drizzle ORM
- Validation/contracts: Zod
- Authentication: Better Auth
- Login V1: email/password + Google
- Server state: TanStack Query
- API style: REST/domain-oriented commands
- Architecture: modular monolith
- Media: object-storage abstraction
- Async evolution: internal events + outbox-ready jobs

## Important boundary

Next.js is the web delivery/rendering layer.

**Fastify remains the authority for product/domain behavior.**

Do not move product rules into Next Server Actions or Route Handlers merely because the framework supports them.

The intended path is:

```text
Web/Admin
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

This preserves future clients such as a native mobile app.

## Auth boundary

Authentication identity and football identity are separate concepts.

```text
Better Auth identity
        ↓
Product identity
        ↓
Player
```

Do not make authentication-library tables the football domain model.

## Architecture decisions

See:

- `docs/architecture/adr/ADR-001-nextjs-web.md`
- `docs/architecture/adr/ADR-002-drizzle-postgresql.md`
- `docs/architecture/adr/ADR-003-better-auth.md`
- `docs/architecture/adr/ADR-004-fastify-domain-api.md`

## Next implementation milestone

The next task for Codex is repository scaffold only:

1. create monorepo;
2. configure TypeScript strict;
3. create Web, API and Admin apps;
4. create approved shared packages;
5. establish lint/format/typecheck;
6. establish package boundaries;
7. do not implement Groups/Matches/Rating yet.
