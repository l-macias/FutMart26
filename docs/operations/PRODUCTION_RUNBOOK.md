# Production Runbook

## Topology V1

```text
Reverse proxy / HTTPS
  ├─ Web (Next.js)
  ├─ Admin (Next.js)
  └─ API (exactly one instance)
       ├─ PostgreSQL
       ├─ private S3-compatible storage / MinIO
       └─ SMTP provider
```

The one-API-instance constraint is launch-critical because auth, report and
upload rate limits are process-local. Do not scale the API horizontally until a
shared rate-limit store is implemented. Web and Admin remain stateless.

## Pre-deploy

1. Confirm CI is green and the release artifact was built from the intended SHA.
2. Create a PostgreSQL backup outside the application host/repository.
3. Confirm object-storage durability: provider policy, volume snapshot or a
   tested `mc mirror` to a second destination.
4. Load production secrets through the runtime/container platform.
5. Validate environment and dependencies with `pnpm prod:check` after migrations.

## Deploy

1. Build or pull immutable `api`, `web` and `admin` images using the same Git SHA.
2. Run exactly one migration job: `pnpm db:migrate`.
3. Do not run migrations from API startup or concurrently from replicas.
4. Start API, Web and Admin with their production `start` scripts.
5. Route traffic only after API `/ready` returns 200.

Migrations are forward-only. Schema changes should follow expand/contract and
remain compatible with the previous app artifact for the immediate rollback
window. There are no automatic down migrations.

## Post-deploy smoke

- `/health` returns 200 without depending on PostgreSQL.
- `/ready` returns 200 and reports database/migrations ready.
- Web `/auth`, `/terms` and `/privacy` load.
- Admin loads and `/admin/system` contains no secrets.
- Perform one controlled verification/recovery email delivery test.
- Confirm object storage with the non-destructive HeadBucket readiness probe.
- Check JSON logs for the release SHA and unexpected 5xx responses.

## Backups

Set `DATABASE_URL` and an absolute `BACKUP_DIR` outside the repository, then run
`pnpm db:backup`. The script calls `pg_dump -Fc`, creates a timestamped file and
fails non-zero on errors.

Initial retention policy: seven daily, four weekly and three monthly copies.
Store them off-host, encrypted by the destination, with restrictive filesystem
permissions. Never commit or email a dump.

Database backups do not include avatar renditions. Protect MinIO/provider data
independently with volume snapshots, bucket versioning/replication, or a
scheduled `mc mirror` to a second failure domain. Test both recovery paths.

## Restore drill

Restore only to a new, empty, non-production database:

```bash
RESTORE_DATABASE_URL=postgresql://... \
RESTORE_DUMP_FILE=/safe/location/football.dump \
RESTORE_CONFIRM=RESTORE_NON_PRODUCTION \
pnpm db:restore
```

The script never falls back to `DATABASE_URL` and refuses an identical target.
After restore:

1. Run migrations against the restored URL.
2. Start one API instance against the restored DB.
3. Validate `/ready` and critical counts for accounts, Players, Groups, Matches,
   progression snapshots and audit events.
4. Validate representative avatar reads against restored/mirrored storage.
5. Record the drill date, duration and result.

## Rollback

Stop routing traffic to the failed artifact and redeploy the prior immutable
image. Do not automatically restore a database merely because an app rollout
failed. If a migration is incompatible with the previous artifact, deploy a
corrective forward migration or compatible app fix. A DB restore is an explicit
incident/data-loss action.

## Incident basics

- Remove traffic from an unready API; `/health` only proves liveness.
- Preserve request IDs, JSON logs, audit events and the affected release SHA.
- Rotate compromised runtime secrets; never paste them into tickets or logs.
- Suspend abusive accounts through Admin rather than modifying PostgreSQL.
- Do not edit Progression snapshots or historical sporting evidence manually.

## Runtime assumptions

- Production is HTTPS-only; secure cookies are mandatory.
- Set `TRUST_PROXY=true` only when the API is reachable exclusively through the
  trusted reverse proxy; keep it `false` otherwise.
- Fastify resolves `request.ip` under that policy and overwrites the internal
  `x-client-ip` header passed to Better Auth, so browser-supplied forwarding
  headers never directly key the auth rate limiter.
- Budget PostgreSQL as `API instances × DB_POOL_MAX`, plus migration and
  maintenance headroom. V1 defaults to one API × 10 connections.
- SMTP and private S3-compatible storage are required in production.
- External error collection may ingest stderr/JSON logs later; no SaaS is assumed.
