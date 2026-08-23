# Future Requirements

Estos requisitos están fuera del MVP pero son **confirmados**. La arquitectura V1 no debe implementarlos anticipadamente ni bloquearlos.

## F7

Debe poder añadirse como nueva disciplina con:

- rating independiente;
- atributos independientes;
- roles/posiciones independientes;
- reglas de goalkeeper independientes;
- matchmaking independiente/configurable;
- cards independientes;
- progression history independiente;
- evaluaciones independientes.

Un jugador puede tener F5 y F7 simultáneamente.

## F11

Mismos principios de F7, con posiciones más específicas y reglas deportivas propias.

No asumir que un atributo con el mismo nombre representa exactamente lo mismo entre disciplinas.

## Multi-discipline Groups

Un mismo grupo debe poder organizar en el futuro partidos F5, F7 o F11.

No debe requerirse crear un grupo distinto por disciplina.

La disciplina pertenece a la actividad/partido, no a la identidad del grupo.

## Leagues / Competitions

Módulo futuro separado de Groups.

Debe compartir jugadores y capacidades deportivas comunes, pero no depender estructuralmente del módulo Groups.

Posibles conceptos:

- Competition;
- Season;
- Team;
- Fixture;
- Standings;
- Registration;
- Ruleset;
- Discipline.

Una competición concreta probablemente fije disciplina/categoría por coherencia reglamentaria.

## Monetization

Fuera de V1 pero confirmada.

La arquitectura debe evitar acoplar el producto a la suposición de que todo será siempre gratuito.

No implementar planes/payments todavía.

## Configurability

A futuro, Superadmin debe poder administrar:

- disciplinas;
- atributos;
- pesos;
- rating/progression;
- confidence;
- matchmaking;
- card definitions;
- artwork/images;
- awards;
- achievements;
- stat definitions;
- activation windows;
- notification channels.

No convertir esto en un motor de código arbitrario ejecutable desde panel.

## Social layer — backlog no confirmado como core V1

Posibles capacidades:

- tablón de grupo;
- posts;
- replies;
- reactions;
- visibilidad pública/members-only;
- contenido automático post-match;
- mensajes privados.

Debe mantenerse separado del core deportivo.

## Discovery de jugadores — backlog

Posible búsqueda por:

- ciudad/zona;
- disciplina;
- posición/rol;
- rating;
- actividad;
- disponibilidad.

No diseñar V1 alrededor de esta feature, pero preservar perfiles deportivos reutilizables.
