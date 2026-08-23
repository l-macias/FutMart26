# Definition of Done

Una tarea no está terminada solo porque compile.

## General

- cumple acceptance criteria;
- no amplía scope;
- respeta Product Constitution;
- respeta Domain Rules;
- mantiene boundaries;
- no introduce deuda accidental importante;
- no rompe futuro confirmado.

## Correctness

- estados válidos;
- errores explícitos;
- no duplicación de efectos;
- constraints adecuados;
- transactions correctas cuando corresponda.

## Concurrency

Para mutaciones compartidas:

- race conditions analizadas;
- idempotencia definida;
- retries seguros;
- invariantes preservados bajo concurrencia.

## Security

- auth/authz server-side;
- IDOR revisado;
- input validation;
- secretos protegidos;
- audit cuando corresponda.

## Performance

- consultas acotadas;
- sin N+1 evidente;
- índices contemplados para access patterns;
- no cargar historia completa innecesariamente.

## Validation

Según riesgo:

- typecheck;
- tests focales;
- tests de dominio;
- tests de concurrencia;
- tests de authorization.

## Diff review

Antes de cerrar:

- sin archivos temporales;
- sin cambios no relacionados;
- sin dead code obvio;
- sin magic numbers que deban ser configuración;
- sin TODOs críticos ocultos.

## Final report

Debe indicar:

- cambios;
- validación;
- riesgos conocidos;
- follow-ups reales;
- decisiones que se dejaron deliberadamente fuera.
