# ADR-011: Group invitations, football bootstrap and persistent Guests

## Status

Accepted — 2026-08-24

## Context

Groups need non-enumerable invitations, Players need F5 preferences that do not alter progression, and recurring Guests need stable Group-local identity while continuing to share the Match admission queue with Players.

## Decision

### Invitations

Invitation secrets are 256-bit random base64url tokens. Only their SHA-256 hashes are stored. `SINGLE_USE` has one atomic use; `TIME_LIMITED` has an expiry and optional `maxUses`. Consumption locks the invitation row and atomically creates a MEMBER membership and an immutable usage record. Preview is public but returns only Group display name and availability. Login never consumes a token and join remains explicit.

Effective states are derived from revocation, expiry and counters. Revocation is irreversible. Owners may revoke any invitation. A moderator requires `GROUP_MANAGE_INVITATIONS`, may revoke only invitations created by that same moderator, and can never revoke an Owner-created invitation.

`LEFT` and non-blocking `REMOVED` histories may rejoin by creating a new active membership. `BLOCKED` is preserved on membership history and prevents invitation re-entry until the Owner explicitly unblocks it. Unblock changes the historical row to `REMOVED`; it does not silently reactivate membership.

### Football bootstrap

`player_football_preferences` is discipline-scoped and separate from `player_performances`. V1 persists zero to two ordered roles, zero to three self-reported strengths and goalkeeper willingness. Any `PORTERO` preference requires willingness. These inputs never mutate attributes, OVR, confidence or `ratingProfile`; matchmaking consumes them only as role/keeper preference evidence.

### Persistent Group Guests

`group_guests` is a Group-local unauthenticated identity, not a Player or Membership. Reusable names are normalized (Unicode NFKC, trim, collapsed whitespace, case-insensitive) and unique among ACTIVE/ARCHIVED identities. Names never cause automatic identity merging. `ARCHIVED` identities may be restored; `DELETED` identities are tombstoned and never restored. Match participants retain both `groupGuestId` and a historical display-name snapshot. A trigger plus application validation prevents cross-Group linkage.

Existing development Match Guests are backfilled one-for-one as distinct DELETED GroupGuest identities. This preserves history without guessing identity from names. Future Guest-to-Player linking requires explicit Player confirmation and must not retroactively grant progression.

### Guest policy and admission

Groups default to `guestsEnabled=true` and one Guest per member per Match. Memberships may override the non-negative allowance. Owners are unlimited; moderators need `MATCH_GUEST_OVERRIDE` to exceed their own allowance. Guest creation is available to active members, while directory lifecycle and policy changes require explicit administrative capabilities.

Guest allowance and Match capacity are checked while locking the Match and actor membership. Players and Guests continue to use one `nextAdmissionOrder`; no Guest priority or parallel waitlist exists. The creator may cancel their own Guest admission, while authorized administrators may cancel any Guest.

F5 describes discipline and rating context, not roster size. Capacity remains independent: 10, 11 and 12 are valid, and the V1 matchmaking bound remains 12 (including valid 6v6).

## Consequences

- Tokens cannot be recovered from database rows; a created secret is returned once.
- PostgreSQL row locks serialize final-use, revoke/join and allowance/admission races.
- The public preview endpoint needs infrastructure rate limiting before public release; token entropy and generic unavailable responses are the current security seam.
- Capabilities remain explicit moderator grants under the existing Group authorization model; no generic RBAC framework is introduced.
- Providers, frontend return-flow storage, automatic linking, retroactive progression and Match-level policy overrides remain deferred.
