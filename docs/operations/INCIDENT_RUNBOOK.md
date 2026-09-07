# Incident runbook V1

Prioridad: seguridad y datos, recuperabilidad, operación y luego funcionalidad.
Preservar `requestId`, SHA, timestamps, logs sanitizados y Audit. Nunca pegar
secrets, cookies, tokens, dumps o PII innecesaria en tickets.

## Secuencia común

1. **Detectar:** `/health`, `/readiness`, Admin System/Errors/Audit, logs y
   último backup exitoso.
2. **Contener:** sacar tráfico, bloquear una operación o rotar secret según el
   riesgo; no mutar evidencia deportiva manualmente.
3. **Diagnosticar:** correlacionar request ID, release SHA y dependency status.
4. **Recuperar:** aplicar la mínima acción reversible; rollback de app o restore
   sólo según su runbook.
5. **Verificar:** readiness + smoke afectado + ausencia de nuevos 5xx.
6. **Registrar:** causa, impacto, intervalo, datos afectados y follow-up.

## API down

- Detectar: health no responde/container exited.
- Contener: Nginx deja de enviar tráfico; no levantar una segunda réplica.
- Diagnosticar: `docker compose ps`, exit code y logs por SHA.
- Recuperar: corregir config o reiniciar una instancia; rollback si fue deploy.
- Verificar: health, readiness, login y Match read/join controlado.

## DB down

- Detectar: health 200, readiness 503/database unavailable.
- Contener: mantener API fuera de tráfico y pausar migrations/backups.
- Diagnosticar: proveedor, conexiones, disco, SSL y pool.
- Recuperar: restablecer DB; sólo restaurar ante pérdida/corrupción confirmada.
- Verificar: readiness, latest migration, counts críticos y Audit.

## Storage down

- Detectar: `prod:check`/Admin System degradado y errores de avatar.
- Contener: conservar la DB; no borrar referencias ni cambiar keys.
- Diagnosticar: bucket privado, endpoint/TLS, IAM, cuota y provider status.
- Recuperar: provider o recovery copy; restaurar keys en bucket nuevo si hace
  falta.
- Verificar: HeadBucket y avatar GET/upload/replace/delete controlado.

## SMTP down

- Detectar: delivery failures seguras; procesos y operaciones deportivas siguen
  activos.
- Contener: no deshabilitar verificación ni imprimir links/tokens.
- Diagnosticar: DNS, TLS mode, sender approval, quota y credentials.
- Recuperar: proveedor/config; reenviar desde flujo normal.
- Verificar: verificación y reset reales, dominio correcto, token single-use.

## Disco lleno

- Detectar: alertas del host, fallos de write/DB/log/container.
- Contener: detener builds y backups; no borrar DB/media a ciegas.
- Diagnosticar: images/cache, logs, DB, backups staging y MinIO.
- Recuperar: rotar/prunar sólo artefactos reproducibles y copias locales ya
  verificadas off-host.
- Verificar: espacio, DB, readiness y siguiente backup.

## Bad deploy

- Detectar: readiness/smoke falla después de un SHA nuevo.
- Contener: retirar el artefacto.
- Diagnosticar: diff, migrations y logs.
- Recuperar: imagen anterior si el schema es compatible; caso contrario
  forward-fix.
- Verificar: smoke y Admin System con SHA esperado.

## Migration failure

- Detectar: deploy job non-zero o readiness mismatch.
- Contener: no iniciar versión que depende del schema y no reejecutar en
  paralelo.
- Diagnosticar: migration exacta, locks y estado de journal.
- Recuperar: forward-fix revisado. Restore sólo por corrupción/pérdida.
- Verificar: migration id/timestamp, readiness y queries afectadas.

## Sospecha de incidente auth

- Detectar: logins anómalos, sesión indebida, reporte o leak.
- Contener: suspender cuenta, rotar secrets comprometidos, revocar sesiones y
  restringir tráfico. No impersonar.
- Diagnosticar: Audit, request IDs, origins, cookies y logs redacted.
- Recuperar: credenciales/sesiones/config; notificar según obligación legal.
- Verificar: login/logout/reset, autoridad normal y Admin denial.

## Error buffer y observabilidad mínima

Admin Errors conserva como máximo 200 eventos sanitizados en memoria y se pierde
al reiniciar el único API. No es un log persistente. Para V1 se complementa con
logs de container, health/readiness, Admin System, Audit, request IDs y estado de
backups. No escalar horizontalmente la API hasta externalizar limiters y este
estado operacional.
