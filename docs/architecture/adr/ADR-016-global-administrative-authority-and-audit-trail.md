# ADR-016 — Global Administrative Authority and Audit Trail

## Status

Accepted for the launch beta.

## Decision

Global administration belongs to the authenticated Account boundary through an
explicit `admin_grants` row with role `SUPERADMIN`. It is independent from
`Player`, Group ownership and Group capabilities. Every admin endpoint verifies
the grant server-side.

Account suspension is an Account-level record. Suspending revokes active
sessions and prevents new Better Auth sessions; reactivation restores access
without rewriting sporting history or social relationships. Public discovery
omits actively suspended Players without revealing the reason.

Sensitive administrative mutations require a reason and append an immutable
`admin_audit_events` row containing actor, typed action, target, request ID and
timestamp. There is no update/delete API for this log and it never stores
passwords, tokens, cookies, media bytes or full request bodies.

Ballots may be voided only before any Progression snapshot for their Match has
been materialized. Post-materialization sporting evidence is immutable in this
release: no result rewrite, snapshot reversal or hidden recomputation is
allowed.

## Consequences

- The first SUPERADMIN is granted consciously with an idempotent CLI command.
- Group and Match moderation reuse launch invariants; admin cannot force archive
  a Group with active Matches or cancel a FINISHED Match.
- `ANONYMIZED` is terminal and cannot be reactivated.
- Appeals, multi-role moderation, retroactive correction ledgers and MFA are
  future work.
