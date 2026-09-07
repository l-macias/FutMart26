# UX Contract V1

> **CONGELADO PARA EL REDISEÑO VISUAL V1.** La estética, tipografía, espaciado,
> composición responsive y motion pueden evolucionar. La intención, jerarquía,
> ownership de contenido, authority y destinos definidos aquí no se mueven sin
> revisar explícitamente este contrato.

Reglas transversales: la Web App usa el lenguaje de
[`PRODUCT_LANGUAGE.md`](./PRODUCT_LANGUAGE.md); el servidor decide lifecycle,
privacidad y capabilities; una falla secundaria no derriba el contenido core;
las colecciones son bounded; desktop puede redistribuir sin alterar el orden
semántico de mobile.

## Home

**Purpose:** responder qué debe saber o hacer el jugador ahora.

**Primary content:** saludo/contexto; partido en juego o próximo; atención
accionable (máximo 5); oportunidades (máximo 3).

**Secondary content:** OVR/progreso y posición global compactos.

**Primary action:** `Ver partido`; sin próximo partido, `Buscar partido`.

**Secondary actions:** abrir notificación, `/profile/progression`, `/rankings`.

**Role variants:** owner/moderador siguen viendo una experiencia de jugador;
gestión sólo llega como notificación accionable con destino propio.

**State variants:** un partido `STARTED` desplaza al próximo; vacíos compactos;
fallos de atención/oportunidades son locales.

**Mobile priority:** saludo, partido current/next y CTA en el primer viewport.

**Do not show:** leaderboard completo, historial, catálogo de grupos, stats
extendidas, herramientas de gestión.

**Destinations:** `/play`, `/play/matches/:matchId`, `/notifications`,
`/profile/progression`, `/rankings?scope=global`.

## Play

**Purpose:** responder cuándo juega el actor y dónde puede jugar.

**Primary content:** partido en juego/próximo; convocatorias abiertas; `Mis
partidos` separados en próximos e historial.

**Secondary content:** estado de participación y cupo en cada preview.

**Primary action:** `Ver partido`.

**Secondary actions:** cambiar próximos/historial y abrir grupos.

**Role variants:** borradores no entran en la lista personal; administrar sigue
viviendo en Partido/Grupo.

**State variants:** `STARTED` tiene prioridad; destacado no se duplica;
historial incluye `FINISHED/CANCELLED` bounded.

**Mobile priority:** current/next y comienzo de convocatorias.

**Do not show:** notificaciones, progreso, ranking, actividad social, detalles
completos del partido.

**Destinations:** `/play/matches/:matchId`, `/groups`.

## Match — Draft

**Purpose:** configurar y revisar un partido antes de publicarlo.

**Primary content:** disciplina F5, fecha/hora, duración, capacidad, sede/lugar,
convocatoria y roster inicial.

**Secondary content:** resumen de configuración y equipos si ya existen.

**Primary action:** `Publicar` para actor autorizado.

**Secondary actions:** `Editar datos`, `Administrar partido`.

**Role variants:** sólo capabilities efectivas ven gestión; el resto ve estado
sin acciones inválidas.

**State variants:** disciplina editable sólo antes de publicar; capacidad no
puede quedar debajo de confirmados.

**Mobile priority:** estado Borrador, fecha/lugar y acción de publicar/editar.

**Do not show:** join, votación, progresión, resultado o cierre.

**Destinations:** `/play/matches/:matchId/edit`, Match Detail, Grupo.

## Match — Open

**Purpose:** responder cuándo/dónde, cuántos son, quiénes están y qué puede
hacer el actor.

**Primary content:** fecha/hora/sede; cupo y faltantes; estado/CTA del actor;
confirmados; lista de espera.

**Secondary content:** estado compacto de equipos y convocatoria.

**Primary action:** `Anotarme` o `Darme de baja`, nunca ambas.

**Secondary actions:** `Ver equipos`, `Reportar`, `Administrar partido`.

**Role variants:** organizer tools se agrupan tras `Administrar partido` y usan
capabilities, no una comparación de rol aislada.

**State variants:** confirmado/en espera/no participante; full no se calcula en
cliente y la posición sólo se muestra cuando es autoritativa.

**Mobile priority:** fecha/lugar, cupo, faltantes, estado del actor y CTA.

**Do not show:** rankings, formulario permanente de invitación, historial,
votación o progresión.

**Destinations:** equipos, edición/management y Grupo.

## Match — Started

**Purpose:** mostrar cómo están armados los equipos y qué ocurre en el partido.

**Primary content:** estado `En juego`, fecha/lugar, Equipo A vs Equipo B y
roster bloqueado.

**Secondary content:** asistencia y resultado/eventos cuando el dominio los
expone.

**Primary action:** `Ver partido`; para organizer dentro de gestión, continuar
el cierre.

**Secondary actions:** `Administrar partido`, `Reportar`.

**Role variants:** asistencia, eventos y cierre sólo con capabilities.

**State variants:** roster bloqueado; no admite join ni edición incompatible.

**Mobile priority:** estado, equipos y composición deportiva.

**Do not show:** faltantes, convocatoria, join o lista de espera operacional.

**Destinations:** `/play/matches/:matchId/close`, equipos y Grupo.

## Match — Finished

**Purpose:** responder qué pasó y cómo le fue al actor.

**Primary content:** `Finalizado`, fecha/sede, score, equipos, planilla, goles y
asistencias.

**Secondary content:** bloque `Tu partido` sólo para quien jugó; nota sólo con
votación cerrada; OVR before/after sólo con snapshot materializado.

**Primary action:** `Votar ahora` si es elegible o `Ver mi progresión` cuando
está disponible.

**Secondary actions:** `Reportar`; revisión de cierre dentro de management.

**Role variants:** un organizer puede revisar el cierre; un no participante no
recibe CTA ni request de progression.

**State variants:** votación disponible/voto enviado/cerrada; progresión
pendiente/disponible/sin evidencia.

**Mobile priority:** Finalizado, resultado y contexto de equipos.

**Do not show:** recruitment, join, waitlist, “tu estado: finalizado” ni CTA de
votación cerrada.

**Destinations:** voting, progression, Grupo y cierre autorizado.

## Group Overview

**Purpose:** responder qué pasa en el grupo y qué necesita saber/hacer un
miembro.

**Primary content:** header compacto; próximo partido; plantel preview; próximos
e historial sin duplicar el destacado.

**Secondary content:** Top 3, números compactos, actividad reciente (máximo 4).

**Primary action:** `Ver partido`; sin próximo y con capability, `Crear
partido`.

**Secondary actions:** ver plantel, historial, ranking completo, reportar y
`Administrar grupo`.

**Role variants:** member no ve gestión; owner/moderador sólo ven las acciones
que sus capabilities habilitan.

**State variants:** privado conserva contexto para miembros; archivado es
histórico/read-only.

**Mobile priority:** nombre, cantidad de jugadores, próximo partido y CTA.

**Do not show:** formularios de invitación/configuración, ranking completo,
feed infinito o datos técnicos.

**Destinations:** Partido, `/rankings?scope=group&groupId=:groupId`, Player y
Group Settings.

## Group Settings

**Purpose:** administrar identidad, personas y lifecycle del grupo.

**Primary content:** General; Miembros; Invitaciones; Invitados; Propiedad; Zona
de riesgo, en secciones progresivas.

**Secondary content:** historial bounded de invitaciones y estado de cambios.

**Primary action:** guardar la sección activa.

**Secondary actions:** invitar, editar rol/capabilities, archivar/restaurar
invitado.

**Role variants:** cada sección y acción depende de capabilities; transferir
propiedad sigue siendo exclusivo del propietario.

**State variants:** archivado es lectura; acciones sensibles requieren diálogo.

**Mobile priority:** General primero; una sección expandida por vez.

**Do not show:** próximo partido, ranking, stats, activity, UUIDs o capabilities
crudas.

**Destinations:** Group Overview, invitaciones y entidades seleccionadas.

## Rankings

**Purpose:** responder cómo está posicionado el actor en el contexto elegido.

**Primary content:** selector Global/Grupo/Ciudad/Sede; contexto; `Tu posición`;
ranking bounded.

**Secondary content:** explicación de inelegibilidad y carga de más resultados.

**Primary action:** cambiar scope/contexto.

**Secondary actions:** `Ver perfil`.

**Role variants:** Group sólo lista contextos permitidos al actor.

**State variants:** posición autoritativa o explicación; vacíos específicos por
scope.

**Mobile priority:** scope, contexto, posición propia y primeras filas.

**Do not show:** Province/Country como tabs V1, stats extendidas, guests o
ranking math calculada en cliente.

**Destinations:** `/rankings?scope=...`, `/players/:playerId`.

## Public Player Profile

**Purpose:** explicar quién es el jugador y qué muestra su trayectoria pública.

**Primary content:** identidad/Card/OVR; perfil F5; stats resumidas; grupos
permitidos; logros; premios agrupados.

**Secondary content:** conectar, invitar a grupo y reportar según authority.

**Primary action:** no hay una acción universal; la identidad deportiva domina.

**Secondary actions:** `Conectar`, `Invitar a grupo`, `Reportar`.

**Role variants:** el propio actor recibe acceso a Mi perfil, no self-actions.

**State variants:** PRIVATE ofrece shell seguro; ANONYMIZED muestra `Jugador
eliminado`, sin avatar ni datos personales.

**Mobile priority:** Card/identidad, OVR y acciones válidas.

**Do not show:** grupos privados no autorizados, cuenta, settings, snapshots o
premios individuales repetidos.

**Destinations:** Grupo permitido, `/profile`, conexiones/invitaciones.

## My Profile

**Purpose:** responder quién es el actor como jugador y cómo evoluciona.

**Primary content:** identidad/Card/OVR; perfil F5; resumen de carrera; preview
de progreso; logros/premios.

**Secondary content:** grupos, red y entrada a configuración.

**Primary action:** `Ver historial de progreso`.

**Secondary actions:** `Configuración`, grupos, conexiones e invitaciones.

**Role variants:** nunca muestra conectar/invitar/reportarse a sí mismo.

**State variants:** jugador sin evidencia recibe resumen neutral, no métricas
inventadas.

**Mobile priority:** identidad, Card, OVR y CTA de carrera/configuración.

**Do not show:** history completa eager, settings expandidas, directorios de
grupo/red o controles administrativos.

**Destinations:** `/profile/progression`, `/profile/settings`, `/groups`,
`/connections`, `/invitations`.

## Profile Settings

**Purpose:** cambiar perfil, preferencias, cuenta y privacidad.

**Primary content:** Perfil; Fútbol F5; Cuenta y seguridad; Legal y privacidad;
Zona de riesgo.

**Secondary content:** versión de políticas, sesiones y soporte.

**Primary action:** guardar el cambio activo.

**Secondary actions:** editar foto/nombre/privacidad, preferencias y contraseña.

**Role variants:** sólo el actor autenticado.

**State variants:** delete puede quedar bloqueado por ownership y explica la
causa.

**Mobile priority:** Perfil y Fútbol F5 antes de Cuenta/Legal/Riesgo.

**Do not show:** OVR, stats, premios, ranking o progreso competitivo.

**Destinations:** `/profile/edit`, `/profile/preferences`, `/profile/account`,
`/terms`, `/privacy`, `/support`.

## Progression History

**Purpose:** mostrar la evolución autoritativa del actor partido a partido.

**Primary content:** OVR before/after, deltas, nota/evidencia y contexto de
partido, bounded.

**Secondary content:** abrir reveal o partido fuente.

**Primary action:** `Ver progresión` de una entrada disponible.

**Secondary actions:** volver a Perfil/Partido.

**Role variants:** exclusivamente evidencia propia.

**State variants:** `Sin evidencia` es válido y neutral; pending no fabrica
cambios.

**Mobile priority:** OVR actual y últimas entradas.

**Do not show:** historia de terceros, votos individuales o recomputación.

**Destinations:** `/play/matches/:matchId/progression`, `/profile`.

## Search

**Purpose:** encontrar un jugador o grupo por texto.

**Primary content:** input y resultados separados en Jugadores/Grupos.

**Secondary content:** estado de búsqueda, vacíos y counts bounded.

**Primary action:** escribir/buscar.

**Secondary actions:** abrir resultado.

**Role variants:** no usa Search como bypass de grupos privados.

**State variants:** menos de 2 caracteres, loading/retry, sin resultados y
error son estados distintos; query vive en URL.

**Mobile priority:** input visible y primeras filas agrupadas.

**Do not show:** matches, sedes, rankings, recomendaciones o entidades private.

**Destinations:** `/search?q=...`, `/players/:playerId`; Group Detail sólo con
target permitido.

## Notifications Dropdown

**Purpose:** responder qué pasó recientemente sin abandonar el contexto.

**Primary content:** últimas 5, newest-first, leídas y no leídas.

**Secondary content:** unread count compartido.

**Primary action:** abrir una notificación.

**Secondary actions:** `Marcar todas como leídas`, `Ver todas`.

**Role variants:** datos exclusivos del actor.

**State variants:** vacío compacto; sin badge cuando unread es cero; Escape y
click exterior cierran.

**Mobile priority:** lista acotada y acciones alcanzables.

**Do not show:** inbox completo, filtros o enums.

**Destinations:** target autoritativo y `/notifications`.

## Notifications Page

**Purpose:** consultar el historial y lo pendiente.

**Primary content:** historial cursor-paginated newest-first.

**Secondary content:** Todas/No leídas y unread count compartido.

**Primary action:** abrir notificación.

**Secondary actions:** marcar una/todas, cargar más.

**Role variants:** exclusivo del actor.

**State variants:** informative permanece en historial; target no disponible
usa fallback seguro.

**Mobile priority:** título, marcar todas y primeras filas.

**Do not show:** Home Attention duplicada o filtros por cada tipo.

**Destinations:** targets del servidor.

## Auth — Login, Register y Forgot Password

**Purpose:** autenticar, crear o recuperar una cuenta sin mezclar onboarding.

**Primary content:** credenciales necesarias y estado de envío.

**Secondary content:** cambio Login/Register, `¿Olvidaste tu contraseña?`,
Terms/Privacy.

**Primary action:** `Iniciar sesión`, `Crear cuenta` o `Enviar enlace`.

**Secondary actions:** recuperar, volver e ingresar a políticas.

**Role variants:** no aplica.

**State variants:** email ya existente ofrece login/recovery; respuestas de
recovery no enumeran cuentas.

**Mobile priority:** título, campos y CTA sin contenido promocional dominante.

**Do not show:** códigos de auth, estado Better Auth, OAuth inexistente.

**Destinations:** `/auth`, `/auth/forgot-password`, `/auth/reset-password`,
`/terms`, `/privacy`, compliance/Home.

## Support and Report

**Purpose:** ofrecer ayuda o reportar contenido dentro de un contexto legítimo.

**Primary content:** soporte público o motivo/detalle bounded del reporte.

**Secondary content:** confirmación `Reporte enviado`.

**Primary action:** `Enviar reporte` cuando el formulario está abierto.

**Secondary actions:** `Reportar` es discreta en Perfil/Grupo/Partido.

**Role variants:** sólo actores autenticados reportan entidades; Support es
público.

**State variants:** éxito temporal; error comprensible; no promete resolución.

**Mobile priority:** motivo, detalle y CTA.

**Do not show:** IDs manuales, audit interno, identidad del reporter a targets
o tiempos prometidos.

**Destinations:** `/support` y contexto de origen.
