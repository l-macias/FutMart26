# Product Language V1

Este glosario congela el lenguaje de producto de la Web App antes del rediseño
visual V1. Los nombres internos, enums y contratos pueden permanecer en inglés;
no deben filtrarse a la interfaz.

## Glosario

| Concepto interno | Copy de UI | Notas |
| --- | --- | --- |
| `GROUP` | Grupo | “Group” sólo puede formar parte de la marca `F5 Groups`. |
| `MATCH` | Partido | CTA canónico: `Ver partido`. |
| `PLAYER` | Jugador | Persona con cuenta e identidad deportiva. |
| `GUEST` | Invitado | Identidad deportiva sin cuenta. No significa invitación pendiente. |
| `OWNER` | Propietario | En espacio reducido se conserva el nombre completo. |
| `MODERATOR` | Moderador | `MOD` se admite únicamente como badge compacto. |
| `MEMBER` | Miembro | No mostrar el enum `MEMBER`. |
| `VENUE` | Sede | “Lugar” se admite al describir fecha y ubicación en lenguaje natural. |
| `CITY` | Ciudad | No mostrar `City`. |
| `RECRUITMENT` | Convocatoria | Estado contextual: convocatoria abierta/cerrada. |
| `WAITLIST` / `WAITLISTED` | Lista de espera / En espera | Mostrar posición sólo cuando el servidor la expone. |
| `DRAFT` | Borrador | Estado de configuración, no publicado. |
| `OPEN` | Abierto | En contexto de cupos también puede decir `Convocatoria abierta`. |
| `STARTED` | En juego | No usar “Started” ni “Iniciado”. |
| `FINISHED` | Finalizado | Describe la ficha histórica y su resultado. |
| `CANCELLED` | Cancelado | Conserva participantes e historia. |
| `VOTING` | Votación | Estados: `Votación disponible`, `Voto enviado`, `Votación cerrada`. |
| `PROGRESSION` | Progresión | Estados: `Progresión disponible`, `Pendiente`, `Sin evidencia`. |
| `OVR` / `overall` | OVR | Nivel persistente del jugador. Nunca llamarlo nota del partido. |
| `rating` / `aggregatedRating` | Nota | Evaluación de un partido. No llamarla OVR. |
| `ACHIEVEMENT` | Logro | Hito persistente de carrera. |
| `AWARD` | Premio | Reconocimiento asociado a un partido; se agrupa por tipo con `×N`. |
| `PUBLIC` | Público | Visibilidad de jugador o grupo. |
| `PRIVATE` | Privado | No equivale a archivado. |
| `ARCHIVED` | Archivado | Estado histórico/read-only del grupo. |
| `BLOCKED` | Bloqueado | Estado de relación con un grupo. |

## Jerarquía de acciones

1. **Primaria**: una sola acción dominante para el momento del actor, por
   ejemplo `Anotarme`, `Darme de baja`, `Publicar`, `Votar ahora` o `Ver mi
   progresión`.
2. **Secundaria**: navegación o acción útil sin dominar, por ejemplo `Ver
   partido`, `Ver perfil`, `Reportar` o `Ver rankings`.
3. **Gestión**: entrada a herramientas de organización, con las fórmulas
   `Administrar grupo` y `Administrar partido`.
4. **Peligrosa**: cancelar, archivar, transferir propiedad o eliminar cuenta.
   Vive dentro de gestión/Zona de riesgo y requiere confirmación.

No deben competir dos acciones primarias. Ocultar una acción no reemplaza la
autorización del servidor.

## Feedback

Los éxitos cuyo resultado no es obvio usan un estado temporal inline o el toast
compartido, sin modal:

- `Cambios guardados.`
- `Permisos guardados.`
- `Invitación enviada.`
- `Reporte enviado.`
- `Foto actualizada.`
- `Contraseña actualizada.`
- `Notificaciones marcadas como leídas.`

Los errores se traducen desde códigos estables a una de estas categorías:

- validación: explicar qué campo debe revisarse;
- autoridad: `No tenés permiso para hacer esto.`;
- conflicto: explicar la invariancia, por ejemplo membresía o invitación ya
  existente;
- no encontrado: explicar que el contenido no existe o dejó de estar
  disponible;
- red: `No pudimos conectar con el servidor. Intentá nuevamente.`;
- servidor: `No pudimos completar la acción. Intentá nuevamente.`.

Nunca exponer códigos HTTP, Zod, stacks, UUIDs o enums.

## Estados de contenido

- Un vacío dice qué falta y ofrece CTA sólo si el actor puede actuar.
- Una sección secundaria carga y falla localmente; no tapa la identidad de la
  pantalla.
- Una consulta que aún reintenta no muestra un error terminal.
- `Sin datos` no es copy suficiente.

## Badges

Los badges se reservan para rol/entidad (`PROPIETARIO`, `MOD`, `INVITADO`),
estado (`PRIVADO`, `ARCHIVADO`, `EN JUEGO`, `FINALIZADO`) o atención
(`NO LEÍDA`, `PENDIENTE`, `EN ESPERA`). El resto se expresa como texto normal.

## Cantidades, fecha y hora

- Concordar singular/plural: `1 jugador`, `2 jugadores`; `Falta 1`, `Faltan
  8`; `1 notificación`, `5 notificaciones`.
- Usar locale `es-AR`.
- Listados: día y mes abreviados; Detail: día/mes y contexto suficiente.
- Hora: formato de 24 horas.
- OVR se muestra como `72 OVR`; la evaluación del partido como `Nota 8,4` o
  `8,4` bajo una columna `NOTA`.
