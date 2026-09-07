# Visual Foundation V2

> **AUTORIDAD VISUAL V1.** Este documento define la base del rediseño visual.
> Se aplica junto con [`UX_CONTRACT.md`](./UX_CONTRACT.md), que conserva
> autoridad sobre propósito, orden de contenido, variantes y destinos. Una
> decisión visual nunca habilita mover o agregar contenido.

## Principios

La dirección es **Night Pitch + Tactical + Collectible**, dark-first y
mobile-first. Debe sentirse deportiva, competitiva y legible, no como un
dashboard SaaS, una fintech, una interfaz de IA, neón gaming o una copia de un
juego existente.

- La información manda; el detalle futbolístico se reserva para momentos
  deportivos importantes.
- El lime identifica acción o énfasis, no dibuja el contorno de toda la UI.
- La densidad es deliberada: rows para colecciones, sections para agrupación y
  cards sólo para entidades autónomas.
- Player Card conserva su contrato 2:3 y foto 4:5.
- Motion comunica interacción o cambio de estado; no decora contenido estático.

## Color

La identidad conserva `#0B0E0C`, `#121713`, `#19201B`, `#D7FF3F` y `#2B7A4B`.
El contrato de consumo nuevo usa tokens semánticos:

| Rol | Token |
| --- | --- |
| Acción/acento | `--color-accent` |
| Éxito | `--color-success` |
| Advertencia | `--color-warning` |
| Peligro/error | `--color-danger` |
| Información | `--color-info` |
| Texto | `--color-text` |
| Texto secundario | `--color-muted` |
| Separación | `--color-border` |
| Surface | `--color-surface` |
| Surface elevada | `--color-surface-raised` |
| Feature deportiva | `--color-surface-feature` |
| Overlay | `--color-overlay` |

Los aliases anteriores siguen disponibles durante la migración incremental.
No agregar hex en features. Peligro no se usa como decoración permanente.

## Tipografía

`Barlow Condensed` expresa títulos deportivos, scores, OVR, posición y métricas
principales. `Manrope` expresa body, metadata, formularios y navegación.

| Rol | Token/variant | Uso |
| --- | --- | --- |
| Display principal | `display-xl` | momento excepcional, no título rutinario |
| H1 deportivo | `display-lg` | título de pantalla |
| Score | `score` | resultado o número deportivo dominante |
| H2 | `heading-lg` | sección principal |
| H3 | `heading-md` / `heading-sm` | subsección |
| Body | `body` | contenido de interfaz |
| Label | `label` | label corto/acción |
| Micro | `metadata` | fecha, helper, contexto |

La escala fluida queda acotada para evitar heroes que consuman el primer
viewport. Los números usan `tabular-nums` cuando se comparan. `OVR` es nivel
persistente; `NOTA` es evaluación de un partido y nunca comparte su tratamiento
semántico.

## Espaciado y densidad

La escala oficial es `4, 8, 12, 16, 24, 32, 48, 64, 96 px`, expuesta como
`--space-1` a `--space-9`.

- **Compact:** rows, rankings, roster y notifications; padding `--space-3`.
- **Default:** sections y forms; padding `--space-4`.
- **Feature:** próximo partido, score y summary; `--space-5` mobile y
  `--space-6` desktop.

Usar `--section-gap`, `--page-gutter`, `--row-min-height-*` y
`--control-height-*`. No crear espacios por pantalla cuando un token existente
expresa la intención.

## Anchos

- `--content-max`: shell general.
- `--content-wide`: composición deportiva amplia.
- `--content-reading`: texto y políticas.
- `--content-settings`: formularios/settings.

Desktop redistribuye, no infla controles ni altera el orden semántico.

## Surfaces

1. **Page:** canvas base.
2. **Section:** agrupación por heading/espacio/divider; normalmente sin caja.
3. **Surface:** separación real de una entidad o bloque autónomo.
4. **Feature:** momento deportivo prioritario.
5. **Raised/Overlay:** dropdown y dialog exclusivamente.

`Surface` expone `base`, `feature`, `raised` y `overlay`. Raised/overlay usan
sombra sólo cuando existe superposición. El borde normal es sutil; el accent no
rodea cada bloque.

**Hacer:** lista de jugadores con separadores. **No hacer:** una card por
jugador. **Hacer:** Feature para el próximo partido. **No hacer:** Feature para
una frase de metadata.

## Acciones

`Button` implementa la jerarquía congelada:

- `primary`: única acción dominante, lime.
- `secondary`: navegación/acción útil sin dominar.
- `management`: entrada a administración o configuración.
- `danger`: aparece dentro de Zona de riesgo o confirmación.
- `quiet`: acción terciaria/discreta.

Estados hover, active, disabled y focus son compartidos. Icon buttons usan un
target mínimo de 44 px. En mobile un primary puede ocupar todo el ancho cuando
es la acción principal del flujo; no es una regla universal.

## Badges y estados

`Badge` sólo admite tres significados:

- `role`: `MOD`, `PROPIETARIO`, `INVITADO`;
- `state`: `PRIVADO`, `ARCHIVADO`, `EN JUEGO`;
- `attention`: `PENDIENTE`, `NO LEÍDA`, `EN ESPERA`.

Metadata normal no se convierte en badge. Estados deportivos pequeños usan
`MatchStateMark` (dot + texto); no dependen únicamente del color.

## Rows y listas

Las clases `ui-list`, `ui-row`, `ui-row__content`, `ui-row__primary`,
`ui-row__secondary` y `ui-row__metric` fijan una geometría compartida sin crear
un componente universal con lógica de dominio.

- Player row: avatar, nombre/contexto, OVR o acción.
- Match row: fecha/contexto/sede, score o cupo.
- Ranking row: posición, jugador, OVR.
- Notification/activity row: texto, timestamp/estado.

Rows usan divider, no cajas. El trailing metric usa Barlow Condensed y números
tabulares. La identidad/navegación concreta queda en cada componente de
producto.

## Formularios

Inputs, selects y textareas comparten altura de 44 px, padding, fondo dark,
borde sutil, focus lime y disabled explícito. Checkbox, radio, range y file
conservan geometrías propias.

El patrón es `label → field → helper/error`, representado por `ui-field` y sus
subelementos. No envolver cada campo en una card. Selectores de Rankings y
Settings usan la misma base compacta. Errores se asocian al control y usan
`--color-danger`; no dependen sólo del color.

## Navegación y overlays

El header es compacto y conserva marca, Search, Notifications y acciones del
actor. Desktop mantiene navegación lateral pequeña; mobile mantiene bottom nav
con Inicio/Jugar/Grupos/Rankings/Perfil y safe-area. El active state combina
texto y marca lime. No se agrega una sidebar SaaS.

Dropdowns y dialogs usan surface overlay, borde moderado, sombra única y radio
de overlay. Escape, click exterior y manejo de foco permanecen en sus
componentes accesibles.

## Responsive

La foundation usa dos cortes compartidos: tablet `48rem` y desktop `80rem`.
CSS no puede usar custom properties dentro de `@media`, por lo que esos valores
se documentan y se repiten sólo en la capa de layout.

- 390–430 px: gutter 16 px, listas verticales, target táctil 44 px, sin scroll
  horizontal.
- Desde 48rem: gutter 32 px y Feature/sections con más aire controlado.
- Desktop puede crear main/side cuando el contrato lo permite, sin cambiar la
  prioridad semántica.

Bottom nav debe incluir `env(safe-area-inset-bottom)` y el contenido debe dejar
espacio para ella.

## Player Card y métricas deportivas

No cambia la geometría de Player Card. Su contenedor decide tamaño sin estirar
la proporción ni agregar una segunda surface innecesaria.

`OverallDisplay` ofrece `compact`, `default` y `feature`: rows/preview, perfil y
momento protagonista respectivamente. Score usa el role `score`; Nota usa una
jerarquía contextual menor que OVR salvo en el resumen específico del partido.

## Estados de experiencia

- Empty: copy breve, CTA sólo si corresponde; sin ilustración gigante.
- Loading: skeleton semejante al contenido y localizado por sección.
- Error secundario: inline, sin tapar el core.
- Error core: estado claro y retry.
- Success: inline/toast compartido, nunca modal.

## Accesibilidad y motion

El focus visible es lime y no se elimina. Texto muted conserva contraste sobre
canvas/surfaces. Icon buttons tienen nombre accesible. Badges y estados incluyen
texto. Controls tienen target táctil. `prefers-reduced-motion` reduce todas las
duraciones sin ocultar información.

Motion permitido: hover, press, focus, dropdown y disclosure. No se incorpora
un sistema nuevo ni glow/neón.

## Do / Don't

- **Do:** una Feature para el contenido deportivo principal. **Don't:** una
  Feature por sección.
- **Do:** sections y dividers. **Don't:** cards anidadas.
- **Do:** un primary por momento. **Don't:** dos botones lime competidores.
- **Do:** management neutral. **Don't:** presentarlo como CTA del jugador.
- **Do:** danger al entrar en riesgo. **Don't:** rojo permanente en navegación.
- **Do:** títulos compactos en mobile. **Don't:** dejar que un H1 consuma el
  primer viewport.
- **Do:** preservar el orden de `UX_CONTRACT.md`. **Don't:** mover contenido por
  conveniencia de grid.
