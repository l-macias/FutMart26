# Production runbook index

La operación V1 se divide en documentos verificables:

- `DEPLOYMENT.md`: topology, build, deploy, HTTPS, smoke y rollback.
- `BACKUP_RESTORE.md`: DB/media, off-host, retention, RPO/RTO y restore drill.
- `INCIDENT_RUNBOOK.md`: detección, contención, diagnóstico, recuperación y
  verificación por tipo de incidente.
- `RELEASE_CHECKLIST.md`: gate binario GO/NO-GO.
- `RELEASE_EVIDENCE.md`: evidencia del candidato actual y blockers.
- `KNOWN_RISKS.md`: riesgos aceptados y bloqueantes.
- `DEVICE_QA.md`: sign-off humano por browser/dispositivo.

La API de launch permanece en una sola instancia según ADR-017. Nunca ejecutar
sandbox seed, migrations concurrentes ni restore sobre la DB productiva.
