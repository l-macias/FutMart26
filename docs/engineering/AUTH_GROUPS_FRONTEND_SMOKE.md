# Auth + Groups frontend smoke

## Prerequisites

1. Start local PostgreSQL.
2. Define `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WEB_URL`, `ADMIN_URL` and `NEXT_PUBLIC_API_URL` in the root `.env`.
3. Apply migrations with the root environment loaded: `pnpm --filter @football/database db:migrate`.
4. Start the workspace with `pnpm dev`.

## Two-user happy path

1. Open `http://localhost:3000/auth` and create User A with email/password.
2. Complete the three F5 preference steps.
3. Open **Grupos**, create **Los del Martes**, and verify User A is `OWNER`.
4. Create a temporal invitation, copy its one-time displayed URL, and keep User A's window open.
5. Open that URL in an incognito window or a separate browser profile.
6. Choose **Unirme al grupo**. Register User B and verify the app returns to the same invitation URL without consuming it.
7. Press **Unirme al grupo** again explicitly.
8. Verify User B reaches the Group as `MEMBER`.
9. Refresh User A's Group detail and verify both memberships are visible.

Also verify an expired, revoked, exhausted, and blocked invitation shows product copy rather than raw API data. Never copy invitation tokens into logs, analytics, or persistent browser storage.
