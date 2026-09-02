# User Flows

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
2. Al abrir el inbox, el sistema proyecta idempotentemente los hechos que ya
   existen en el dominio.
3. V1 informa únicamente:
   - Voting disponible para un Player elegible;
   - Progression Reveal disponible para el Player procesado;
   - Match cancelado para Players confirmados o en espera;
   - achievement obtenido;
   - award de Match obtenido;
   - solicitud o aceptación de Connection;
   - invitación dirigida a Group o Match.
4. Cada item navega al recurso real y puede marcarse como leído.
5. El inbox es privado, paginado y no determina el estado de Match, Voting ni
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
4. Perfil muestra achievements y awards recientes del Player autenticado.
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

1. Un usuario autenticado busca Players por display name desde `/players` o
   navega desde un ranking Group/Venue/City.
2. La ficha read-only reutiliza PlayerCard y muestra estado F5 actual, roles,
   willingness de arquero, fortalezas autodeclaradas, resumen de goles y
   asistencias, achievements y hasta cinco Awards recientes.
3. Un Player sin performance conserva su card inicial 60 y se identifica como
   todavía no procesado; no se fabrica historia ni ranking.
4. La ficha propia ofrece volver al Profile privado completo. Las fichas de
   terceros no enlazan a Matches, Reveals ni Progression History.

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

1. Un usuario autenticado abre `/rankings` y consulta el Ranking Global F5,
   paginado y basado únicamente en el OVR actual de Players procesados.
2. Los bloques de Players distinguen OVR actual de métricas temporales: goles,
   asistencias y Awards en 7/30 días. Cada fila navega a la ficha deportiva.
3. Rising muestra sólo aumentos netos positivos sustentados por al menos dos
   snapshots dentro del período; `NO_EVIDENCE` no genera progreso ficticio.
4. Featured Groups expone nombre y actividad objetiva —partidos, Players
   activos distintos o goles— sin abrir el contenido privado del Group.
5. `/players` busca Players y nombres de Groups activos. Los Groups son
   informativos hasta que exista un Public Group Profile.

El acceso anónimo, SEO, recomendaciones, temporadas, movement, public Group
profiles y discovery de Venues permanecen futuros.

## UF26 — Home Global autenticado

1. `/` presenta el mundo deportivo de la plataforma con búsqueda global,
   preview del Ranking Global F5 y bloques reales de Players y Groups.
2. El selector común de 7/30 días actualiza goles, asistencias, Awards, Rising y
   actividad de Groups; Top OVR continúa representando el estado actual.
3. Cada bloque consulta su read model independientemente: un fallo parcial no
   impide buscar, navegar ni consultar las demás secciones.
4. Players navegan a su ficha deportiva autenticada. Los nombres de Groups son
   informativos y no abren Group Detail ni datos privados.
5. `/play` conserva el hub personal de partidos y oportunidades; `/profile`
   conserva la carrera privada; `/players/:id` continúa siendo la ficha
   deportiva autenticada y limitada.
6. El acceso directo a una ruta protegida retorna a esa ruta después del login;
   el acceso normal sin destino explícito entra a `/play`.

Home anónimo/marketing, SEO, Public Group Profile, live matches, highlights,
recomendaciones, seasons y rediseño SVG/fotográfico de PlayerCard permanecen
fuera de esta integración.

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

1. Un miembro abre `/groups/:groupId/settings`; la pantalla muestra únicamente
   las acciones habilitadas por su rol y capabilities, aunque el API vuelve a
   autorizar cada comando.
2. El owner puede renombrar el Group, transferir ownership, promover/demover
   moderadores, delegar capabilities y bloquear/desbloquear miembros.
3. Quien tiene las capabilities correspondientes puede remover miembros,
   administrar invitaciones por token o dirigidas y operar el directorio de
   Persistent Guests. Remove no equivale a Block y Unblock no reincorpora.
4. Cualquier miembro activo puede salir. Si sale el owner, el dominio aplica la
   sucesión existente; el último owner archiva el Group sólo si no hay Matches
   `DRAFT`, `OPEN` o `STARTED`.
5. Archivar conserva toda la historia y memberships, cierra operaciones activas
   y excluye el Group de Search/Featured. Nunca cancela partidos implícitamente.
6. `/groups` separa Groups activos y archivados. Un Group archivado sigue siendo
   consultable por sus miembros, pero su configuración queda en modo lectura.

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
