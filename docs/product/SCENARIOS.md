# Product Scenarios

Estos escenarios son pruebas conceptuales del producto. No constituyen tests automatizados, pero deben orientar UX, dominio y criterios de aceptación.

## S01 — Partido semanal normal

**Precondición:** grupo activo, owner, miembros.

1. Owner crea partido F5 en DRAFT.
2. Configura fecha, hora, duración, cupo y lugar.
3. Publica.
4. Miembros reciben notificación configurada.
5. Jugadores se anotan.
6. Hasta capacidad → CONFIRMED.
7. Excedente → WAITLISTED.
8. Se juega.
9. Owner/mod confirma participantes reales.
10. Se abre votación.
11. Se cierra por todos votados o timeout.
12. Se procesa rating/progress.
13. Jugadores reciben resultados y progression reveal.

## S02 — Dos usuarios compiten por el último cupo

**Precondición:** 9/10 confirmados.

Dos requests llegan casi simultáneamente.

**Esperado:**

- solo una inscripción obtiene CONFIRMED;
- la otra queda WAITLISTED;
- nunca existen 11 confirmados;
- el orden depende de serialización server-side.

## S03 — Baja y promoción de suplente

1. Jugador confirmado se baja.
2. El primer waitlisted elegible asciende.
3. Se notifica al promovido.
4. La operación no puede promover dos veces al mismo jugador.
5. Owner/mod puede hacer override explícito.

## S04 — Baja y reinscripción

1. Jugador se anota.
2. Se baja.
3. Más tarde vuelve a anotarse.

**Esperado:** nueva posición en la cola. No recupera prioridad histórica.

## S05 — Guest de último momento cargado a tiempo

1. Antes del inicio, falta un jugador.
2. Owner agrega Guest "Pablo".
3. Pablo entra al roster.
4. Pablo puede ser evaluado.
5. Posteriormente se propone vincularlo a un Player real.
6. Player real debe aceptar.
7. Solo tras aceptar se transfiere el historial.

## S06 — Guest no cargado antes de comenzar

Pablo juega en la realidad pero nadie lo agregó antes del lock.

**Esperado:** no existe en rating/stats/votación del sistema para ese partido.

## S07 — Intento malicioso de vincular guest

Owner propone vincular un guest mal puntuado a otro jugador.

**Esperado:** no afecta al Player objetivo hasta que ese Player aprueba explícitamente.

## S08 — Suplente no juega

Estaba waitlisted o incluso fue incluido erróneamente, pero no jugó.

Antes de votar, owner/mod no lo marca como participante real.

**Esperado:** no suma partido, no vota, no es evaluado.

## S09 — Lesión

Jugador participa 10 minutos y se lesiona.

**Esperado:** cuenta como partido; puede votar; puede ser evaluado; no se modelan minutos.

## S10 — Partido con 9 jugadores

El objetivo era 10.

**Esperado:** puede jugarse igual. El cupo objetivo no bloquea el lifecycle.

## S11 — Partido cancelado

Owner cancela por lluvia/falta de gente.

**Esperado:** no genera participación jugada, rating ni stats deportivos.

## S12 — Cambio de horario

Partido pasa de 20:00 a 21:00.

**Esperado:**

- conserva inscriptos;
- notifica según preferencias;
- quien no pueda se baja o es removido;
- no hay reconfirmación obligatoria.

## S13 — Cambio F5 → F7 futuro

No se permite mutar disciplina.

**Esperado:** cancelar/retirar el partido F5 y crear otro F7 cuando exista esa disciplina.

## S14 — Owner abandona

1. Owner puede transferir manualmente.
2. Si no:
   - moderador más antiguo elegible;
   - si no, miembro activo más antiguo;
   - si no, archivar grupo.

La operación debe preservar un único owner.

## S15 — Moderador pierde permisos con pantalla abierta

Owner revoca permiso.

Moderador intenta guardar.

**Esperado:** backend devuelve autorización denegada aunque la UI siga desactualizada.

## S16 — Poco engagement en votación

Solo 2 de 10 votan.

**Esperado:**

- votación válida;
- confidence baja;
- menor impacto de progresión según configuración;
- no inventar votos restantes.

## S17 — Todos menos uno votan

La persona faltante no vota antes del deadline.

**Esperado:** cierre automático al vencer las 18h configuradas.

## S18 — Todos votan temprano

**Esperado:** cierre inmediato sin esperar deadline.

## S19 — Boleta extrema

Jugador coloca 1 a todos o 10 a todos.

**Esperado:**

- regla simple puede marcar anomalía;
- owner/mod autorizado recibe alerta;
- puede mantener o anular;
- no hay sanción automática.

## S20 — Puntuación coordinada injusta

Varios usuarios votan mal a alguien deliberadamente.

**Esperado:** el sistema no pretende resolver automáticamente conflictos humanos. El grupo es responsable de su gobernanza.

## S21 — Resultado desconocido

El partido se jugó pero nadie recuerda resultado.

**Esperado:** `result=UNKNOWN`; no convertir en empate estadístico.

## S22 — Empate conocido sin score

Todos saben que empataron pero no recuerdan el marcador.

**Esperado:** outcome DRAW, score UNKNOWN.

## S23 — Arquero juega también de campo

V1 requiere elegir una sola modalidad de evaluación para el partido.

**Esperado:** GOALKEEPER o FIELD_PLAYER; evaluación mixta queda en backlog.

## S24 — Primer partido de jugador nuevo

No existe evidencia previa.

**Esperado:**

- OVR inicial 60;
- matchmaking utiliza preferencias/self-report;
- confidence competitiva baja;
- después del partido comienza la evidencia real.

## S25 — Jugador vuelve tras un año

**Esperado:**

- conserva rating;
- historial muestra última fecha jugada;
- no existe decay automático en V1.

## S26 — Mismo día, múltiples grupos

Jugador disputa dos partidos F5 en grupos distintos.

**Esperado:** ambos alimentan el mismo perfil/rating F5 global en orden consistente de procesamiento.

## S27 — Progresión temprana

Jugador claramente superior comienza en 60.

**Esperado:** configuración inicial permite cambios relativamente fuertes en 60–70 para evitar progresión aburrida.

## S28 — Rating alto

Jugador 90+ tiene un partido bueno.

**Esperado:** progresión positiva mucho más difícil que en 60–70.

## S29 — Negativo aislado

Un partido marca juego aéreo como debilidad.

**Esperado:** caída pequeña o nula según configuración.

## S30 — Negativo recurrente

Múltiples partidos generan la misma señal negativa.

**Esperado:** recurrencia puede aumentar gradualmente el peso.

## S31 — Reveal sin cambio de OVR

Atributos cambian pero OVR redondeado se mantiene.

**Esperado:** reveal muestra cambios de atributos y OVR estable.

## S32 — Reveal sin evidencia suficiente

Confidence muy baja y señales débiles.

**Esperado:** puede no haber cambios; UI comunica ausencia de evidencia suficiente sin inventar progreso.

## S33 — Cambio de tier

OVR cruza umbral de card/tier.

**Esperado:** reveal especial, milestone persistido, card actual actualizada según reglas vigentes.

## S34 — Cambio de configuración de rating

Superadmin modifica negativeWeight.

**Esperado:** aplica solo a futuros cálculos; snapshots previos permanecen idénticos.

## S35 — Stats opcionales

Nadie carga goles/asistencias.

**Esperado:** partido y rating funcionan igualmente.

## S36 — Veedor

Un veedor autorizado registra stats.

**Esperado:** puede recibir permisos de captura sin convertirse en owner/mod global ni jugador.

## S37 — Corrección posterior del roster

Se abre votación y luego se detecta un participante incorrecto.

**Esperado:** corrección excepcional auditable; votos recibidos/emitidos por participante invalidado dejan de afectar rating. Agregados tardíos no fuerzan a usuarios ya votados a rehacer boleta.
