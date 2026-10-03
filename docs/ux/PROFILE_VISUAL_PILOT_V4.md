# Profile Visual Pilot V4

> **Piloto aislado.** Este documento gobierna únicamente My Profile y Public
> Profile. No reemplaza `UX_CONTRACT.md`, `PRODUCT_LANGUAGE.md` ni
> `VISUAL_FOUNDATION_V3.md`. Los contratos funcionales, privacidad, rutas y
> orden semántico permanecen congelados.

## Intención

Profile V4 transforma una página oscura basada en títulos, líneas y listas en
una experiencia de identidad deportiva mobile-first. La pantalla se compone
como una companion app: una escena de jugador protagonista, una Player Card
que funciona como objeto, módulos deportivos con imagery real y colecciones
visuales para grupos y palmarés.

El cambio es deliberadamente fuerte, pero está encapsulado en
`.ui-visual-v4`. Ninguna pantalla fuera de Profile adopta estos tokens o
componentes.

## Tipografía

- **Teko** es la display de V4. Su construcción condensada y sus cifras altas
  dan presencia a nombre, OVR, métricas y títulos sin consumir ancho mobile.
  Se usa con peso 600 y no reemplaza los labels de interfaz.
- **Titillium Web** es la fuente de UI. Tiene un ritmo técnico/deportivo más
  propio de una aplicación companion que Manrope/Inter/Geist y conserva buena
  lectura en metadata, acciones y formularios embebidos.

Ambas se cargan mediante `next/font` y sólo se activan en el scope V4. Barlow
Condensed y Manrope siguen vigentes fuera del piloto.

## Paleta y profundidad

El piloto usa canvas navy profundo, superficies charcoal azuladas, texto
neutral, verde pitch puntual y gold cálido controlado. Gold queda reservado a
OVR, acción principal, identidad y pequeños anclajes; no recubre cada borde o
título.

La profundidad proviene de planos, imagery, recortes, overlays y contraste de
superficie. No se usa glow ni animación ornamental.

## Sistema de identidad

### Identity Stage

La apertura combina background deportivo, ilustración abstracta, serial de
identidad, Player Card, nombre, OVR, posiciones y acciones. En mobile es una
escena full-bleed; en desktop se distribuye como composición editorial de dos
zonas, sin alterar el orden del contenido.

### Player Card V4

Conserva 2:3, foto 4:5, OVR, posición, nombre y los seis atributos F5. Cambia
su tratamiento a objeto coleccionable FIFAR: frame asimétrico, plano interior,
portrait completo, placa de identidad, serial y profundidad propia. No usa
escudos, nomenclatura ni geometría FUT/EA.

Si no existe foto, el retrato se elige de forma determinística entre seis
assets locales. El nombre sigue siendo la semilla; no hay randomness ni
requests adicionales.

## Módulos

- **Perfil F5:** plano pitch, gran marca F5 y preferencias autoritativas.
- **Carrera:** planilla visual de cuatro métricas, con OVR separado en la
  escena para no duplicarlo.
- **Progresión:** feature con cancha nocturna y CTA a la ruta existente; nunca
  carga el historial completo eager.
- **Palmarés:** achievements y awards agrupados en rail visual con cuatro
  familias de insignias locales.
- **Grupos:** crests determinísticos y navegación existente. La privacidad se
  conserva como estado, no como decoración.
- **Red y ajustes:** acciones app-like compactas y jerarquía secundaria.

Public Profile comparte el lenguaje visual, pero no el contenido privado. Las
acciones Connect/Invite/Report respetan la autoridad actual. El shell privado
es una escena sobria que no filtra stats, grupos ni preferencias.

## Asset kit

Todos los assets son locales, originales, reemplazables y decorativos; no
representan clubes o jugadores reales.

- `crests/crest-01..06.svg`: carruseles de grupos.
- `players/player-01..06.svg`: fallback de Player Card.
- `backgrounds/pitch-night.svg`, `venue-tunnel.svg`,
  `training-grid.svg`: progresión, privacidad y carrera.
- `backgrounds/profile-hero-01.svg`, `profile-hero-02.svg`: identidad propia y
  pública.
- `badges/badge-01..04.svg`: achievements y awards.
- `illustrations/identity-rings.svg`, `identity-slash.svg`: profundidad y
  composición de identidad.
- `patterns/pattern-grid.svg`, `pattern-chevrons.svg`: F5, rewards y frame.

### V4.1 · Raster density pass

V4.1 mantiene la geometría de la Player Card y aumenta la densidad visual del
resto de Profile. Los fallbacks principales dejan de depender de siluetas SVG:

- `players-raster/player-portrait-01..04.webp`: retratos ficticios originales,
  generados para el piloto, optimizados a 720×960 y elegidos de manera
  determinística por nombre. Ninguno representa a un jugador real.
- `backgrounds-raster/night-pitch.webp`: cancha F5 nocturna para identidad,
  posición, grupos, progresión y profundidad de canvas.
- `backgrounds-raster/players-tunnel.webp`: túnel de acceso para identidad,
  carrera, grupos alternos y privacy shell.

Los raster se combinan con SVG —frames, crests, badges y geometría— en vez de
reemplazar el sistema vectorial. Todos son locales, sin hotlinks y
reemplazables sin modificar contratos de datos.

V4.1 también establece:

- mini cancha autoritativa con posiciones y tres atributos existentes;
- carrera como módulo de identidad con crest, OVR y cuatro placas de métricas;
- grupos como escenas con crest dominante y visibilidad real;
- badges coleccionables de mayor escala para achievements y awards;
- fondos raster con overlays navy para evitar vacío sin perder legibilidad.

### V4.2 · Collectible art pass

V4.2 conserva la composición completa de Profile V4.1 y reemplaza únicamente
la dirección artística de la Player Card. El objeto deja de depender del frame
SVG como fuente principal de riqueza: cinco shells raster locales aportan
material, relieve, reflejos, profundidad, silueta y zonas tácticas propias.

El nivel visual se deriva exclusivamente del OVR existente:

- **Bronze (0–59):** cobre oscuro, textura más rugosa y construcción robusta.
- **Silver (60–69):** acero frío, cortes tensos y reflejo más limpio.
- **Gold (70–79):** oro champagne con arquitectura navy de mayor prestigio.
- **Elite (80–89):** obsidiana, gold rico y acentos emerald de rareza.
- **Legend (90+):** ivory ceremonial, metal claro y máxima profundidad.

Los cinco artefactos comparten familia FIFAR, pero no son recolores. Cada uno
tiene una silueta, distribución estructural y materialidad diferenciadas. El
retrato raster se recorta, mezcla y desvanece dentro de la ventana del shell;
OVR, nombre, seis atributos F5 y metadata siguen siendo HTML accesible y datos
reales. El SVG anterior se conserva como fallback fuera del scope V4, pero no
participa en el render V4.2.

Assets:

- `cards/bronze.webp`
- `cards/silver.webp`
- `cards/gold.webp`
- `cards/elite.webp`
- `cards/legend.webp`

La ruta de desarrollo `/dev/design-system` incluye un showcase comparativo con
el mismo jugador, OVR y atributos. El override de tier sólo existe para esa
comparación: Profile siempre usa los límites derivados de OVR.

El read model no expone temporada ni rol del actor dentro de cada grupo. V4.1
no los inventa: muestra carrera total y visibilidad del grupo hasta que exista
un contrato de producto explícito.

## Mobile

- Objetivo base: 390–430 px.
- Identity Stage full-bleed, Player Card visible y fuerte, nombre/OVR/acciones
  accesibles sin overflow horizontal.
- Métricas en 2×2; colecciones breves usan rails con snap.
- Targets táctiles mantienen 44 px y bottom navigation conserva safe-area.

## Desktop

- A 1440 px, la escena reparte Card e identidad; no estira una columna mobile.
- El contenido secundario puede ocupar dos columnas conservando el orden DOM.
- El ancho útil está limitado y los rails no se convierten en dashboards.

## Accesibilidad

- Nombre, OVR, métricas y estados existen como texto real.
- Assets decorativos usan `alt=""`; contenedores informativos tienen label.
- Focus, keyboard y targets táctiles provienen de los primitives existentes.
- Privacidad, conexión y acciones nunca dependen sólo del color.
- Contraste gold/navy se usa para contenido grande o acciones; metadata mantiene
  neutral accesible.

## Do / Don't

- **Do:** usar assets como parte de la composición. **Don't:** crearlos y
  ocultarlos detrás de overlays opacos.
- **Do:** una Card que funciona sola. **Don't:** panel rectangular con stats.
- **Do:** módulos de carrera, cancha, club y colección. **Don't:** secuencia de
  heading + divider + lista como patrón dominante.
- **Do:** visual fuerte con datos reales. **Don't:** inventar stats, clubes o
  hitos.
- **Do:** propagar V4 sólo a pantallas aprobadas de forma explícita. **Don't:**
  convertir la propagación en un reskin global.

## Fuera de alcance

Este documento continúa gobernando Profile. La propagación aprobada posterior
cubre Home, Play, Match Open, Group Overview, Rankings, Search, Notifications y
Auth y Profile Settings. Los demás estados de Match y Admin siguen fuera. Backend,
endpoints, schemas, permisos, privacidad, lifecycle, routing y data fetching no
se modifican.
