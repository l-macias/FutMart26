# User Flows

## Contrato canónico de navegación V1

Estos recorridos congelan la intención entre superficies antes del rediseño
visual. Los pasos detallados de dominio documentados debajo siguen vigentes.

1. **Login → Home → Partido:** login/compliance termina en la experiencia
   autenticada; Home abre el partido current/next en
   `/play/matches/:matchId`.
2. **Home → Jugar → Join:** Home sólo anticipa oportunidades; `/play` posee la
   lista bounded y Match Detail ejecuta `Anotarme` contra authority del API.
3. **Grupo → Partido:** Group Overview destaca el próximo partido y navega al
   mismo Match Detail canónico.
4. **Partido finalizado → Votación → Progresión:** sólo un jugador `PLAYED`
   elegible recibe `Votar ahora`; luego usa el reveal propio cuando está
   disponible. `Sin evidencia` es un resultado válido.
5. **Rankings → Perfil público:** cada jugador permitido abre
   `/players/:playerId`; el ranking conserva scope/contexto en la URL.
6. **Search → Jugador → Conectar/Invitar:** `/search?q=` separa Jugadores y
   Grupos; el perfil público expone sólo acciones autoritativas.
7. **Notificación → Target:** dropdown, inbox y Home Attention usan el mismo
   target del servidor y sincronizan read/unread.
8. **Propietario/Moderador → Grupo → Gestión:** Group Overview conserva la
   experiencia de miembro; `Administrar grupo` abre
   `/groups/:groupId/settings` según capabilities.
9. **Perfil → Configuración:** `/profile` conserva identidad/carrera y
   `/profile/settings` concentra perfil, F5, cuenta, legal y riesgo.

Destinos canónicos: jugador `/players/:playerId`; perfil propio `/profile`;
configuración `/profile/settings`; grupo `/groups/:groupId`; partido
`/play/matches/:matchId`; rankings `/rankings?scope=...`; búsqueda
`/search?q=...`; notificaciones `/notifications`.

## Operational Admin and moderation

1. The operator signs in to `apps/admin` with a normal Better Auth session.
2. The API verifies an Account-scoped `SUPERADMIN` grant before returning any
   admin read model.
3. Home provides bounded lookup for Players (including support email), Groups
   and exact Match IDs, plus safe system readiness information.
4. Reports are reviewed at `/reports`; resolve/dismiss does not automatically
   suspend or mutate the target.
5. Player actions include suspend/reactivate, safe display-name moderation and
   avatar removal. Group actions include force-private, name moderation and safe
   archive. Match cancellation observes the normal lifecycle.
6. Every mutation asks for a reason and appears in `/audit`.
7. A suspended user is routed to `/suspended`; support receives the appeal
   outside this first operational workflow.
8. Ballot void and invitation revocation are explicit audited commands; no SQL
   console, impersonation or arbitrary domain patch is available.

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
5. Desde Match Detail revisa o edita fecha/hora, duración, capacidad y lugar.
6. Publica explícitamente.
7. Si reduce capacidad, backend rechaza cualquier valor menor que los
   confirmados; nunca reordena el roster silenciosamente.
8. Se habilita inscripción y notificaciones.

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

1. Antes del inicio se pueden corregir participantes/guests y armar equipos.
2. Todos los confirmados deben estar asignados exactamente una vez a Equipo A
   o Equipo B; los lados desparejos son válidos.
3. El manager confirma `INICIAR PARTIDO`.
4. Al comenzar se bloquean roster, admisión, Guests y equipos para
   rating/stats.
5. El partido sigue aunque no se alcance cupo objetivo.

### Match Detail según lifecycle

- `DRAFT` prioriza configuración y publicación.
- `OPEN` prioriza fecha/lugar, cupo disponible, estado del actor y plantel
  confirmado/waitlist. Reclutamiento, invitaciones, invitados, edición,
  equipos y cancelación quedan agrupados bajo `ADMINISTRAR PARTIDO` para
  actores autorizados.
- `STARTED` muestra la composición deportiva bloqueada de Equipo A y Equipo B;
  no presenta inscripción, cupo faltante, recruitment ni waitlist operativa.
- `FINISHED` es una ficha histórica: resultado, planilla, OVR, nota cerrada,
  goles/asistencias y contexto propio cuando el actor jugó. Voting y
  Progression sólo aparecen según elegibilidad/lifecycle autoritativos.

Match Detail no funciona como entrada a rankings territoriales. Reportar y las
herramientas de cierre/corrección autorizada permanecen acciones secundarias.

## UF06 — Confirmar participantes post-match

1. Finaliza horario/partido y owner/mod entra a `CERRAR PARTIDO`.
2. Confirma el fin del juego y la pantalla usa el roster bloqueado.
3. Marca cada confirmado como `PLAYED` o `NO_SHOW`.
4. Si hubo juego, carga marcador, goles y asistencias sólo para `PLAYED`.
5. Revisa y confirma el cierre deportivo; si nadie jugó queda `NOT_PLAYED`.
6. Hasta el inicio efectivo de Voting puede corregir el cierre mediante la
   misma authority. Después queda read-only.
7. Se abre votación automáticamente según la ventana server-side.

## UF06B — Cancelar partido

1. Un actor autorizado abre un Match `DRAFT` u `OPEN`.
2. Confirma `CANCELAR PARTIDO`; no se borra el registro.
3. El Match queda read-only, conserva roster e historia operativa y cierra
   admisión, recruitment, START, Voting y Progression.
4. Participantes afectados reciben la Notification existente.

## UF07 — Voting rápido

1. Cuando comienza automáticamente la ventana de Voting, el jugador entra al partido.
2. Selecciona hasta 3 destacados y hasta 3 a mejorar; los conjuntos son excluyentes.
3. Puntúa solamente a los elegidos dentro del rango válido de su categoría.
4. Revisa y envía una boleta definitiva.
5. QUICK no recoge tags ni fabrica evaluaciones para jugadores omitidos.

## UF08 — Voting completo

1. Jugador recorre participantes.
2. Puede puntuar 1–10 y saltear cualquiera; nunca puede evaluarse a sí mismo.
3. Ratings 1–5 admiten hasta 3 evidencias A MEJORAR.
4. Rating 6 no admite tags.
5. Ratings 7–10 admiten hasta 3 evidencias DESTACÓ EN.
6. Revisa y envía una boleta parcial o completa con al menos una evaluación.

## UF09 — Voting closure

Se cierra por:

- todos los elegibles votaron; o
- deadline configurable.

Después:

- Progression queda procesable de forma idempotente;
- se materializa el snapshot inmutable del partido cuando el producto lo solicita;
- se actualiza PlayerPerformance con rating, confidence y atributos calculados por el engine vigente;
- achievements y awards V1 se proyectan idempotentemente después del snapshot.

## UF10 — Progression Reveal

1. Jugador recibe “Resultados disponibles”.
2. Ve resultado/rating del partido.
3. Ve card anterior.
4. Se muestran deltas.
5. Ve nueva card.
6. Puede ir a perfil actualizado.
7. El snapshot queda en historial y volver a abrirlo no usa la performance actual.
8. Si no hubo evidencia, el partido igualmente queda registrado sin fabricar cambios.

El reveal usa OVR y atributos históricos y puede mostrar achievements y awards
reales originados en ese Match. Tier changes permanecen en su slice futuro.

## UF11 — Progression History

1. Jugador abre su progresión desde Perfil.
2. Ve su card, OVR actual y cantidad de partidos procesados desde
   PlayerPerformance F5.
3. Recorre la trayectoria de OVR construida exclusivamente con snapshots
   históricos.
4. La timeline mantiene partidos `NO_EVIDENCE` y muestra sus deltas en cero.
5. Puede cargar páginas anteriores sin alterar el orden histórico.
6. Cada entrada abre el Progression Reveal inmutable del Match.

Personal best, tiers, milestones y estadísticas agregadas permanecen en sus
sistemas futuros. Awards y achievements se consultan desde Perfil y Reveal, no
se duplican dentro del historial longitudinal.

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

## UF16 — Notificaciones in-app

1. El shell muestra el contador real de notificaciones no leídas.
2. La campana abre las cinco Notifications más recientes, leídas y no leídas;
   `VER TODAS` navega al historial completo.
3. Al abrir el inbox, el sistema proyecta idempotentemente los hechos que ya
   existen en el dominio.
4. V1 informa únicamente:
   - Voting disponible para un Player elegible;
   - Progression Reveal disponible para el Player procesado;
   - Match cancelado para Players confirmados o en espera;
   - achievement obtenido;
   - award de Match obtenido;
   - solicitud o aceptación de Connection;
   - invitación dirigida a Group o Match.
5. Cada item navega al recurso real y se marca como leído al abrirlo.
6. `MARCAR TODAS COMO LEÍDAS` actúa sólo sobre el actor y sincroniza header,
   página y Home attention; las informativas permanecen en el historial.
7. El inbox es privado, paginado y no determina el estado de Match, Voting ni
   Progression.

Push, email, WhatsApp, recordatorios, preferencias, digest y eventos adicionales
permanecen en slices futuros. Sin workers, los eventos temporales se proyectan
de forma lazy cuando el jugador consulta su inbox o contador.

## UF17 — Achievements y Awards

1. Después de materializar Progression, el backend proyecta recompensas desde
   snapshots, asistencia y stats congelados.
2. Un achievement se obtiene una sola vez por Player; un award puede repetirse
   en distintos Matches.
3. Reveal muestra únicamente las recompensas reales originadas en ese Match.
4. Perfil muestra achievements separados de un resumen autoritativo de Awards
   agrupados por tipo; el historial por Match se conserva sin repetirse en la
   página principal.
5. La reconciliación lazy completa grants históricos faltantes sin recalcular
   Voting ni Progression.

V1 no incluye tiers, rarezas, temporadas, challenges, marketplace, rankings ni
showcase público.

## UF18 — Ranking F5 del grupo

1. Un miembro activo abre el ranking privado de su Group.
2. El backend proyecta los miembros `ACTIVE` con `PlayerPerformance` F5 y al
   menos un partido procesado.
3. La tabla muestra posición, OVR actual, partidos procesados y último delta.
4. La posición del actor se informa aunque no esté en la primera página.
5. Players sin partidos ven la invitación a jugar para ingresar al ranking.

El rating continúa siendo global al Player y se proyecta igual en cada Group.
Guests y memberships no activas no aparecen. Temporadas, movimiento e
historial de posición permanecen como alcance futuro.

## UF19 — Actividad y estado deportivo del Group

1. Group Detail combina próximos partidos, preview del ranking, métricas
   deportivas y una cronología paginada.
2. Stats deriva miembros activos/rankeados, Matches cerrados o cancelados,
   goles confirmados y OVR F5 actual; `NOT_PLAYED` no entra en promedios de
   goles.
3. Activity deriva únicamente Matches finalizados/cancelados, achievements,
   awards y cambios reales de Progression del Group.
4. Cada hecho conserva su timestamp de dominio y navega al Match visible para
   los miembros.

Comentarios, reactions, posts, chat, feed público, histórico del Group y
analytics avanzados permanecen como alcance futuro.

## UF20 — Rankings F5 territoriales

1. Desde un Match con Venue estructurada, un Player autenticado abre el ranking
   F5 de la sede o su City; cuando existe geografía canónica no ambigua puede
   continuar hacia Province y Country.
2. El backend agrega Players que realmente jugaron allí y muestra una fila por
   Player con posición, OVR F5 global actual, partidos procesados globales,
   partidos en el scope y última participación territorial.
3. La tabla es paginada, mantiene una posición global autoritativa e informa la
   posición del actor aunque no esté en la página actual.
4. Ubicaciones manuales, Guests, `NO_SHOW`, Matches cancelados o `NOT_PLAYED`
   no alimentan estos rankings.
5. Venue legacy sin códigos mantiene sus rankings Venue/City. Country requiere
   `countryCode`; Province requiere `countryCode + provinceCode` coherentes.
6. Una City asociada a más de un parent territorial no muestra navegación
   parental inventada.

Seasons, movement, histórico y discovery territorial amplio permanecen como
alcance futuro.

## UF21 — Discovery y ficha deportiva autenticada

1. Un usuario autenticado busca Players y Groups desde `/search?q=...` o navega
   a Players desde un ranking Group/Venue/City. La consulta espera dos
   caracteres, aplica debounce/cancelación y separa resultados por tipo.
2. La ficha read-only reutiliza PlayerCard y muestra estado F5 actual, roles,
   willingness de arquero, fortalezas autodeclaradas, resumen de partidos,
   rating, goles y asistencias, Groups públicos, achievements y Awards
   agrupados por tipo con su cantidad total.
3. Un Player sin performance conserva su card inicial 60 y se identifica como
   todavía no procesado; no se fabrica historia ni ranking.
4. La ficha propia ofrece volver al Profile privado completo. `/profile`
   resume carrera y red sin cargar Progression History; `/profile/settings`
   separa identidad, preferencias, privacidad y seguridad. Las fichas de
   terceros no enlazan a Matches, Reveals ni Progression History.
5. Search excluye Players y Groups PRIVATE. Un Group PUBLIC sólo enlaza a Group
   Detail cuando el actor tiene membership activa, porque V1 no crea un Public
   Group Profile.

Perfiles anónimos/SEO, handles, privacy controls, followers, friends,
mensajería, feeds, recomendaciones y discovery geográfico permanecen futuros.

## UF22 — Conexiones entre Players

1. Un Player autenticado abre la ficha deportiva de otro y elige `CONECTAR`.
2. El destinatario ve la solicitud en `/connections` y recibe una notificación
   in-app.
3. Puede aceptar o rechazar; aceptar crea una relación bilateral y notifica al
   emisor original.
4. El emisor puede cancelar una solicitud pendiente y cualquiera puede remover
   posteriormente una conexión aceptada.
5. Conexiones y solicitudes son privadas, acotadas y paginadas por cursor.

La conexión no comparte datos privados ni implica membership, follow o grafo
público. Sugerencias, chat, bloqueo global y feed social permanecen futuros.

## UF23 — Invitar Connections a Groups y Matches

1. Un owner/mod autorizado elige `INVITAR CONEXIÓN` desde Group Detail o Match
   Detail; el selector sólo muestra sus propias Connections.
2. El destinatario recibe una notificación y revisa la propuesta en
   `/invitations`; nunca ingresa automáticamente.
3. Aceptar una invitación a Group reutiliza las reglas de Membership, incluido
   reingreso de `LEFT`/`REMOVED` y bloqueo de `BLOCKED`.
4. Aceptar una invitación a Match exige membership activa y usa el admission
   flow normal: puede quedar `CONFIRMED` o `WAITLISTED` según cupo y orden.
5. La invitación no reserva lugares, no concede capabilities y sigue siendo
   válida si la Connection se elimina después de emitirla.

Invitaciones masivas, recomendaciones, lugares reservados, auto-join, mensajes
adjuntos y delivery push/email/WhatsApp permanecen futuros.

## UF24 — Recruitment y lugares abiertos

1. Un manager habilita `BUSCAR JUGADORES` en un Match DRAFT/OPEN y puede
   declarar cantidades por rol F5 o dejar la búsqueda sin perfil específico.
2. Match Detail muestra los lugares reales derivados de capacity y roster, las
   necesidades declaradas y si coinciden con las preferencias del actor.
3. Los miembros activos encuentran en Play las convocatorias abiertas de sus
   propios Groups y entran al Match Detail para usar el join normal.
4. El selector de Connections conserva la invitación dirigida existente y
   muestra el contexto de cupos/roles sin ocultar Players que no coinciden.
5. Al llenarse el Match, recruitment se presenta `FULL`; si vuelve a abrirse un
   lugar reaparece `OPEN` sin reservar ni reasignar cupos.

Recruitment no cambia admission order, waitlist, matchmaking ni OVR. Discovery
pública, recomendaciones, auto-invites, filtros avanzados y notificaciones de
recruitment permanecen futuros.

## UF25 — Ranking global y Discovery read models

1. Un usuario autenticado abre `/rankings`; `GLOBAL` es el ámbito default y
   consulta el OVR F5 actual, paginado, de Players procesados elegibles.
2. Desde la misma superficie cambia entre `GLOBAL`, `GRUPO`, `CIUDAD` y `SEDE`.
   Group se limita a memberships activas; City y Venue se enumeran sólo cuando
   tienen evidencia deportiva real. La URL conserva el contexto seleccionado.
3. `TU POSICIÓN` usa la posición autoritativa del servidor aunque el actor no
   esté en la página actual. Si no es elegible, explica la falta de evidencia y
   no fabrica una posición.
4. Province y Country conservan endpoints/read models, pero no son ámbitos
   principales de la navegación V1. Match Detail no vuelve a alojar rankings.
5. Los bloques de Players distinguen OVR actual de métricas temporales: goles,
   asistencias y Awards en 7/30 días. Cada fila navega a la ficha deportiva.
6. Rising muestra sólo aumentos netos positivos sustentados por al menos dos
   snapshots dentro del período; `NO_EVIDENCE` no genera progreso ficticio.
7. Featured Groups expone nombre y actividad objetiva —partidos, Players
   activos distintos o goles— sin abrir el contenido privado del Group.
8. `/players` busca Players y nombres de Groups activos. Los Groups son
   informativos hasta que exista un Public Group Profile.

El acceso anónimo, SEO, recomendaciones, temporadas, movement, public Group
profiles y discovery de Venues permanecen futuros.

## UF26 — Home personal y centro Jugar

1. `/` saluda al Player y prioriza su Match `STARTED` o el próximo Match donde
   está confirmado/en espera. Si no existe, lo orienta hacia `/play`.
2. Home muestra hasta cinco Notifications no leídas como atención y hasta tres
   convocatorias abiertas donde el actor todavía no participa. Los fallos de
   esos dos bloques secundarios no esconden el contexto personal principal.
3. Home resume OVR y posición global; Profile y Rankings conservan el detalle.
   No muestra leaderboard, Featured/Rising, catálogo de Groups ni historial.
4. `/play` prioriza el Match actual/próximo, lista convocatorias abiertas y
   separa `PRÓXIMOS` de `HISTORIAL`. El Match destacado no se repite.
5. `MIS PARTIDOS` exige participación real del actor. DRAFT no aparece como
   partido personal y FINISHED/CANCELLED se presentan de forma acotada.
6. Login normal continúa entrando a `/play`; `/` queda disponible como inicio
   personal desde la navegación.

Home anónimo/marketing, recomendaciones, geolocalización, social feed y nuevas
disciplinas permanecen fuera.

## UF27 — Seguridad y recuperación de cuenta

1. En producción, una cuenta email/password se registra sin sesión productiva y
   recibe un enlace de verificación; recién después de verificar puede ingresar.
2. El reenvío responde de forma neutral y no revela si el email existe o ya fue
   verificado.
3. `Olvidé mi contraseña` siempre devuelve el mismo mensaje público. Un enlace
   válido permite elegir una contraseña nueva, consume el token y revoca todas
   las sesiones previas.
4. Desde `/profile/account`, el actor puede cambiar su contraseña manteniendo la
   sesión actual, cerrar las demás sesiones y revocar una sesión propia.
5. Better Auth conserva autoridad sobre usuarios, credenciales, tokens y
   sesiones. TanStack Query elimina datos privados al cerrar o reemplazar la
   sesión.
6. Login, registro, reenvío, recovery y reset tienen rate limits temporales por
   IP/acción. El almacenamiento V1 es local a la instancia del API.

Los usuarios piloto legacy de development conservan acceso mientras la policy
de verificación está deshabilitada explícitamente. Producción no realiza updates
masivos: parte con verificación requerida y un transporte de email obligatorio.
Google Sign-In, cambio de email, eliminación de cuenta y rate limiting
distribuido permanecen fuera de esta integración.

## UF28 — Edición de identidad deportiva

1. Desde `/profile`, el Player distingue `EDITAR PERFIL`, `PREFERENCIAS DE
   JUEGO`, `CUENTA Y SEGURIDAD` e `HISTORIAL DE PROGRESO`.
2. `/profile/edit` permite corregir el nombre deportivo propio. El backend
   deriva el actor de la sesión y acepta únicamente `displayName`.
3. El nombre actualizado se resuelve desde Player en Profile, ficha pública
   autenticada, búsqueda, rankings y contextos deportivos compartidos.
4. Better Auth sólo aporta el nombre del primer provisioning. Nuevos logins y
   resoluciones de sesión no pisan ediciones posteriores del Player.
5. `/profile/preferences` reutiliza el mismo authority F5 del onboarding para
   roles, disponibilidad de arquero y fortalezas declaradas. Los cambios no
   recalculan OVR ni reescriben snapshots.

Avatar, foto, handle, bio, nombre legal, localidad y fecha de nacimiento
permanecen fuera de esta integración.

## UF30 — Foto deportiva y PlayerCard de lanzamiento

1. Desde `/profile/edit`, el Player selecciona una imagen JPEG, PNG o WebP de
   hasta 8 MB, ajusta posición/zoom en un encuadre 4:5 y confirma el upload.
2. El API valida bytes reales, normaliza orientación, elimina metadata,
   recorta y genera una única rendition WebP 800×1000. El original no se
   conserva.
3. Profile, ficha pública autenticada, History y Reveal usan la misma foto
   actual dentro de la PlayerCard SVG. Sin foto o ante un fallo de delivery, la
   Card conserva una silueta final y todos los datos deportivos.
4. Reemplazar crea un asset nuevo antes de cambiar la referencia. Eliminar
   desasocia el avatar y vuelve al fallback sin modificar identidad, OVR,
   atributos ni snapshots.
5. El contenido se entrega autenticado desde `/media/:assetId/content`; bucket,
   storage key, endpoint y provider nunca forman parte del contrato público.

La foto actual no es una evidencia histórica. Group crest, Match media,
galerías, video, CDN, upload directo a object storage y media anónima permanecen
fuera de esta integración.

## UF29 — Administración operativa de Group

1. Un miembro abre `/groups/:groupId/settings`; General aparece primero y las
   secciones Members, Invitations, Guests y Ownership se expanden sólo cuando
   se necesitan. La pantalla muestra únicamente acciones habilitadas por rol y
   capabilities, aunque el API vuelve a autorizar cada comando.
2. El owner puede renombrar el Group, transferir ownership, promover/demover
   moderadores, delegar capabilities y bloquear/desbloquear miembros.
3. Quien tiene las capabilities correspondientes puede remover miembros,
   administrar invitaciones por token o dirigidas y operar el directorio de
   Persistent Guests. Remove no equivale a Block y Unblock no reincorpora.
   Los candidatos ya miembros, bloqueados o con invitación pending no se
   ofrecen. Los enlaces nuevos se crean y copian dentro de Settings.
4. Cualquier miembro activo puede salir. Si sale el owner, el dominio aplica la
   sucesión existente; el último owner archiva el Group sólo si no hay Matches
   `DRAFT`, `OPEN` o `STARTED`.
5. Archivar conserva toda la historia y memberships, cierra operaciones activas
   y excluye el Group de Search/Featured. Nunca cancela partidos implícitamente.
6. `/groups` separa Groups activos y archivados. Un Group archivado sigue siendo
   consultable por sus miembros, pero su configuración queda en modo lectura.
7. Ownership y Zona de riesgo nunca compiten con nombre o privacidad. Transfer,
   leave y archive explican la consecuencia y requieren confirmación.

## Gestión de Match y Settings personales

1. `ADMINISTRAR PARTIDO` es una entrada secundaria dentro de Match Detail y
   sólo aparece con capabilities efectivas.
2. En `DRAFT` organiza datos y convocatoria; en `OPEN`, convocatoria,
   participantes, Guests y equipos; en `STARTED`, asistencia, resultado y
   cierre. Un Match `FINISHED` no vuelve a ofrecer recruitment o invitaciones.
3. Cancelar vive en Zona de riesgo y requiere confirmación; el API conserva la
   historia y vuelve a validar lifecycle y authority.
4. `/profile/settings` separa Perfil, Fútbol F5, Cuenta/Seguridad, Legal y Zona
   de riesgo. Carrera, stats, Awards y Progression no viven en Settings.
5. `/profile/account` agrupa contraseña y sesiones antes de la eliminación. La
   eliminación exige frase, contraseña y diálogo final; un blocker de ownership
   se presenta con copy de producto, no con códigos HTTP.

Description, crest/media, restore, Public Group Profile, Guest→Player linking,
leagues, chat y administración global permanecen fuera de esta integración.

## UF31 — Privacidad, legal y confianza

1. Tras verificar el email, un Player legacy o nuevo entra en
   `/onboarding/compliance`: confirma fecha de nacimiento privada, mayoría de
   edad y versiones vigentes de Terms/Privacy antes de usar el producto.
2. Un menor no accede a superficies deportivas; puede cerrar sesión y solicitar
   la eliminación de su cuenta mediante el flujo de cuenta.
3. En `/profile/edit`, el Player elige perfil PUBLIC o PRIVATE. PRIVATE muestra
   una ficha segura mínima y sale de Search, Featured y rankings no
   contextuales; Groups y Matches compartidos conservan evidencia legítima.
4. El owner configura la visibilidad global del Group desde Settings. Un Group
   PRIVATE no aparece en Search/Featured, sin cambiar memberships ni permisos.
5. Perfiles, Groups y Matches accesibles ofrecen REPORTAR con motivo y detalle
   limitado. El reporte no revela al denunciado la identidad o comentario.
6. `/profile/account` permite eliminar cuenta con contraseña y confirmación
   explícita. La UI explica qué se elimina y qué evidencia deportiva queda
   anonimizada.
7. `/terms`, `/privacy` y `/support` son públicas y accesibles antes y después
   del login. Sus textos V1 requieren revisión legal local antes del launch.

Visibility granular, menores, export de datos, apelaciones, bloqueo global y
moderación operativa de reportes permanecen fuera de esta integración.
