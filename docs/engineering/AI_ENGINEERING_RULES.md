# AI Engineering Rules

## Objetivo

Estas reglas gobiernan a Codex y otros agentes que trabajen en el proyecto.

## Scope discipline

- No implementar features fuera de `MVP_SCOPE.md`.
- No convertir una idea de backlog en código porque parezca útil.
- No ampliar una tarea silenciosamente.
- No refactorizar áreas no relacionadas.

## Architecture

- Mantener límites modulares.
- No introducir abstracciones salvo que:
  - eliminen duplicación real;
  - protejan un boundary;
  - aíslen una dependencia inestable;
  - sean necesarias por el alcance actual.
- No crear microservicios por anticipación.
- No hardcodear F5 de forma que bloquee disciplinas futuras.
- No acoplar Groups con futuras Competitions.

## Data integrity

Para toda mutación relevante evaluar:

- race conditions;
- idempotency;
- uniqueness;
- transaction boundaries;
- retries;
- partial failure.

## Persistence

- No usar memoria de proceso como fuente de verdad.
- Usar constraints cuando protejan invariantes.
- No hacer colecciones ilimitadas.
- Evitar N+1.
- No borrar evidencia histórica relevante.

## External effects

- Email/push/otros canales no deben bloquear transacciones críticas.
- Preferir side effects asíncronos y recuperables.
- Diseñar eventos derivados para eventual outbox/worker.

## Configuration

- No dispersar pesos/thresholds configurables como magic numbers.
- Configuración debe ser validada.
- Cambios de rating/progress aplican solo hacia adelante.
- No recalcular historia sin requerimiento explícito.
- No crear un motor de JavaScript/fórmulas libres administrables.

## Security

- Autorización server-side.
- Prevenir IDOR.
- Validar input.
- No exponer secretos.
- Auditar operaciones sensibles.

## Testing

Pruebas proporcionales al riesgo.

### Bajo riesgo

- typecheck;
- validación focal.

### Dominio

- tests de reglas/invariantes relevantes;
- typecheck.

### Concurrencia/seguridad

- tests específicos;
- escenarios de carrera;
- idempotencia;
- authorization.

No ejecutar suites pesadas no relacionadas por rutina.

## Completion

Antes de finalizar:

1. revisar diff;
2. comprobar alcance;
3. ejecutar validaciones relevantes;
4. reportar cambios;
5. reportar riesgos o decisiones pendientes;
6. no afirmar que algo funciona sin evidencia.

## Stop conditions

Detener y reportar antes de modificar si la solución:

- rompe un invariante;
- bloquea F7/F11/Leagues;
- exige cambiar Product Discovery frozen;
- introduce un riesgo serio;
- requiere un refactor transversal no contemplado.

## UI / Visual discipline

- Follow `VISUAL_DIRECTION.md`, `DESIGN_SYSTEM.md`, `CARD_SYSTEM.md` and `MOTION_SYSTEM.md`.
- Do not default to generic SaaS dashboard patterns.
- Do not introduce visual tokens directly in features when they belong to the design system.
- Do not use emojis as final iconography unless explicitly approved.
- Do not create a second implementation of an existing primitive/product component.
- Keep football-specific components separate from neutral UI primitives.
- Player card geometry is a compatibility contract once finalized.
- Motion is purposeful; celebration is reserved for meaningful progression events.
- A frontend feature must not become the authority for backend/domain rules.

## Maintainability

- Keep modules/features cohesive.
- Prefer narrow view models/contracts over passing broad domain/database objects through UI.
- Do not create abstractions merely to satisfy a pattern.
- A shared module/package needs either real reuse or a stable architectural boundary.
- Keep infrastructure adapters replaceable.
- Avoid circular dependencies and cross-module internals.
