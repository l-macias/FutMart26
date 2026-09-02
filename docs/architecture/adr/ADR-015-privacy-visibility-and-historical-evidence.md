# ADR-015 — Privacy visibility and historical sporting evidence

## Status

Accepted.

## Context

La beta necesita consentimiento versionado, acceso +18, controles simples de
discovery y eliminación de cuenta sin destruir resultados deportivos de otros
Players. Auth identity, Player y evidencia histórica tienen authorities
distintas.

## Decision

- Better Auth conserva credenciales, sesiones y eliminación del auth user.
- `Player.dateOfBirth` es nullable para legacy, privada y first-write-only. La
  edad se deriva; no se persiste.
- Policy acceptances referencian `auth_user` por tipo y versión.
- Player y Group usan `PUBLIC | PRIVATE`; el modelo deja una seam para políticas
  futuras sin introducir ACL granular.
- PRIVATE excluye discovery global, no evidencia contextual autorizada de Group
  o Match.
- La eliminación invoca un hook de Better Auth que primero termina memberships,
  elimina media/social data y anonimiza Player; luego Better Auth elimina la
  cuenta y la FK nullable se desvincula con `ON DELETE SET NULL`.
- La historia confirmada referencia el Player anonimizado y no se reescribe.
- Reportes usan targets tipados y validación de visibilidad en servicio; sólo el
  futuro módulo operativo puede resolverlos.

## Consequences

Una eliminación puede requerir transferencia de ownership o resolver Matches
activos. Los rate limits de reportes son por instancia en V1 y deberán alinearse
con la topología de producción en Integration 29. Los textos legales V1 son una
base de producto y requieren revisión profesional para la jurisdicción de
lanzamiento.
