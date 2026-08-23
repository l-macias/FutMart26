# Security

## Authorization

Toda mutación valida server-side:

- actor;
- resource;
- group/match context;
- capability;
- current membership state.

Nunca confiar en botones ocultos o permisos cacheados en frontend.

## IDOR

IDs no son autorización.

Conocer `groupId`, `matchId`, `playerId`, etc. nunca concede acceso.

## Invitations

Los links privados deben usar tokens de alta entropía.

No exponer mecanismos adivinables.

Almacenar hash del token cuando corresponda.

Preparar soporte conceptual para:

- expiry;
- max uses;
- revoke.

## Guest linking

Guest → Player requiere consentimiento del Player real.

Protección contra atribución maliciosa.

## Voting privacy

Jugadores no ven el autor de evaluaciones individuales.

Moderación puede identificar boletas para administración/anulación.

## Input validation

Validar:

- IDs;
- estados;
- enums;
- límites numéricos;
- textos;
- uploads;
- timestamps;
- config del Superadmin.

## Rate limiting

Preparar protección para:

- auth;
- invitation endpoints;
- voting;
- uploads;
- future search/public endpoints.

## CSRF

Si se usa auth basada en cookies, aplicar estrategia CSRF adecuada para mutaciones.

## Session/auth

Elegir posteriormente proveedor/estrategia, pero evitar:

- tokens sensibles en logs;
- credenciales en frontend;
- autorización derivada de claims stale sin control cuando la operación sea sensible.

## Audit

Registrar acciones críticas:

- ownership transfer;
- permission changes;
- participant corrections;
- vote voiding;
- guest linking;
- stats corrections;
- config changes;
- match cancellation.

## Superadmin

Separar claramente administración global de administración de grupos.

Los cambios de configuración deben:

- validarse;
- auditarse;
- tener actor;
- effective date/version cuando corresponda;
- no ejecutar código arbitrario.

## File/image uploads

Usar object storage/adapters, no blobs grandes dentro de tablas principales.

Validar tipo/tamaño y servir de forma segura.

## Data minimization

No recopilar datos personales sin necesidad de producto.

Evitar hacer públicos datos sensibles por defecto.

## Historical data

Expulsión/abandono no debe borrar evidencia histórica necesaria.

La privacidad futura debe distinguir entre conservar integridad interna y exponer información públicamente.
