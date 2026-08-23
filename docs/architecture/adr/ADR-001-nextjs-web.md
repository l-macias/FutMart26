# ADR-001 — Next.js for Web Applications

## Status

Accepted.

## Context

The MVP is primarily an authenticated application, but future confirmed/likely product surfaces include shareable/public player profiles and rankings.

A pure Vite SPA would be simpler initially but could require an architectural migration if public SSR/indexable pages become important.

## Decision

Use **Next.js 16** for:

- `apps/web`;
- `apps/admin`.

React remains the UI foundation.

## Critical constraint

Next.js does not become the product/domain backend.

Domain mutations and product rules remain in Fastify.

Do not use Server Actions or Route Handlers to create a second business-logic path around the API.

## Consequences

Positive:

- SSR/public-page path remains available;
- metadata/shareability support;
- mature routing/rendering platform;
- no future SPA-to-SSR migration required for common public surfaces.

Costs:

- more framework surface than Vite;
- requires discipline to prevent domain logic leaking into Next.

## Rejected alternative

Vite SPA.

Still technically valid, but less aligned with likely future public profiles/rankings.
