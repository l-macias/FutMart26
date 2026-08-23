# User Flows

## UF01 — Invitación y onboarding

1. Usuario recibe link.
2. Abre invitación.
3. Si no tiene cuenta → registro.
4. Completa perfil mínimo F5:
   - nombre visible;
   - rol preferido;
   - disponibilidad de arquero;
   - hasta 3 fortalezas;
   - nivel aproximado.
5. Entra al grupo.
6. Puede anotarse a partidos.

## UF02 — Crear partido

1. Owner/mod autorizado entra al grupo.
2. Crear partido.
3. Completa/acepta defaults:
   - F5;
   - fecha;
   - hora;
   - duración;
   - cupo;
   - lugar.
4. Guarda DRAFT.
5. Publica.
6. Se habilita inscripción y notificaciones.

## UF03 — Inscripción

1. Member abre partido.
2. Pulsa JUGAR.
3. Backend responde:
   - CONFIRMED; o
   - WAITLISTED.
4. UI refleja posición real.
5. Si se baja:
   - CANCELLED;
   - siguiente suplente puede ser promovido.

## UF04 — Guest

1. Antes de comenzar, owner/mod agrega guest.
2. Asigna nombre opcional.
3. Guest aparece en roster.
4. Después del partido puede ser evaluado.
5. Owner propone vínculo con Player real.
6. Player recibe solicitud.
7. Si acepta → se transfiere evidencia/historial.
8. Si rechaza → guest permanece separado.

## UF05 — Inicio y roster lock

1. Antes del inicio se pueden corregir participantes/guests.
2. Al comenzar se bloquea agregado de nuevos participantes para rating/stats.
3. El partido sigue aunque no se alcance cupo objetivo.

## UF06 — Confirmar participantes post-match

1. Finaliza horario/partido.
2. Owner/mod recibe aviso.
3. Pantalla muestra anotados/suplentes/guests.
4. Marca quién realmente jugó.
5. Marca rol de evaluación GOALKEEPER/FIELD_PLAYER cuando corresponda.
6. Confirma.
7. Se abre votación.

## UF07 — Voting rápido

1. Jugador recibe aviso.
2. Entra al partido.
3. Selecciona hasta 3 destacados.
4. Puede seleccionar hasta 3 peores/áreas negativas según UX final.
5. Puede añadir tags opcionales.
6. Envía boleta.

## UF08 — Voting completo

1. Jugador recorre participantes.
2. Puede puntuar 1–10.
3. Puede agregar hasta 3 fortalezas.
4. Puede agregar hasta 3 puntos bajos.
5. Puede saltear cualquiera.
6. No puede evaluarse.
7. Selecciona Top 3 opcional.
8. Envía.

## UF09 — Voting closure

Se cierra por:

- todos los elegibles votaron; o
- deadline configurable.

Después:

- se procesa confidence;
- rating;
- atributos;
- cards;
- awards;
- achievements;
- progression snapshot.

## UF10 — Progression Reveal

1. Jugador recibe “Resultados disponibles”.
2. Ve resultado/rating del partido.
3. Ve card anterior.
4. Se muestran deltas.
5. Ve nueva card.
6. Si cruza tier → reveal especial.
7. Ve awards/achievements.
8. Puede ir a perfil actualizado.
9. El snapshot queda en historial.

## UF11 — Progression History

Perfil F5:

- OVR actual;
- mejor OVR;
- card actual;
- milestones;
- tiempo/partidos hasta tiers;
- progression snapshots;
- stats globales;
- stats por grupo.

## UF12 — Matchmaking

1. Owner/mod abre armado.
2. Elige:
   - manual; o
   - inteligente.
3. Algoritmo intenta:
   - arquero por lado;
   - roles balanceados;
   - rating/capacidad balanceada;
   - self-report para nuevos.
4. Devuelve equipos.
5. Owner puede editar.
6. Confirma propuesta.

## UF13 — Cambio de horario

1. Owner/mod modifica hora/fecha.
2. Participantes permanecen.
3. Se notifica según preferencias.
4. Quien no pueda se baja o es removido.

## UF14 — Owner transfer

1. Owner elige nuevo owner.
2. Confirma transferencia.
3. Cambio atómico.
4. Si abandona sin transferir, se usa sucesión automática.

## UF15 — Suspicious ballot

1. Sistema detecta patrón simple.
2. Owner/mod autorizado recibe alerta.
3. Puede ignorar o anular.
4. Si anula, esa boleta deja de afectar resultados/progression.
