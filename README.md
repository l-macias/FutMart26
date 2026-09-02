# F5 Groups

Plataforma F5 de fútbol amateur con identidad deportiva, Groups, Matches,
Voting, Progression, rewards, rankings, discovery y conexiones entre Players.
La release pública está recorriendo el roadmap pre-launch congelado; el producto
actual es F5-only.

## Monorepo

- `apps/web`: aplicación Player en Next.js 16.
- `apps/api`: API de dominio Fastify y authority del producto.
- `apps/admin`: consola operacional SUPERADMIN auditada.
- `packages/auth`: Better Auth y separación Auth identity / Player.
- `packages/contracts`: contratos REST Zod compartidos.
- `packages/database`: schema PostgreSQL, Drizzle y migrations.
- `packages/ui` y `packages/football-ui`: primitives y componentes deportivos.

Stack principal: pnpm workspaces, Turborepo, TypeScript strict, React,
TanStack Query, Fastify, PostgreSQL, Drizzle, Zod y Better Auth.

## Desarrollo local

Requisitos: Node.js 22+, pnpm 10 y PostgreSQL.

```bash
pnpm install
```

Copiar `.env.example` a `.env` y completar valores locales. Nunca versionar
secrets. En development, Auth imprime los links de verificación/recovery en la
consola del API; producción exige un `AuthMailService` real y no inicia sin él.
`AUTH_REQUIRE_EMAIL_VERIFICATION` y su equivalente público pueden mantenerse en
`false` para preservar usuarios piloto locales; producción las habilita por
defecto.

La foto deportiva usa object storage S3-compatible mediante un adapter del API.
El deployment actual usa MinIO, pero las variables permanecen agnósticas al
provider: `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`,
`OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY`,
`OBJECT_STORAGE_SECRET_KEY` y `OBJECT_STORAGE_FORCE_PATH_STYLE`. El bucket es
privado y debe existir previamente. En development puede dejarse
`OBJECT_STORAGE_ENABLED=false`: el producto inicia normalmente y sólo el upload
de avatar responde como no disponible. Tests usan storage in-memory.

Producción usa SMTP genérico (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`) y exige storage habilitado. Ningún
secret se incluye en la imagen; todos llegan por runtime environment/secrets.

Para aplicar migrations desde PowerShell cargando el `.env` raíz:

```powershell
cd packages/database
node --env-file=../../.env node_modules/drizzle-kit/bin.cjs migrate
cd ../..
```

El comando canónico desde el root es `pnpm db:migrate`. En producción se ejecuta
una sola vez como deploy step, nunca al iniciar cada API.

Iniciar Web (`:3000`), Admin (`:3001`) y API (`:4000`):

```bash
pnpm dev
```

Runtime productivo:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm prod:check
pnpm start
```

`/health` indica liveness sin consultar DB; `/ready` exige PostgreSQL y migration
0022 compatible. La topología launch usa **una sola instancia API** porque los
rate limits siguen siendo in-memory. El runbook de backup, restore, deploy y
rollback está en `docs/operations/PRODUCTION_RUNBOOK.md`.

La base de test usa `TEST_DATABASE_URL`; no debe apuntar a la base de desarrollo.

### Consola operacional

`apps/admin` corre en `ADMIN_URL` (por defecto `http://localhost:3001`) y
reutiliza Better Auth. Además de una sesión válida exige un grant global
`SUPERADMIN`. Para otorgarlo conscientemente a una cuenta existente:

```bash
pnpm --filter @football/api admin:grant --email=operator@example.com
```

El comando es idempotente y no imprime credenciales. La consola ofrece lookup
acotado, Reports, suspensión y moderación auditada; deliberadamente no incluye
SQL genérico ni impersonación.

## Gates

```bash
pnpm typecheck
pnpm lint
pnpm test --force
pnpm build
pnpm format:check
git diff --check
```

Los journeys críticos de navegador usan Playwright y una base dedicada
`football_e2e`; nunca `football_dev`:

```bash
pnpm exec playwright install chromium
pnpm e2e:critical
```

La preparación segura, fixtures y artifacts se documentan en
`docs/testing/E2E.md`.

## Rutas Player principales

- `/`: Home Global autenticado.
- `/play`: dashboard personal.
- `/groups` y `/groups/:groupId`: Groups privados.
- `/groups/:groupId/matches/new`: creación de Match.
- `/play/matches/:matchId`: Match Detail.
- `/play/matches/:matchId/teams`: Matchmaking.
- `/play/matches/:matchId/close`: cierre deportivo.
- `/play/matches/:matchId/voting`: Voting.
- `/play/matches/:matchId/progression`: Progression Reveal.
- `/profile`, `/profile/edit` y `/profile/progression`: identidad visual y
  carrera privada.
- `/profile/account`: contraseña y sesiones privadas.
- `/onboarding/compliance`: gate autenticado de mayoría de edad y policies.
- `/terms`, `/privacy` y `/support`: documentos y contacto públicos.
- `/auth/forgot-password`, `/auth/reset-password` y `/auth/verify-email`:
  lifecycle de cuenta email/password.
- `/players` y `/players/:playerId`: discovery y ficha autenticada.
- `/rankings/global`: ranking global F5.
- `/rankings/venues|cities|provinces|countries/:scope`: rankings territoriales.
- `/connections`, `/invitations` y `/notifications`.

Todas las rutas anteriores, salvo `/auth` y la preview de invitación por token,
viven bajo el layout Player y su `AuthGate`. Fastify conserva las decisiones de
dominio y autorización; Next.js actúa como capa de entrega web.

La documentación de producto, arquitectura y UX vive en `docs/`. Las decisiones
durables están en `docs/architecture/adr/`.
