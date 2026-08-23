# Architecture Principles

## 1. Modular monolith first

V1 debe comenzar como monolito modular.

No introducir microservicios sin evidencia de necesidad operacional.

La modularidad debe provenir de límites de dominio, contratos y ownership de datos, no de procesos separados.

## 2. High cohesion, low coupling

Cada módulo es dueño de sus reglas.

Evitar lógica transversal dispersa.

Ejemplo:

- Participation decide inscripción/waitlist.
- Voting decide elegibilidad de voto.
- Rating consume evaluaciones válidas.
- Notifications consume eventos y decide canales.

## 3. Future-aware, not future-built

Diseñar límites que permitan:

- F7;
- F11;
- Leagues;
- monetización;
- nuevos engines/configuraciones.

No construir sus features hoy.

## 4. Stateless application layer

Ningún estado de negocio crítico debe existir solo en memoria de una instancia.

La API debe poder escalar horizontalmente.

## 5. Server-side invariants

La integridad se garantiza en backend/base de datos.

Frontend es experiencia, no autoridad.

## 6. Database constraints are part of correctness

Usar constraints/transactions/locking/atomic operations donde corresponda para proteger:

- owner único;
- participación única;
- capacidad;
- voting uniqueness;
- achievement uniqueness;
- guest linking;
- state transitions.

## 7. Domain events for decoupling

Preferir eventos internos para consecuencias derivadas.

Ejemplo:
`ParticipantPromoted` → Notifications.

No implica Kafka ni broker externo en V1.

## 8. Synchronous core, asynchronous side effects

Síncrono:

- inscripción;
- cancelación;
- permisos;
- roster;
- voto persistido cuando necesita confirmación inmediata.

Asíncrono cuando sea seguro:

- emails;
- notifications;
- progression processing;
- achievements;
- card processing;
- analytics.

## 9. Preserve evidence

Guardar suficiente evidencia para:

- auditoría;
- progresión;
- historial;
- explicación;
- cambios futuros de algoritmos sin recalcular pasado.

## 10. Configuration is data

Pesos, thresholds y definiciones configurables no deben vivir como constantes dispersas.

La configuración debe validarse, versionarse/effective-date cuando corresponda y aplicarse prospectivamente.

## 11. No generic rule-engine overengineering

Superadmin puede ajustar primitivas conocidas.

No permitir JavaScript/fórmulas arbitrarias ejecutadas desde panel.

## 12. Read optimization without corrupting domain

Puede haber summaries/read models/materialized projections para perfiles y listados.

No obligar a recomputar toda la historia en cada request.

## 13. External services are replaceable

Email, push, storage, etc. deben estar detrás de interfaces/adapters.

Una caída externa nunca debe invalidar una mutación deportiva ya confirmada salvo requisito explícito.

## 14. History over destructive mutation

Publicado/jugado/histórico se cancela, invalida o archiva.

Evitar DELETE físico de entidades con relevancia histórica.

## 15. Observability from the start

Operaciones críticas deben poder trazarse:

- request/command;
- actor;
- resource;
- result;
- failure;
- duration;
- config version relevante.

## 16. Feature ownership over folder-by-type sprawl

Frontend and backend code should be organized around responsibility/feature boundaries.

Avoid giant shared folders where unrelated logic accumulates.

## 17. UI architecture is architecture

Visual consistency and component ownership are not cosmetic concerns.

Neutral primitives, football-specific components and feature workflows must remain distinct.

## 18. Card geometry is a product contract

The card system uses dynamic application content over interchangeable artwork/skins.

Once the master geometry is frozen, arbitrary feature-level variants must not break its anchors/safe areas.
