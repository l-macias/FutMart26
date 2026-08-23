# Scalability and Concurrency

## Objetivo

La V1 no necesita infraestructura para millones de usuarios, pero debe evitar decisiones que obliguen a rehacer el dominio al crecer.

## Escala objetivo conceptual

Debe ser posible evolucionar desde:

App → API → Modular Monolith → PostgreSQL

hacia:

Clients → Load Balancer → múltiples API stateless → DB/replicas/cache/workers/queue/object storage/CDN

sin reescribir las reglas centrales.

## Principios

### Stateless backend

No guardar business state crítico únicamente en proceso.

### Concurrency correctness

Toda mutación con recursos compartidos debe analizar explícitamente:

- race condition;
- lost update;
- double execution;
- stale authorization;
- retry;
- partial failure.

### Registration race

Caso crítico:

- 9/10 confirmados;
- dos usuarios intentan entrar.

Debe garantizar:

- uno CONFIRMED;
- uno WAITLISTED;
- jamás 11 CONFIRMED.

No usar check-then-write desprotegido.

### Waitlist race

Dos bajas concurrentes no pueden:

- promocionar dos veces al mismo usuario;
- perder una promoción;
- romper orden.

### Idempotency

Operaciones retriables deben ser idempotentes donde corresponda:

- join;
- cancel;
- submit ballot;
- guest link confirmation;
- progression processing;
- achievement/card grant.

### Database constraints

La base debe proteger invariantes además del application layer.

Ejemplos conceptuales:

- unique membership;
- unique active participation;
- unique ballot key;
- unique achievement grant;
- single owner semantics;
- guest link uniqueness.

### Transactions

Usar transacciones para cambios que deben ocurrir juntos.

No mantener locks largos por operaciones externas.

### Transactional Outbox

Cuando una mutación crítica deba producir eventos derivados, contemplar outbox transaccional.

V1 puede usar implementación sencilla, pero debe evitar:

1. commit del estado;
2. crash;
3. evento perdido.

### Async side effects

No bloquear transacciones críticas por:

- email;
- push;
- analytics;
- progression reveal generation;
- card artwork;
- external APIs.

### Bounded queries

Nunca endpoints sin límite sobre colecciones potencialmente grandes.

Usar:

- pagination;
- cursor pagination donde sea útil;
- filtros;
- límites.

### N+1

Analizar todos los listados y perfiles para evitar queries por fila.

### Indexing

Índices deben surgir de patrones reales de acceso:

- matches por group/date;
- participation por match/status/order;
- ballots por match/voter;
- player discipline profile;
- progression por player/discipline/date;
- stats por player/group/discipline.

### Read models

Perfiles y dashboards pueden usar summaries/materialized read models.

No recorrer toda la historia en cada apertura.

### Caching

Agregar solo cuando mediciones indiquen necesidad.

El cache no debe ser fuente primaria de integridad.

### Horizontal scaling

APIs stateless y jobs desacoplados deben permitir múltiples instancias.

### Partitioning / sharding

No implementar en V1.

Mantener keys y access patterns que permitan introducirlos si el volumen real lo requiere.

## Rendimiento vs integridad

Prioridad:

1. data integrity;
2. concurrency correctness;
3. recoverability;
4. performance optimization medida.

Un endpoint rápido que corrompe estado no es aceptable.
