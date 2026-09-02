# ADR-013 — Email/password account lifecycle

## Status

Accepted.

## Decision

Better Auth remains the authority for email verification, password recovery,
password changes and sessions. F5 Groups does not issue parallel auth tokens or
persist a second session model.

Production email/password access requires verified email. Registration creates
the account and dispatches verification, but does not create a product session.
Verification does not auto-login. Password reset tokens expire after one hour,
are consumed atomically by Better Auth and revoke every existing session. An
authenticated password change retains the current session and revokes the
others.

Passwords created or changed after this decision accept 12–128 characters with
no composition rules. Existing shorter passwords remain valid for sign-in until
the user changes them.

Mail delivery is an injected `AuthMailService`. Development may expose links in
the local API console; tests use an in-memory adapter; production fails fast
without an external adapter and never logs auth links.

Auth endpoints use Better Auth's IP/action rate limiter. V1 storage is in-memory
and therefore suitable only for a single API instance. Distributed deployment
must provide shared storage in Integration 29.

## Legacy policy

No user rows are mass-updated or inferred as verified. Development and test may
explicitly disable the verification gate to preserve existing pilot accounts.
Production defaults to requiring verification. Any future migration of real
legacy production users requires an explicit operational policy, not a schema
side effect.

## Consequences

- Account identity stays separate from Player identity.
- Recovery responses do not enumerate registered emails.
- Existing Better Auth user, account, session and verification tables are
  sufficient; this decision adds no migration.
- Google authentication, change-email and deletion/retention remain separate
  roadmap work.
