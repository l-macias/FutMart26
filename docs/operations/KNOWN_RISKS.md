# Known release risks

Snapshot del closure local del 2026-09-07. Ver evidencia completa en
`RELEASE_EVIDENCE.md`.

| Severidad | Clase | Riesgo | Mitigación requerida | Decisión |
| --- | --- | --- | --- | --- |
| P1 | CODE/RELEASE | El RC local aún no fue publicado y no existe CI del SHA exacto. | Push explícitamente autorizado, CI verde y conservación de URL/timestamp. | Block release. |
| P1 | CI/INFRA | Docker/gh no están disponibles en el host; los targets y el nuevo job `container-build` no tienen ejecución real del RC. | CI verde y build/start/SIGTERM de las tres imágenes en host Docker. | Block release. |
| P1 | INFRA | SMTP real, sender aprobado y delivery verification/reset no fueron configurados ni probados. | Configurar provider/TLS y completar ambos flows con cuenta controlada. | Block release. |
| P1 | DATA SAFETY | El host no tiene `pg_dump`/`pg_restore`; no hay dump/restore actual de `0023`, bucket off-host, scheduler ni retention verificados. | Instalar clientes compatibles, crear dump+checksum, subir off-host y restaurar desde esa copia. | Block release. |
| P1 | DATA SAFETY | Media privada funciona por adapter, pero no hay provider externo/versioning o mirror ni restore drill real. | Provisionar storage en otra failure domain y recuperar una key de avatar de prueba. | Block release. |
| P1 | NETWORK | Dominios, TLS, redirect, Certbot renewal, trusted proxy, cookies y CORS no se observaron en infraestructura real. | Desplegar template, `nginx -t`, `certbot renew --dry-run` y smoke HTTPS. | Block release. |
| P1 | OPERATIONAL | No existe production/container smoke ni QA autenticado en dispositivos físicos con mail/storage reales. | Ejecutar checklist en Android Chrome, iPhone Safari o waiver explícito y desktop browsers. | Block release. |
| P1 | EXTERNAL | Terms/Privacy/retención/soporte no tienen revisión legal profesional acreditada. | Aprobación externa y versionado de cualquier corrección requerida. | Block release. |
| P2 | ARCHITECTURE | Auth/upload/report limits y Errors son process-local; reiniciar borra counters/buffer y no hay replica failover. | Mantener exactamente una API según ADR-017; externalizar sólo antes de escalar. | Aceptable V1 si se cumple topology. |
| P2 | OPERATIONS | Los logs locales están rotados en Compose, pero no hay alerta real de disk/backup/container. | Conectar signal mínima del host/provider antes de datos reales. | Debe cerrarse con infra. |
| P3 | TEST TOOLING | Playwright/Next emite warnings benignos `NO_COLOR`/`FORCE_COLOR`. | Backlog; no afecta producto ni assertions. | No bloquea. |

El closure corrigió dos defects del tooling: el smoke de migrations ya no puede
borrar una DB preexistente y el runner E2E ya no reutiliza un bundle compilado
para otro origin. La repetición final local fue 10/10. No se detectó un P0 de
dominio nuevo, pero los P1 operacionales sostienen **NO-GO**.
