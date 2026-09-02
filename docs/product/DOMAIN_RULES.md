# Domain Rules

## Global administration and moderation (V1)

1. `SUPERADMIN` is an Account-level grant. Player identity, Group OWNER and
   moderator capabilities never imply global administrative authority.
2. Suspension revokes sessions and blocks new product access while preserving
   Player IDs, memberships, Matches, statistics and historical evidence.
   Suspended Players are omitted from global discovery; the public reason is
   never disclosed.
3. Every sensitive administrative mutation requires a 5–500 character reason
   and appends a typed, immutable audit event with actor, target, request ID and
   timestamp.
4. Reports are resolved or dismissed independently from sanctions and are never
   deleted by the operational console.
5. Group archive retains the active-Match invariant and Match cancellation is
   limited to lifecycle states already cancellable by the product.
6. A ballot can be voided only before Progression materialization. Once any
   snapshot exists for the Match, sporting evidence remains read-only pending a
   future corrective ledger/reversal design.

## Ranking F5 de Group (V1)

1. Es una proyección privada de memberships `ACTIVE` y su
   `PlayerPerformance` F5 global; no existe un rating separado por Group.
2. Sólo se rankean Players con `processedMatchCount >= 1`. Guests y memberships
   `LEFT`, `REMOVED` o `BLOCKED` quedan excluidos.
3. El orden autoritativo es `internalOvr DESC`, `processedMatchCount DESC`,
   `playerId ASC`; las posiciones son ordinales y se calculan server-side.
4. No se persisten posiciones ni movimientos. Históricos y rankings por
   temporada son alcance futuro.

## Rankings F5 territoriales (V1)

1. Group, Venue, City, Province y Country proyectan el `PlayerPerformance` F5
   global; ningún scope posee rating separado ni posiciones persistidas.
2. La elegibilidad nace de al menos un Match F5 `FINISHED`, con sporting result
   `CONFIRMED`, participación `PLAYER + CONFIRMED + PLAYED`, Venue estructurada
   y `processedMatchCount >= 1`. Guests, `NO_SHOW`, `NOT_PLAYED`, cancelados y
   ubicaciones manuales quedan excluidos.
3. City se agrupa por `Venue.normalizedCity`; Courts de una Venue alimentan el
   mismo ranking. Un Player aparece una vez por scope con cantidad y última
   fecha jugada allí.
4. El orden es `internalOvr DESC`, `processedMatchCount DESC`, `playerId ASC`.
   No hay caducidad por inactividad en V1.
5. Country usa ISO 3166-1 alpha-2 y Province usa un código ISO 3166-2 compatible
   cuyo prefijo debe coincidir con Country. Los códigos, no sus labels, son la
   identidad autoritativa.
6. La geografía nunca se infiere desde City o address. Venues legacy incompletas
   conservan Venue/City Ranking; Country requiere `countryCode` y Province
   requiere ambos códigos.
7. Seasons, mínimos superiores a un partido, movimiento, histórico y discovery
   territorial amplio son alcance futuro.

## Ranking global y Discovery comparativa F5 (V1)

1. `GLOBAL` significa toda la plataforma autenticada, no un ranking mundial.
   Proyecta `PlayerPerformance` F5 actual con `processedMatchCount >= 1` y usa
   el mismo orden OVR, partidos procesados y Player id de los demás rankings.
2. Featured Players usa categorías explícitas: OVR actual, goles y asistencias
   válidos por `Match.scheduledAt`, y Awards por `awardedAt`, en ventanas de 7
   o 30 días. No existe score compuesto ni ponderación oculta.
3. Rising requiere al menos dos snapshots F5 procesados dentro de la ventana y
   un aumento neto positivo entre el `beforeOvr` del primero y el OVR actual.
   `NO_EVIDENCE` cuenta como snapshot pero no fabrica delta.
4. Featured Groups compara sólo Matches F5 `FINISHED` con sporting result
   `CONFIRMED`: cantidad de partidos, Players `PLAYED` distintos y goles del
   marcador. Es actividad, no calidad del Group.
5. Todos los read models son autenticados, derivados y acotados. No se
   persisten posiciones, featured data, counters ni índices de búsqueda.

## Perfil deportivo visible y Discovery (V1)

1. El perfil `/players/:playerId` y la búsqueda requieren autenticación; no son
   recursos anónimos ni indexables como contrato de producto.
2. El read model expone sólo identidad deportiva, Card/Performance F5 actual,
   preferencias declaradas, resumen válido de goles/asistencias y rewards
   acotados. Account, email, auth identities, memberships, Groups, historial de
   Matches, snapshots, Reveals, ballots y Notifications permanecen privados.
3. Los Awards públicos son informativos: no exponen `matchId`, Group ni enlaces
   a Reveals de terceros. Group `BLOCKED` no equivale a bloqueo social global.
4. Search global busca `Player.displayName` y nombres de Groups activos con
   resultados acotados. De Groups sólo expone id/nombre; nunca revela miembros,
   owner, Matches, invitaciones ni capabilities.

## Conexiones entre Players (V1)

1. Una conexión es privada, bilateral e independiente de Group memberships.
2. Cada par canónico admite como máximo una relación `PENDING` o `ACCEPTED`;
   solicitudes cruzadas no crean dos filas ni se aceptan automáticamente.
3. Sólo el destinatario acepta/rechaza, sólo el emisor cancela y cualquiera de
   los dos Players conectados puede eliminar la conexión.
4. Conectarse no habilita Groups, Matches, votos, Reveals, Progression History,
   datos de cuenta ni Profile privado adicionales.
5. Membership `BLOCKED` continúa siendo una regla exclusiva del Group, no un
   bloqueo social global.

## Group Activity / Stats (V1)

1. Activity y Stats son read models privados derivados; nunca reemplazan Match,
   Result, Progression, Rewards ni Ranking como autoridad.
2. Los promedios de goles usan sólo sporting results `CONFIRMED`; `NOT_PLAYED`
   cuenta como cierre pero no como partido jugado para ese denominador.
3. Conteos de Players usan memberships `ACTIVE`; métricas competitivas usan la
   misma elegibilidad del ranking (`processedMatchCount >= 1`). Guests no
   participan de esas métricas.
4. `PROGRESSION_APPLIED` exige outcome `APPLIED` y delta OVR distinto de cero;
   `NO_EVIDENCE` no se presenta como mejora.
5. El feed se ordena por timestamp real y stable id. No existe event log, cache
   persistida ni snapshot histórico del Group en V1.

## Player

1. Un jugador puede pertenecer a muchos grupos.
2. El rating F5 es global al jugador y recibe evidencia de todos sus partidos F5 válidos, sin importar el grupo.
3. Las estadísticas pueden desglosarse por grupo sin crear ratings competitivos distintos por grupo.
4. La información autodeclarada no es evidencia competitiva.
5. El self-report puede influir en cold start y matchmaking, pero su influencia disminuye con historial real.
6. El jugador no puede autoevaluarse.
7. Better Auth posee cuenta, credenciales y sesiones; `Player` posee la
   identidad futbolística mostrada por el producto.
8. `auth_user.name` sólo puede inicializar `Player.displayName` en el primer
   provisioning. Resolver sesiones posteriores nunca sobrescribe un Player ya
   existente.
9. El Player sólo edita su propio `displayName` mediante una operación `/me`.
   Es Unicode, no único, se normaliza externamente y admite entre 2 y 40
   caracteres visibles sin caracteres de control.
10. `displayName` es visible a usuarios autenticados en fichas, búsqueda,
    rankings y contextos deportivos compartidos. Email e identificadores de
    autenticación permanecen privados.
11. Editar roles F5, disponibilidad de arquero o fortalezas autodeclaradas no
    modifica PlayerPerformance, snapshots ni evidencia deportiva histórica.
12. La foto deportiva pertenece al Player y se representa mediante un
    `MediaAsset` `PLAYER_AVATAR` READY; Player nunca persiste URLs externas ni
    detalles del provider.
13. Sólo el actor puede reemplazar o eliminar su avatar. El replacement activa
    primero el nuevo asset y retira el anterior después; un fallo de storage no
    puede romper la referencia previamente activa.
14. Se conserva únicamente una rendition WebP saneada 4:5. Original, EXIF,
    ubicación y metadata del dispositivo no forman parte del dominio.
15. El avatar mostrado en Profile, ficha pública y Progression es siempre la
    imagen actual. No es evidencia histórica ni se snapshottea por Match.

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
9. `Player.displayName` y `Group.name` se resuelven en lectura; renombrar un
   Group no reescribe Matches, memberships ni evidencia histórica.
10. Renombrar el Group es autoridad del owner. Las demás operaciones usan las
    capabilities vigentes y siempre se validan server-side.
11. Archivar preserva memberships, Matches, rankings y actividad histórica.
    Un Group con algún Match `DRAFT`, `OPEN` o `STARTED` no puede archivarse:
    primero debe resolverse ese partido. Archivar nunca lo cancela de forma
    implícita.
12. Un Group `ARCHIVED` no admite nuevos Matches, invitaciones ni operaciones
    de roster, y queda fuera de Search y Featured Groups activos. Sus miembros
    conservan acceso de lectura a la historia que ya podían consultar.
13. Remove termina una membership sin bloquear reingreso. Block es exclusivo
    del Group, impide reingreso/invitaciones y no elimina historia. Unblock deja
    la membership en `REMOVED` y no reincorpora automáticamente.
14. El owner no puede ser removido o bloqueado. Transfer ownership es atómica;
    si el owner sale, la sucesión existente elige moderador o miembro elegible,
    y el último owner sólo puede salir archivando cuando no hay Matches activos.
15. Player memberships y Persistent Guests son identidades distintas. Archivar
    o quitar un Guest conserva su participación histórica y nunca lo convierte
    en Player.

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
11. Mientras está `DRAFT` u `OPEN`, un actor con `MATCH_MANAGE` puede cambiar
    fecha/hora, duración, capacidad y ubicación. La disciplina no forma parte
    del contrato de edición.
12. Reducir capacidad por debajo de los participantes confirmados se rechaza;
    nunca se demueven participantes ni se los mueve a waitlist de forma
    implícita.
13. Cancelar conserva Match y roster, cierra admisión/recruitment y no abre
    Voting ni Progression. Sólo `DRAFT` y `OPEN` pueden cancelarse por el flujo
    operativo normal.
14. `START` exige que cada participante confirmado tenga exactamente un equipo
    y congela roster y asignaciones.
15. El cierre deportivo comienza después de `START`: confirma asistencia
    `PLAYED`/`NO_SHOW`, resultado y stats. Puede corregirse únicamente durante
    la ventana autoritativa previa al inicio efectivo de Voting; después queda
    congelado. Correcciones posteriores requieren el futuro flujo operacional
    auditado, no una edición casual de manager.

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

1. La votación comienza efectivamente en el máximo entre fin programado + 15 minutos y confirmación del resultado deportivo, con roster final confirmado.
2. Ventana inicial: 18 horas desde ese inicio efectivo, configurable.
3. Desde el inicio efectivo quedan congelados roster final, estadísticas y resultado, exista o no una sesión materializada.
4. Cierra cuando:
   - votaron todos los elegibles; o
   - vence el plazo.
5. Votar es opcional.
6. Puede haber pocos votos y el resultado sigue siendo válido con menor confidence.
7. Puede evaluarse a compañeros y rivales.
8. Puede saltearse cualquier jugador.
9. No se permite autoevaluación.
10. El modo rápido permite hasta 3 positivos y hasta 3 negativos/destacados según definición UX.
11. El modo completo permite rating 1–10 por jugador y tags opcionales.
12. Fortalezas: máximo configurable, default 3.
13. Puntos bajos: máximo configurable, default 3.
14. Los jugadores no ven quién emitió una evaluación concreta.
15. Moderación sí conoce el autor de la boleta.
16. Patrones anómalos simples pueden generar alertas.
17. Owner/mod autorizado puede anular una boleta.
18. Una boleta anulada no afecta rating.
19. No existe antifraude social perfecto; el sistema no intenta inferir conspiraciones humanas.

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

## Achievements / Awards V1

1. Achievements y Awards son proyecciones; no reemplazan Match, Stats, Voting ni
   Progression como fuente de verdad.
2. Un achievement es único por Player y tipo. V1: `FIRST_MATCH`,
   `FIVE_MATCHES`, `TEN_MATCHES`, `FIRST_GOAL`, `HAT_TRICK`, `FIRST_ASSIST` y
   `HIGH_RATING` con rating agregado mínimo 8.0.
3. Un award pertenece a un Match y Player. V1: `TOP_RATED`, `TOP_SCORER` y
   `TOP_ASSIST`; todos los empatados válidos reciben el award.
4. `TOP_SCORER` y `TOP_ASSIST` requieren un máximo mayor que cero;
   `TOP_RATED` requiere rating agregado real.
5. Sólo un Player `CONFIRMED + PLAYED` con snapshot puede recibir rewards
   persistentes. Guests y `NO_SHOW` quedan excluidos.
6. `NO_EVIDENCE` cuenta para hitos por cantidad de partidos, pero no puede
   fabricar `HIGH_RATING` ni `TOP_RATED`.
7. Los grants son idempotentes, históricos y no modifican PlayerPerformance.

## Connections and directed invitations

1. Una Connection es una relación bilateral entre Players; no concede
   membership, participación ni capabilities.
2. Sólo una Connection aceptada permite emitir una invitación dirigida. Una
   invitación ya emitida conserva validez aunque luego se elimine la Connection.
3. La invitación dirigida a un Group debe aceptarse explícitamente y reutiliza
   las mismas reglas de ingreso, reingreso y `BLOCKED` que una invitación por
   token.
4. La invitación dirigida a un Match requiere membership activa en su Group y
   debe aceptarse explícitamente mientras el Match admita inscripciones.
5. Una invitación a Match no reserva cupo ni prioridad: su aceptación usa el
   admission order compartido y puede terminar `CONFIRMED` o `WAITLISTED`.
6. Las invitaciones por token siguen siendo el mecanismo para Players que no
   son Connections; ninguna variante permite saltar autorización o capacidad.

## Match recruitment V1

1. `openSpots` no se persiste: es `max(capacity - participantes CONFIRMED, 0)`.
   Players y Guests confirmados consumen cupo; la waitlist no.
2. Recruitment es una intención explícita del organizador y no se activa sólo
   porque existan lugares libres.
3. Las needs usan únicamente roles F5 existentes y expresan preferencias de
   convocatoria. No reservan cupo, no otorgan prioridad y no condicionan el
   admission ni el matchmaking.
4. Al guardar, las cantidades declaradas no pueden superar los lugares libres
   actuales. Un join posterior puede reducir los lugares sin reescribir esas
   prioridades históricamente declaradas.
5. Recruitment efectivo es `OPEN` sólo para un Match `OPEN`, habilitado y con
   cupo; pasa a `FULL` al llenarse y vuelve a `OPEN` si se libera un lugar.
6. Todo ingreso, incluida una invitación dirigida, continúa usando el admission
   order compartido de `MatchService.join` y puede terminar en waitlist.

## Goalkeeper evaluation

1. La evaluación puede ser FIELD_PLAYER o GOALKEEPER por participación.
2. V1 usa una sola modalidad de evaluación por jugador/partido.
3. Si alguien jugó ambos roles, el grupo/jugador elige cómo será evaluado.
4. Evaluación mixta queda fuera de V1.

## Historical integrity

1. No eliminar evidencia histórica necesaria para auditoría/progreso.
2. Cambios futuros de definiciones no deben alterar silenciosamente grants o progression snapshots pasados.
3. Objetos publicados con historia se cancelan/invalidan/archivan en lugar de desaparecer.

## Privacy, age and account lifecycle V1

1. La beta es sólo para personas de 18 años o más. `Player.dateOfBirth` es
   privada, se confirma una sola vez y la edad se deriva por calendario.
2. Las aceptaciones de Terms y Privacy son versionadas y pertenecen al usuario
   de autenticación, no al perfil deportivo.
3. `Player` y `Group` pueden ser `PUBLIC` o `PRIVATE`. PRIVATE se excluye de
   Search, Featured y rankings globales/territoriales, pero no borra evidencia
   contextual dentro de Groups y Matches legítimamente compartidos.
4. La visibilidad nunca expone email, fecha de nacimiento, sesiones, recovery,
   memberships privadas, votos individuales ni historial privado.
5. Eliminar una cuenta borra autenticación y datos sociales/personales
   separables; el Player se anonimiza y conserva su id como referencia de
   resultados, estadísticas, progression snapshots, rankings contextuales y
   awards ya confirmados.
6. La eliminación se bloquea si el actor es único owner con Matches activos;
   primero debe resolverlos o transferir ownership. No se cancelan partidos de
   forma implícita.
7. Los reportes son privados, actor-derived y no conceden al denunciante acceso
   adicional al recurso reportado.
