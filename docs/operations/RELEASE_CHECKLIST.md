# Release checklist V1

Fecha de closure: 2026-09-07. Una casilla sólo está marcada cuando existe
evidencia de esta revisión y del source actual. El drill anterior sobre `0022`
no se transfiere al worktree actual, que requiere `0023`.

## Code

- [x] El source completo está consolidado en el commit RC que contiene este
      checklist.
- [x] El commit RC se verificó con worktree limpio inmediatamente después de
      crearlo.
- [x] Typecheck, lint, tests, build, format y `git diff --check` pasan localmente.
- [x] Secret scan no encontró credenciales productivas trackeadas; sólo fixtures
      locales/CI explícitas.
- [x] `.dockerignore` excluye `.env`, Git, `.runtime`, dumps, reports y estado de
      build/test.

## CI

- [ ] El SHA exacto está pusheado.
- [ ] GitHub Actions `validate`, `e2e` y `container-build` están verdes.
- [ ] Se conservó URL/timestamp del workflow candidato.

## Database

- [x] La cadena `0000`–`0023` migró una DB única vacía.
- [x] Reejecutar migrations sobre esa DB fue idempotente.
- [x] El smoke obtuvo 41 tablas públicas y timestamp `1788371890300`.
- [ ] Se probó upgrade de una DB pre-release representativa después de backup.

## Backups

- [x] El script exige destino fuera del repo, dump no vacío, TOC válido y
      checksum SHA-256.
- [ ] `pg_dump`/`pg_restore` actuales ejecutaron contra el SHA candidato.
- [ ] El dump y su checksum remoto se copiaron y verificaron en bucket off-host
      privado; el sidecar de restore se reconstruyó y validó.
- [ ] Retention 14 daily / 4 weekly / 3 monthly está activa.
- [ ] Scheduler y señal de falla están activos.
- [ ] Restore drill DB actual pasó desde la copia off-host.

## Storage

- [x] Producción exige endpoint HTTPS y bucket S3-compatible privado.
- [ ] Bucket real y credenciales least-privilege están configurados.
- [ ] HeadBucket, upload, replace, delete y authenticated GET pasaron.
- [ ] Versioning/snapshot/mirror off-host está activo.
- [ ] Restore de un avatar real a un bucket de drill pasó.

## Mail

- [x] Producción exige SMTP/sender; STARTTLS está habilitado por defecto.
- [ ] Env real mantiene TLS obligatorio (no deshabilita STARTTLS sin TLS implícito).
- [ ] Provider, sender y credentials reales están configurados.
- [ ] Email de verificación fue recibido y abrió el dominio productivo.
- [ ] Email de recovery fue recibido; reset y token single-use pasaron.
- [ ] Falla SMTP real/simulada fue observada sin secret/token leak.

## Networking y TLS

- [x] Existe configuración reproducible Nginx para Web/Admin/API y redirect
      HTTP→HTTPS.
- [x] Proxy limita body a 9 MB frente al límite API de 8 MB y usa timeouts
      bounded.
- [ ] Dominios reales resuelven y los tres hosts sirven certificados válidos.
- [ ] `certbot renew --dry-run` pasó y renewal automático está activo.
- [ ] API sólo escucha públicamente a través del proxy confiable.
- [ ] Deep links reales no producen 404 de proxy.

## Security

- [x] CORS se limita a Web/Admin y mutations rechazan origin no confiable.
- [x] Cookies productivas se configuran Secure/HttpOnly según Better Auth.
- [x] Headers baseline y CSP existen en API/Web/Admin.
- [x] Errors conserva sólo mensajes sanitizados y logs redactan auth/cookies/
      passwords/tokens.
- [x] Sandbox seed exige base `_sandbox`; no forma parte del startup productivo.
- [ ] `DATABASE_URL` productivo fue inspeccionado y no apunta a sandbox/test/dev.
- [ ] Trusted proxy, cookies, CORS y headers se inspeccionaron sobre HTTPS real.
- [ ] Security smoke real no encontró auth bypass/IDOR/PII leak.

## Auth

- [ ] Register, verify, login, logout, forgot/reset y protected routes pasaron en
      el deployment candidato.
- [ ] Usuario normal fue rechazado en Admin y SUPERADMIN pudo operar.
- [x] Bootstrap SUPERADMIN requiere cuenta existente y comando explícito.

## User smoke

- [ ] Production-like smoke completo pasó contra containers.
- [ ] Production real smoke pasó para Home/Play/Match/Group/Rankings/Profile/
      Search/Notifications/avatar.
- [x] Critical App E2E del worktree local pasó 10/10 sin skips.

## Admin smoke

- [x] Admin E2E local pasó auth/search/mutación reversible/System/Audit.
- [ ] Overview, Reports, Errors y Audit pasaron en producción real.
- [ ] Admin System mostró versión, SHA, build timestamp y migration reales.

## Devices

- [ ] Android Chrome físico pasó el checklist autenticado.
- [ ] iPhone Safari físico pasó o existe waiver explícito aprobado.
- [ ] Desktop Chromium y Edge/Firefox pasaron el deployment real.
- [ ] No hubo overflow, console errors, hydration issues ni promises sin manejar.

## Legal

- [x] Gate técnico 18+, Terms, Privacy, Support y account deletion existen.
- [ ] Revisión legal profesional externa de Terms/Privacy/retención/soporte está
      aprobada para launch.

## Operations

- [x] Topología fija exactamente una instancia API.
- [x] Compose define restart, healthchecks, stop grace y rotación de logs.
- [x] Runbooks de deploy, incidentes y backup/restore están versionados.
- [x] `/health` es liveness; `/readiness` y `/ready` cubren DB/migration.
- [x] Error buffer está documentado como memory-only, capacity 200.
- [ ] Graceful SIGTERM fue probado dentro de container del candidato.
- [ ] Alertas mínimas de backup/disk/container están conectadas.
- [ ] Rollback de imagen previa fue ensayado sin rollback DB.

## Decisión

- [ ] Todos los requisitos GO están marcados.
- [x] Resultado actual: **NO-GO**.
