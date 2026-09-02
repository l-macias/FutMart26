# Release checklist

Release candidate under rehearsal: `v0.1.0-rc.1` (candidate only, not tagged).

The candidate was built from local base SHA `b4bff7b` plus the current
uncommitted Integration 5–31 worktree. It is not an immutable release artifact
until the source is committed, pushed and validated by CI.

## Code

- [x] `pnpm install --frozen-lockfile` succeeds in an isolated source copy with
      no `.env`, `node_modules`, `.next`, `.turbo` or `dist` state.
- [x] API, Web and Admin production artifacts build from that copy.
- [x] Web route integrity passes (39 pages).
- [x] Admin route integrity passes (8 build-manifest entries / 7 required pages).
- [x] Local full gates pass.
- [ ] Commit the complete release source, push it and record one immutable SHA.
- [ ] Create the RC tag only after every launch blocker below is closed.

## Database

- [x] Create a new empty `football_rc` database without touching dev/test/e2e.
- [x] Apply official migrations `0000` through `0022` from zero.
- [x] Confirm 23 Drizzle journal entries and latest timestamp `1788264495072`.
- [x] Confirm 41 public tables, 94 foreign keys and the immutable Progression
      configuration seed.
- [x] Confirm `/ready` returns 200 against the migrated database.

## Auth

- [x] Registration/login/compliance/onboarding E2E passes.
- [x] Wrong authority receives 403 and suspended accounts cannot create a
      session.
- [x] Account deletion revokes login and anonymizes the Player while preserving
      historical participation and Progression snapshots.
- [ ] Receive a verification email through the real beta SMTP provider and open
      its production-domain link.
- [ ] Receive a password-reset email through the real beta SMTP provider, reset
      the password and confirm the token cannot be reused.

## Mail

- [x] Production config requires SMTP and a sender address.
- [x] An unreachable SMTP server produces an explicit background-task error and
      does not leak the verification token in logs.
- [ ] Configure beta/staging SMTP credentials and approved `From` identity.
- [ ] Complete real verification and recovery delivery smokes.

## Storage

- [x] Production config requires private S3-compatible storage.
- [x] A failed HeadBucket probe makes `prod:check` fail.
- [ ] Configure the real beta/staging MinIO endpoint, private bucket and
      credentials.
- [ ] Verify HeadBucket, upload, authenticated delivery, replace, remove,
      metadata stripping and fallback against that bucket.
- [ ] Confirm the browser cannot read the bucket directly.

## Backup and restore

- [x] `pnpm db:backup` creates a PostgreSQL custom-format dump outside the repo.
- [x] Validate the dump TOC, non-zero size and SHA-256 checksum.
- [x] Restore into the new empty `football_rc_restore` database.
- [x] Re-run migrations as a no-op and confirm journal/table counts.
- [x] Start the production API artifact against the restore and authenticate the
      restored SUPERADMIN.
- [ ] Configure and test an off-host encrypted database backup destination.
- [ ] Configure and test a MinIO snapshot/versioning/mirror recovery path aligned
      with the database recovery point.

## Admin

- [x] Grant SUPERADMIN with the official CLI.
- [x] Confirm a normal account receives 403 and SUPERADMIN receives 200.
- [x] Create and resolve a report with audit evidence.
- [x] Suspend an account, confirm sessions are revoked and login is blocked, then
      reactivate it.
- [x] Void a ballot before Progression and reject void after Progression.

## Security and privacy

- [x] Player PRIVATE disappears from discovery but remains in shared Group
      evidence.
- [x] Group PRIVATE disappears from discovery while members keep operating.
- [x] Security headers/CSP are present on API, Web and Admin smokes.
- [x] `/health` remains 200 while `/ready` becomes 503 when PostgreSQL is
      unavailable.
- [x] Critical capacity race converges to one CONFIRMED and one WAITLISTED row.
- [ ] Review production reverse-proxy TLS, trusted-origin and `TRUST_PROXY`
      configuration on the deployment host.

## Legal and trust

- [x] Terms, Privacy and Support routes render.
- [x] Policy version acceptance, 18+ gate and account deletion are technically
      enforced.
- [ ] Obtain professional legal review of Terms, Privacy, retention and support
      wording before inviting beta users.

## Mobile, desktop and browsers

- [x] Automated critical responsive/accessibility test passes at 390 px and
      exercises 1440 px avatar crop layout.
- [x] Human-assisted browser smoke confirms `/auth` at 390 px and Terms/Admin at
      1440 px with no overflow or console errors.
- [ ] Complete an authenticated human end-to-end sign-off on a physical/mobile
      browser using the real mail and storage environment.
- [ ] Smoke the deployed candidate in Edge and Firefox (or Safari on a supported
      device); the automated suite currently runs Chromium.

## E2E and CI

- [x] Local Chromium critical E2E: 7/7 pass.
- [x] Local backend/tests: 44/44 pass, 0 skipped.
- [ ] Push the exact candidate SHA and obtain a real green GitHub Actions run.
- [ ] Retain the CI run URL and artifacts with the release record.

## Deploy and rollback

- [x] API graceful stop/restart returns readiness to 200.
- [x] Production configuration and migration readiness check pass structurally
      when external probes are explicitly disabled.
- [ ] Build API, Web and Admin Docker images at least once in CI or a Docker host.
- [ ] Deploy the immutable SHA behind HTTPS with exactly one API instance.
- [ ] Run the post-deploy smoke and record `APP_VERSION`, `GIT_SHA` and migration
      `0022_eminent_mongoose`.
- [ ] Verify the prior immutable artifact can be redeployed without rolling the
      database backward.

## Current decision

**NO-GO for beta.** Code/database rehearsal is green, but the candidate is not
immutable and real SMTP, MinIO, off-host media durability, CI and deploy-image
evidence are still missing. Legal wording and authenticated human device smoke
also require external sign-off.
