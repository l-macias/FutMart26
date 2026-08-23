# Module Boundaries

Esta estructura es conceptual. Los nombres físicos pueden cambiar durante arquitectura detallada, pero las responsabilidades no deben mezclarse arbitrariamente.

## Identity

Responsable de:

- account;
- Player;
- perfil;
- preferencias;
- identidad.

No calcula rating.

## Discipline

Responsable de:

- definiciones de disciplina;
- roles/positions;
- atributos disponibles;
- tipos de evaluación.

V1 expone solo F5.

## Groups

Responsable de:

- Group;
- membership;
- invitations;
- ownership;
- moderator capabilities;
- lifecycle del grupo.

No calcula performance.

## Matches

Responsable de:

- Match;
- schedule;
- status;
- duration;
- discipline reference;
- publish/cancel/start/finalize semantics.

No debe contener toda la lógica de inscripción/voting/rating.

## Participation

Responsable de:

- join;
- confirmed;
- waitlist;
- cancellation;
- promotion;
- guests;
- roster confirmation;
- played status.

Protege invariantes concurrentes de cupo/orden.

## Matchmaking

Responsable de:

- propuesta de equipos;
- balance;
- preferencias;
- cold start signals;
- pesos/configuración;
- resultado editable.

No es autoridad sobre rating.

## Voting

Responsable de:

- voting window;
- eligible voters/targets;
- ballots;
- skips;
- strengths;
- weaknesses;
- top picks;
- anomalies;
- voiding;
- closure.

No modifica atributos directamente.

## Ratings / Progression

Responsable de:

- rating;
- attribute evidence;
- confidence;
- progression calculation;
- snapshots;
- milestones;
- historical best.

Consume evidencia válida.

No conoce permisos de Groups salvo datos ya autorizados por contratos/eventos.

## Cards

Responsable de:

- card definitions;
- current/equipped card;
- tier transitions;
- card grants/history.

No debe implementar la fórmula del rating.

## Awards

Responsable de:

- award definitions;
- grants;
- snapshots/history.

## Achievements

Responsable de:

- achievement definitions;
- grants;
- uniqueness;
- history.

## Stats

Responsable de:

- goal/assist records;
- match outcome;
- unknown/draw semantics;
- audit/corrections.

## Notifications

Responsable de:

- notification events;
- user preferences;
- channels;
- delivery;
- retries.

No decide reglas deportivas.

## Administration

Responsable de:

- Superadmin configuration surfaces;
- validated config changes;
- activation/effective dates;
- audit.

No debe ejecutar código arbitrario.

## Future modules

### Competitions

Separado de Groups.

### Social

Posts/comments/reactions separados del core deportivo.

### Billing

Separado de identidad deportiva y Groups.
