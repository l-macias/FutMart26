# Development Workflow

## Fase actual

1. Product Discovery — cerrado.
2. Documentation / Development OS — actual.
3. Architecture design.
4. UX architecture.
5. Frontend-first prototype con mocks.
6. Dogfooding con escenarios.
7. Product corrections.
8. Product Freeze.
9. Backend + vertical slices.
10. Integración y release.

## Workflow por tarea

### 1. Definir tarea

Toda tarea relevante debe tener:

- objective;
- context;
- scope;
- out of scope;
- invariants;
- acceptance criteria;
- validation.

### 2. Inspección

Codex inspecciona:

- módulos afectados;
- patrones existentes;
- tests relevantes;
- decisiones documentadas.

No asumir arquitectura por nombres de archivo.

### 3. Plan proporcional al riesgo

Trivial: puede implementar directamente.

Dominio/arquitectura/seguridad: plan antes de cambios.

### 4. Implementación

Modificar solo lo necesario.

Mantener compatibilidad salvo autorización explícita.

### 5. Validación

Ejecutar checks proporcionales.

### 6. Review

Revisar:

- scope creep;
- correctness;
- races;
- authorization;
- data integrity;
- regressions;
- performance obvious issues;
- unnecessary complexity.

### 7. Cierre

Informar:

- qué cambió;
- archivos relevantes;
- validaciones;
- riesgos;
- qué quedó deliberadamente fuera.

## Product change policy

Después del Discovery Freeze:

- idea nueva → backlog;
- cambio de V1 solo por defecto fundamental, integridad, seguridad o futuro confirmado bloqueado.

## Frontend-first policy

El frontend mock debe funcionar como especificación ejecutable.

Los mocks deben representar estados/casos reales, no simples pantallas estáticas.

El objetivo es validar:

- flows;
- terminology;
- transitions;
- edge cases;
- user friction;
- contracts futuros.

No perfeccionar meses de UI antes de comenzar vertical slices reales.
