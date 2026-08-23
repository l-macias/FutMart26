# Task Levels

## Level 0 — Trivial

Ejemplos:

- copy;
- label;
- pequeño ajuste visual;
- rename local seguro.

Flujo:
`inspect → implement → minimal validation`

## Level 1 — Normal

Ejemplos:

- componente;
- filtro;
- endpoint simple;
- campo no crítico.

Flujo:
`inspect → implement → typecheck/tests focales`

## Level 2 — Domain

Ejemplos:

- waitlist;
- guest linking;
- roster confirmation;
- voting;
- progression;
- matchmaking.

Flujo:
`inspect → plan → implement → domain tests → review`

## Level 3 — Critical

Ejemplos:

- auth;
- permissions;
- ownership;
- concurrency;
- rating engine;
- migrations estructurales;
- payment future;
- security-sensitive flows.

Flujo:
`architecture review → inspect → explicit plan → implement → focused tests → independent review`

## Escalation

Una tarea sube de nivel si:

- modifica invariantes;
- cruza módulos;
- toca datos históricos;
- altera permissions;
- puede generar race conditions;
- afecta futuras disciplinas/competitions;
- cambia contratos públicos.
