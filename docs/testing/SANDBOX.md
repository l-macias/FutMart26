# Realistic QA sandbox

The sandbox is an isolated, disposable dataset for manual product and UX QA. It never uses `DATABASE_URL`: every sandbox command requires an explicit `SANDBOX_DATABASE_URL` whose real database name ends in `_sandbox`.

## Setup

Add only the connection URL to the local `.env`:

```dotenv
SANDBOX_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/football_sandbox
SANDBOX_SEED=20260902
```

Create/rebuild the sandbox:

```powershell
$env:SANDBOX_CONFIRM="RESET"
pnpm sandbox:rebuild
```

`sandbox:reset` drops only the `public` and `drizzle` schemas inside the validated `_sandbox` database and reapplies every official migration. It aborts unless `SANDBOX_CONFIRM=RESET`. `sandbox:seed` refuses a non-empty or migration-stale database.

The individual commands are:

```text
pnpm sandbox:reset
pnpm sandbox:seed
pnpm sandbox:rebuild
pnpm sandbox:guards
pnpm dev:sandbox
```

`pnpm dev:sandbox` passes `SANDBOX_DATABASE_URL` to the API as `DATABASE_URL` for that process only. It does not rewrite `.env`.

## QA accounts

All five accounts are verified, adult, accepted Terms v1 and Privacy v1, have F5 preferences, and are READY.

```text
owner@sandbox.local
moderator@sandbox.local
player@sandbox.local
private@sandbox.local
admin@sandbox.local

Password: Sandbox123!
```

`admin@sandbox.local` is the only sandbox SUPERADMIN. These credentials are fixtures and must never be created in development, staging, or production databases.

## Dataset

The fixed default seed creates 55 Players, 8 Groups, 12 persistent Guests, and 45 Matches: 3 DRAFT, 8 OPEN, 2 STARTED, 29 FINISHED, and 3 CANCELLED. It includes:

- PUBLIC, PRIVATE, and historical ANONYMIZED Players;
- ACTIVE, PRIVATE, and ARCHIVED Groups with varied membership density;
- accepted/pending Connections, token and directed invitations;
- confirmed and waitlisted Players/Guests with shared admission order;
- 5v5, 6v6, 6v5, and 5v4 F5 rosters;
- open/closed Voting, QUICK/FULL ballots, a VOIDED ballot, and NO_EVIDENCE;
- real Progression Engine snapshots plus deterministic starting OVR bands used only by the sandbox fixture;
- derived achievements/awards and ranking evidence across Argentine territories;
- read/unread Notifications, moderator events, reports, and admin audit records;
- long names, missing avatars, empty history, full rosters, and waitlists for layout QA.

The seed does not upload media or contact MinIO. Avatar fallback is intentional; upload/replace/delete can be tested manually.

### Auditable progression players

`owner@sandbox.local` and `player@sandbox.local` are the stable progression QA references. Their first snapshot starts from the deterministic sandbox band (60 and 68 respectively); every later `before` value equals the preceding snapshot's `after` value and is produced by the real Progression Engine. `NO_EVIDENCE` snapshots preserve both values.

Progression History lists matches newest first, while its chart reverses that result into chronological order. Reading the current OVR and then scrolling down through the newest-first list can therefore look like `65 → 62 → 60`; that is reverse navigation through older evidence, not a rating regression. The deterministic bands are fixture baselines only and are never inserted as synthetic progression snapshots.

## Scenario manifest

Every successful seed prints stable scenario IDs and writes the complete current-run manifest to:

```text
.runtime/sandbox-manifest.json
```

`.runtime` is ignored by Git because IDs and execution timestamps are local runtime evidence. Run the seed again only after an explicit reset.

## Safety

Never point `SANDBOX_DATABASE_URL` at `football_dev`, `football_test`, `football_e2e`, `football_perf`, `postgres`, or production. The scripts reject all names that do not end in `_sandbox`, but the operator must still inspect the URL before setting `SANDBOX_CONFIRM=RESET`.
