# Visual Foundation V3 — Pilot Rebuild

> **PILOTO, NO AUTORIDAD GLOBAL TODAVÍA.** Aplica únicamente a Home, Match
> Open, My Profile y Public Profile. `UX_CONTRACT.md` conserva la autoridad
> funcional; V2 sigue gobernando el resto hasta que este piloto sea aprobado.

## Principios

FIFAR V3 es una aplicación deportiva móvil, no un sitio web oscuro con acento
dorado. Combina identidad de competición amateur, gráfica editorial, lectura
de broadcast y documentación de club. Debe reconocerse por su silueta aun sin
leer el logo.

- Una escena deportiva fuerte abre cada piloto y explica su propósito.
- Las superficies alternan profundidad, vacío y ritmo; no todo es una card.
- El contenido repetitivo conserva densidad, pero puede vivir en rails o
  módulos editoriales cuando la comparación lo justifica.
- Navy y charcoal crean profundidad; gold marca una decisión o dato dominante.
- Assets locales reemplazables aportan atmósfera sin introducir marcas, clubes
  o identidades comerciales.
- La IA, datos, rutas, privacidad, lifecycle y acciones permanecen intactos.

## Paleta

V3 se activa mediante `.ui-visual-v3`.

| Rol | Valor | Uso |
| --- | --- | --- |
| Canvas | `#0B1020` | fondo profundo |
| Surface | `#121A2C` | estructura |
| Raised | `#19243B` | profundidad local |
| Text | `#F2F3F5` | lectura principal |
| Muted | `#A2ABBA` | metadata accesible |
| Gold | `#D6B15F` | CTA o métrica dominante |
| Gold light | derivado por `color-mix` | highlights puntuales |
| Pitch | `#28564A` | fútbol, campo y success contextual |

Los colores viven en tokens. Success, warning, danger e info conservan su
semántica. No se agregan hex dispersos en features.

## Tipografía

- **Barlow Condensed:** nombres protagonistas, fecha/hora, cupo, score, OVR,
  ranking y números deportivos.
- **Manrope:** navegación, nombres en listas, body, metadata y acciones.
- Los números comparables usan `tabular-nums`.
- OVR es nivel persistente; Nota es evaluación contextual.
- Los títulos pueden ganar escala dentro de una escena, pero la densidad de UI
  cotidiana no aumenta.

## Modelo de superficie

1. **Page:** canvas navy con profundidad ambiental.
2. **Section:** ritmo editorial; puede ser abierta.
3. **Row/List/Rail:** colección densa vertical u horizontal según contexto.
4. **Feature Scene:** foco deportivo con imagen, datos y acción integrada.
5. **Overlay:** dropdown o diálogo elevado.

Las escenas usan una sola envolvente. Los subdatos se ordenan por dividers y
bandas; no se anidan cards genéricas.

## Firmas visuales propias de FIFAR

### 1. F5 Cut

Esquinas diagonales asimétricas aplicadas a Feature, CTA primaria, Card y
estados seleccionados. No es un escudo ni un marco FUT. La diagonal expresa
velocidad y aparece siempre con geometría contenida.

### 2. Pitch Frame

Líneas de cancha de baja opacidad integradas en escenas de partido e identidad.
Nunca reducen contraste ni se usan como fondo permanente en settings.

### 3. OVR Plate

Placa angular compacta para OVR persistente. Se reutiliza en Home y Profile,
con label explícito para evitar confusión con Nota. Su contorno parcial evita
el lenguaje de badge/pill.

### 4. Match Strip

Banda superior de broadcast con fase, fecha o convocatoria. Concentra contexto
sin repetir metadata y conecta Home con Match Open.

Al menos F5 Cut, Pitch Frame y OVR Plate deben aparecer en los tres pilotos.

## Gold usage

Máximo uno o dos focos dominantes por viewport. Gold está permitido en CTA
primaria, OVR/cupo/posición protagonista, navegación activa y un acento corto.
No se usa en todos los títulos, iconos, bordes, fondos ni sombras. No hay glow.

## Imágenes y placeholders

Los placeholders viven en `/public/visual-v3/` y son locales, determinísticos y
reemplazables. El piloto incluye cancha nocturna y fixture vacío. Los escudos
se generan desde un seed estable con tres patrones abstractos; no se hardcodea
uno por fixture. Los jugadores sin foto usan una silueta angular con iluminación,
nunca una inicial dentro de un círculo.

## Lists, rails y densidad

- Roster y datos operativos: rows con avatar, orden, nombre, estado y trailing.
- Oportunidades y rewards: rail mobile con snap, cards compactas de entidad.
- Attention: primer pendiente editorial y resto con menor peso, sin cinco rows
  visualmente idénticas.
- Targets táctiles mantienen 44 px y los dividers son de bajo contraste.
- Premium significa precisión y jerarquía, no más altura.

## Feature system

- **Home:** escena de partido con crest, pitch, Match Strip, cupo y CTA.
- **Match Open:** escena de estadio/cancha, fase, fecha, sede, cupo y estado de
  convocatoria; el estado del actor continúa inmediatamente debajo.
- **Profile:** escena de identidad con Player Card, nombre, OVR Plate y roles.
- Los empty states importantes tienen composición visual propia, no una card
  vacía con dos líneas de texto.

## Player Card direction

La Card conserva 2:3, foto 4:5 y atributos F5 reales. V3 introduce un frame
asimétrico propio, campo interno, corte superior derecho, banda de identidad y
placa F5. No utiliza escudo, marco, nomenclatura ni composición FUT/EA. La Card
es un objeto de identidad FIFAR y puede evolucionar independientemente del
resto de surfaces.

## Navigation

En mobile, header y bottom navigation se sienten nativos: marca compacta,
utilidades de bajo ruido e iconos propios existentes en SVG inline. El estado
activo usa F5 Cut + gold. Cerrar sesión sigue accesible, pero visualmente quiet.
En desktop, la navegación acompaña una composición ancha sin convertirla en
sidebar SaaS.

## Responsive

### Mobile 390–430 px

- Una columna; propósito visible en el primer viewport.
- Features usan imagen y profundidad sin ocupar una pantalla completa.
- Rails horizontales se reservan para conjuntos breves, con snap.
- Bottom navigation respeta safe-area y nunca cubre contenido.

### Desktop 1440 px

- El ancho útil V3 llega a `88rem`.
- Las escenas se componen en dos zonas, no como mobile estirado.
- Home usa main + status context; Profile presenta Card e identidad en una sola
  escena; Match Open distribuye crest, información y cupo.

## Accessibility

- Contraste AA razonable sobre canvas/surface/raised.
- Focus visible, navegación por teclado y targets de 44 px.
- Fase, unread, participación y selección nunca dependen sólo del color.
- Assets decorativos no capturan eventos y no contienen información única.
- `prefers-reduced-motion` conserva una experiencia estable.

## Do / Don't

- **Do:** escena deportiva real. **Don't:** reskin con variables nuevas.
- **Do:** profundidad localizada. **Don't:** card soup ni border soup.
- **Do:** crests determinísticos. **Don't:** clubes o marcas ficticias copiadas.
- **Do:** silueta rica. **Don't:** círculo con inicial.
- **Do:** geometría FIFAR. **Don't:** escudo/card FUT.
- **Do:** 1440 px con intención. **Don't:** columna web estrecha centrada.
- **Do:** preservar IA. **Don't:** mover contenido para parecerse a referencias.

## Alcance deliberado

El piloto no modifica Play, otros lifecycles de Match, Group, Rankings, Search,
Notifications, Settings, Admin, backend, endpoints, contratos, schemas,
permisos, privacidad, lifecycle ni progression. No hay commit ni push hasta la
aprobación visual de las seis capturas.
