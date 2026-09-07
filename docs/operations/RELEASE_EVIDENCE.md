# Release evidence V1

## Decisión

**NO-GO — 2026-09-07.** El criterio exige evidencia operacional real. SMTP,
HTTPS, CI del candidato, Docker, backup off-host, restore actual, media
durability/restore, device QA y revisión legal siguen sin verificar.

## Identidad del candidato

| Campo | Evidencia |
| --- | --- |
| Parent auditado | `d523d5edd6659955bef1d23df45a1078421a7296` |
| SHA candidato | El commit único que contiene este archivo; resolver con `git rev-parse HEAD` |
| Branch | `main` |
| Fecha de closure | 2026-09-07, America/Buenos_Aires |
| Release freeze | RC local congelado; falta push y CI verde del SHA exacto |

El parent no representa el producto actual. Sólo el commit RC que contiene esta
evidencia puede taggearse y validarse; no debe desplegarse hasta cerrar el
checklist.

## Release inventory

| Área | Estado | Evidencia / gap |
| --- | --- | --- |
| Dockerfile targets API/Web/Admin | PARTIAL | Definidos, non-root, metadata/healthcheck; Docker no está instalado en este host |
| Production compose | PARTIAL | Single API, restart, healthchecks y log rotation versionados; no ejecutado |
| Reverse proxy | PARTIAL | Template Nginx HTTPS/redirect/proxy/body/timeouts versionado; sin dominios/certificados reales |
| Env contract | PARTIAL | Zod fail-fast, HTTPS storage/URLs y metadata requeridos; STARTTLS es default configurable, no una invariante forzada |
| Migrations | PASS local | DB única nueva; `0000`–`0023` + segunda ejecución; 41 tablas, `1788371890300` |
| DB backup | BLOCKER | Scripts endurecidos, pero `pg_dump`/`pg_restore` no están disponibles para drill actual |
| Off-host DB backup | BLOCKER | Uploader S3 verificable creado; no hay bucket/scheduler/ejecución real |
| Restore | BLOCKER | Runbook y guards existen; drill antiguo `0022` no sirve como evidencia de `0023` |
| Media storage/durability | BLOCKER | Adapter/bucket privado diseñados; endpoint/versioning/restore reales no verificados |
| SMTP | BLOCKER | Config requerida y STARTTLS por defecto; provider/sender/delivery real no verificados |
| Health/readiness | PASS local | `/health`, `/readiness` y alias `/ready`; DB/migration fail-closed |
| Version/revision | PASS code | `APP_VERSION`, full `GIT_SHA`, `BUILD_TIMESTAMP` requeridos y visibles en Admin; deployment no verificado |
| Shutdown | PASS unit / UNVERIFIED container | Controller idempotente/bounded; SIGTERM real de image pendiente |
| CI | BLOCKER | Workflow incluye validate/e2e/container-build; el RC local todavía no fue pusheado |
| Deployment docs | PASS | Runbooks y checklist versionados |
| Legal/device QA | BLOCKER externo/operacional | Requieren personas/infra reales |
| Kubernetes/Redis/HA | NOT REQUIRED V1 | Una API por ADR-017; no se agregaron |

## Production env contract

| Clase | Variables |
| --- | --- |
| Required API production | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WEB_URL`, `ADMIN_URL`, `SUPPORT_EMAIL`, `SMTP_HOST`, `MAIL_FROM`, `OBJECT_STORAGE_ENABLED=true`, endpoint/bucket/access/secret, `APP_VERSION`, `GIT_SHA`, `BUILD_TIMESTAMP` |
| Required frontend build | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION=true` |
| Optional/runtime tuning | pool/timeouts, log level, SMTP credentials for non-relay, region/path style, auth token TTLs |
| Operations only | `BACKUP_*`, `RESTORE_*`, `RELEASE_SMOKE_DATABASE_URL`, image registry/release tag/domain placeholders |
| Development only | localhost URLs, `PRODUCTION_RUNTIME=false`, disabled storage/email verification where explicitly allowed |
| Sandbox only | `SANDBOX_*`; los scripts sandbox rechazan targets que no terminan en `_sandbox`; esto no prueba que el API productivo rechace esa DB |

No valor secreto se registra en este documento.

## Evidencia ejecutada en esta closure

### Migration smoke

- Target: nombre único terminado en `_release_smoke`.
- El script rechazaba borrar un target preexistente; fue corregido para fallar si
  existe y eliminar únicamente la DB que él mismo creó.
- Primera ejecución: migrations `0000`–`0023` PASS.
- Segunda ejecución: PASS/idempotente.
- Resultado: 41 tablas públicas; latest timestamp `1788371890300`.
- Target temporal eliminado al finalizar.

### Secret/config review

- `git ls-files` contiene sólo `.env.example`, no `.env` real, keys/certs/dumps.
- Pattern scan encontró únicamente credenciales locales de PostgreSQL en CI/test.
- `NEXT_PUBLIC_*` se limita a URL pública API y flag público de verificación.
- Logger redacta Authorization, cookies, Set-Cookie, passwords y tokens.
- Admin System/Errors exponen estados y mensajes sanitizados, no valores.

### Production check

`pnpm prod:check` contra el env local terminó non-zero con
`prod:check requires NODE_ENV=production`. Es el fail-fast esperado, **no** un
PASS productivo. No existe un env real autorizado para ejecutar sus probes DB y
HeadBucket.

### Docker/CI

- `docker` no está instalado en el host de closure: image build/start/shutdown
  real UNVERIFIED.
- `gh` tampoco está disponible y el source no tiene SHA candidato: CI UNVERIFIED.
- GitHub Actions quedó preparado para construir los tres targets además de
  validate/e2e; se requiere un run real del SHA inmutable.

### Gates y E2E

- `pnpm typecheck`: PASS, 15/15 Turbo tasks.
- `pnpm lint`: PASS, 9/9 tasks.
- `pnpm test --force`: PASS, API 48/48, Web 43/43, sandbox guards 5/5 y
  contratos/rutas Admin PASS; 0 skipped.
- `pnpm build`: PASS para API, Web y Admin.
- `pnpm format:check`: PASS.
- `git diff --check`: PASS (warnings CRLF informativos, sin whitespace errors).
- `pnpm sandbox:guards`: PASS 5/5.
- `pnpm e2e:critical`: PASS 10/10 Chromium; incluye Admin.

El primer intento E2E reutilizó un bundle compilado para `localhost` mientras el
runner usa `127.0.0.1`, dejando 9 journeys en Auth. Se corrigió el runner para
construir siempre con el origen E2E exacto. Luego quedó un assertion Admin que
buscaba el enum/copy antiguo `report resolved`; se alineó con el copy congelado
`Reporte resuelto`. La repetición completa final fue 10/10.

Estos resultados locales no reemplazan CI ni production/container smoke.

La última ejecución Critical E2E pasó 10/10 en 40.4 s. Después se ajustó sólo
el guard de ubicación de backups y su regresión; typecheck, lint, tests completos,
build, formato y diff se repitieron. E2E no se repitió por ese cambio operativo.

### Límites adicionales de la revisión

- STARTTLS está habilitado por defecto, pero `SMTP_REQUIRE_TLS=false` no está
  rechazado por config. Verificar TLS obligatorio en el env real antes de release.
- Los guards del seed protegen targets del sandbox; no equivalen a un guard del
  `DATABASE_URL` productivo. Revisar explícitamente que no apunte al sandbox.
- El uploader guarda SHA-256 como metadata del dump remoto; no sube el sidecar.
  El restore exige reconstruirlo desde esa metadata y validar el contenido.
- HeadObject verifica tamaño y metadata, no descarga y recalcula el hash remoto.
  La integridad y recuperabilidad end-to-end quedan pendientes del restore drill.
- No se certificó ausencia de secretos en imágenes finales sin construirlas e
  inspeccionarlas. El scan local de source no reemplaza esa inspección.

## Seguridad y operación revisadas

- API en una sola instancia; limiters y Errors son process-local.
- CORS allowlist exacta Web/Admin y credentialed; mutations con Origin ajeno
  fallan.
- Better Auth usa secure cookies en production y trusted origins explícitos.
- Baseline headers/CSP/HSTS están configurados; falta inspección HTTPS real.
- Nginx sólo publica loopback containers, propaga IP/proto/request ID, limita
  upload a 9 MB y aplica timeouts bounded.
- Compose rota logs `10m × 3`, usa healthchecks/restart y stop grace de 20 s.
- El host conservaba 19.3 GB libres después de los gates finales; `.runtime`
  ocupaba 9.3 MB y los builds Next locales aproximadamente 1.58 GB.
  Docker/storage/DB reales requieren monitoreo
  separado.
- Upload API limita input a 8 MB y Sharp procesa en memoria sin temporales
  persistentes.
- SUPERADMIN bootstrap exige cuenta existente y comando explícito; la ejecución
  debe registrarse en el release/ops log porque el schema actual no modela audit
  de bootstrap sin inventar una migration.

## Blockers pendientes

| Clase | Severidad | Blocker |
| --- | --- | --- |
| CODE/RELEASE | P1 | RC local sin push ni CI del SHA exacto |
| INFRA | P1 | Docker images/containers no construidos ni probados |
| INFRA | P1 | SMTP/provider/sender y flows reales no verificados |
| INFRA | P1 | HTTPS/domains/cert renewal/trusted proxy reales no verificados |
| DATA SAFETY | P1 | Backup DB actual, upload off-host, scheduler y restore drill pendientes |
| DATA SAFETY | P1 | Media external durability y restore drill pendientes |
| OPERATIONAL | P1 | Production smoke y authenticated physical-device QA pendientes |
| EXTERNAL | P1 | Revisión legal profesional pendiente |

No hay evidencia en esta closure de un P0 de dominio nuevo; eso no compensa los
P1 operacionales.

## GO / NO-GO rule

GO requiere que todas las casillas obligatorias de `RELEASE_CHECKLIST.md` estén
marcadas con evidencia del mismo SHA. Hasta entonces la decisión permanece
**NO-GO**, sin excepciones implícitas.
