# Domain Rules

## Player

1. Un jugador puede pertenecer a muchos grupos.
2. El rating F5 es global al jugador y recibe evidencia de todos sus partidos F5 válidos, sin importar el grupo.
3. Las estadísticas pueden desglosarse por grupo sin crear ratings competitivos distintos por grupo.
4. La información autodeclarada no es evidencia competitiva.
5. El self-report puede influir en cold start y matchmaking, pero su influencia disminuye con historial real.
6. El jugador no puede autoevaluarse.

## Discipline

1. V1 implementa solo F5.
2. El modelo debe representar explícitamente la disciplina.
3. Rating, atributos, positions/roles, cards, matchmaking y reglas de evaluación pertenecen a la disciplina.
4. No hardcodear propiedades deportivas F5 directamente sobre `Player` si eso bloquea F7/F11.

## Group

1. Un grupo activo tiene exactamente un owner.
2. Puede haber múltiples moderadores.
3. Los permisos de moderadores deben ser capacidades verificadas server-side.
4. El owner puede transferir ownership.
5. Si el owner abandona sin transferir:
   - owner → moderador más antiguo elegible;
   - si no existe → miembro activo más antiguo;
   - si no existe ningún candidato → grupo archivado.
6. Abandonar o ser expulsado no elimina historia deportiva.
7. Un grupo público no implica necesariamente libre incorporación.
8. La autorización nunca depende solamente del frontend.

## Match

1. V1 crea partidos F5.
2. Un partido publicado conserva historia; se cancela en vez de borrarse físicamente salvo que siga en DRAFT.
3. Fecha, hora y duración pueden cambiar.
4. Cambiar horario/fecha no desinscribe automáticamente jugadores.
5. Si un participante deja de jugar por el cambio, debe bajarse o ser removido.
6. La disciplina de un partido publicado no se muta.
7. Para cambiar de disciplina se crea otro partido.
8. El cupo objetivo no es una precondición para jugar.
9. El sistema no intenta inferir si un partido realmente ocurrió.
10. Si el owner no cancela un partido que no se jugó, es responsabilidad operativa del grupo.

## Registration / Waitlist

1. Un mismo jugador no puede tener dos participaciones activas en el mismo partido.
2. Cuando hay cupo, la inscripción queda CONFIRMED.
3. Sin cupo, queda WAITLISTED.
4. El orden es determinado por la serialización exitosa en backend/base de datos, no por reloj del cliente.
5. Dos inscripciones concurrentes nunca pueden exceder la capacidad.
6. Una baja libera cupo y promueve al primer suplente elegible por defecto.
7. El owner/mod autorizado puede hacer override manual.
8. Si alguien se baja y vuelve a anotarse, entra como nueva inscripción; no recupera posición anterior.
9. Las transiciones deben ser idempotentes y protegidas contra duplicados.

## Participation / Played

1. Estar anotado no garantiza haber jugado.
2. Antes de abrir votación, owner/mod autorizado confirma quién realmente participó.
3. Quien no fue debe ser removido de la lista de participantes jugados.
4. Un suplente solo cuenta si fue marcado como participante real.
5. Una lesión no invalida participación: si jugó, cuenta.
6. No se modelan minutos jugados en V1.
7. Un participante válido:
   - suma partido;
   - puede votar si tiene cuenta real;
   - puede ser evaluado;
   - puede recibir stats.
8. Participar no obliga a recibir rating si no hubo evidencia suficiente.

## Guests

1. Puede haber múltiples guests.
2. Cada guest puede tener un nombre opcional.
3. Un guest debe agregarse antes del lock del roster/inicio del partido.
4. Una vez iniciado el partido no se agregan nuevos participantes para efectos de rating/stats.
5. Si alguien jugó en la realidad pero no fue cargado antes del lock, no participa en la historia de la app para ese partido.
6. Un guest puede ser evaluado.
7. Un guest sin cuenta no vota.
8. Guest → Player requiere:
   - propuesta explícita;
   - aprobación del Player real;
   - vínculo único;
   - auditoría.
9. Ningún guest puede afectar el historial de un Player real sin consentimiento de ese Player.
10. Al aceptar el vínculo se transfiere la participación/evidencia válida al perfil real y el guest deja de ser la identidad visible principal del registro.

## Voting

1. La votación abre solo después de confirmar roster post-partido.
2. Ventana inicial: 18 horas, configurable.
3. Cierra cuando:
   - votaron todos los elegibles; o
   - vence el plazo.
4. Votar es opcional.
5. Puede haber pocos votos y el resultado sigue siendo válido con menor confidence.
6. Puede evaluarse a compañeros y rivales.
7. Puede saltearse cualquier jugador.
8. No se permite autoevaluación.
9. El modo rápido permite hasta 3 positivos y hasta 3 negativos/destacados según definición UX.
10. El modo completo permite rating 1–10 por jugador y tags opcionales.
11. Fortalezas: máximo configurable, default 3.
12. Puntos bajos: máximo configurable, default 3.
13. Los jugadores no ven quién emitió una evaluación concreta.
14. Moderación sí conoce el autor de la boleta.
15. Patrones anómalos simples pueden generar alertas.
16. Owner/mod autorizado puede anular una boleta.
17. Una boleta anulada no afecta rating.
18. No existe antifraude social perfecto; el sistema no intenta inferir conspiraciones humanas.

## Rating / Progression

1. Rating inicial F5: 60.
2. Rating y atributos usan precisión interna; la card puede mostrar enteros.
3. La progresión no es lineal.
4. Ratings bajos deben poder moverse más rápido que ratings altos.
5. Ganancia y pérdida pueden usar sensibilidades diferentes.
6. Negativos aislados tienen menos impacto que evidencia positiva equivalente.
7. La recurrencia puede aumentar el peso de negativos repetidos.
8. Confidence reduce o amplifica la magnitud efectiva de la evidencia.
9. Todos los parámetros relevantes deben ser configurables de forma segura.
10. Cambiar configuración aplica solo a cálculos futuros.
11. Nunca recalcular automáticamente la historia por cambios de configuración.
12. Cada partido procesado genera un snapshot before/after.
13. El historial debe poder explicar qué cambió y cuándo.
14. El OVR puede no cambiar aunque cambien atributos.
15. Puede no haber cambios si la evidencia es insuficiente.
16. La card/tier y el rating son conceptos relacionados pero independientes.
17. Los hitos históricos no desaparecen porque el rating actual baje.

## Stats

1. V1 soporta goles y asistencias opcionales.
2. No registrar stats es válido.
3. El resultado puede ser desconocido.
4. `UNKNOWN` no equivale a empate.
5. Puede conocerse un empate sin conocer score exacto.
6. Owner/admin autorizado es autoridad final operativa en el grupo.
7. Correcciones relevantes deben quedar auditables/visibles donde corresponda.

## Goalkeeper evaluation

1. La evaluación puede ser FIELD_PLAYER o GOALKEEPER por participación.
2. V1 usa una sola modalidad de evaluación por jugador/partido.
3. Si alguien jugó ambos roles, el grupo/jugador elige cómo será evaluado.
4. Evaluación mixta queda fuera de V1.

## Historical integrity

1. No eliminar evidencia histórica necesaria para auditoría/progreso.
2. Cambios futuros de definiciones no deben alterar silenciosamente grants o progression snapshots pasados.
3. Objetos publicados con historia se cancelan/invalidan/archivan en lugar de desaparecer.
