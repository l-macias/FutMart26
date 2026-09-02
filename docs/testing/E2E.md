# End-to-end testing

Integration 30 uses Playwright with Chromium for the launch-critical journeys.

## Database isolation

E2E never uses `football_dev`. Set `E2E_DATABASE_URL` to a database whose name
starts with `football_e2e`. If it is omitted locally, the runner derives
`football_e2e` from the host and credentials in `TEST_DATABASE_URL`.

`pnpm e2e:prepare` creates that exact database when missing, applies the
official Drizzle migrations and truncates only its product/auth tables. The
database-name guard runs before any destructive statement.

## Commands

```bash
pnpm exec playwright install chromium
pnpm e2e:critical
pnpm e2e
```

The Playwright configuration starts API, Web and Admin against the isolated
database. Workers are intentionally limited to one: deterministic shared-DB
execution is more valuable than parallelism for the beta baseline.

## Fixtures

Fixtures create accounts through Better Auth, mark the test email verified in
the isolated database, then complete compliance and football preferences via
the real API. Cookies are created only by Better Auth. Superadmin grants are
test data inserted directly into the isolated DB; no production backdoor or
test-only HTTP endpoint exists.

Each test uses unique names/addresses. The critical set covers auth/compliance,
Group and Match lifecycle, Voting/Progression, Player privacy, Admin report
operations, and a 390px responsive/avatar-crop smoke. Browser console errors
fail that responsive smoke.

On failure Playwright retains screenshots and video; trace is captured on the
first retry. CI uploads those artifacts only when the job fails.

## Performance dataset

`pnpm perf:read-models` uses only an `_e2e` or `_perf` database. It creates
1,000 Players, 100 Groups and 1,000 Matches inside a transaction, runs
`EXPLAIN (ANALYZE, BUFFERS)` for critical reads, prints timings, and rolls the
transaction back.
