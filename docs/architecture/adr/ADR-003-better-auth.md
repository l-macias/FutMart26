# ADR-003 — Better Auth

## Status

Accepted.

## Context

The product needs secure user authentication without making custom authentication implementation a core project concern.

V1 should support low-friction account creation/login while preserving future extensibility.

## Decision

Use **Better Auth**.

V1 login methods:

- email/password;
- Google OAuth.

## Domain separation

Authentication identity is not the football Player domain model.

Conceptually:

```text
Authentication Identity
        ↓
Product Identity Mapping
        ↓
Player
```

The football domain must not depend directly on Better Auth table internals.

## Authorization separation

Better Auth answers primarily:

- who is the authenticated user?

The application/domain answers:

- can this actor manage this Group?
- can this moderator perform this action?
- can this participant vote?
- is this actor a Superadmin?

## Consequences

Positive:

- avoids home-grown auth complexity;
- TypeScript-compatible;
- supports common authentication flows;
- keeps future auth expansion open.

Costs:

- dependency on auth library integration;
- requires a clear anti-corruption boundary so domain code is not coupled to provider/library details.

## Future

Possible future methods may include:

- passkeys;
- additional OAuth providers;
- magic link.

They are not V1 scope unless later approved.
