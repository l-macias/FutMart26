# Product Constitution

## Visión

Crear una plataforma para fútbol amateur recurrente que transforme la organización informal de partidos en una experiencia deportiva persistente: convocatoria, participación, armado de equipos, evaluación, progreso, cards, estadísticas y reputación deportiva.

La V1 se centra exclusivamente en **Groups + F5** y será probada con usuarios reales antes de expandirse.

## Principios de producto

### 1. Identidad global, rendimiento contextual

Un `Player` es global.

El rendimiento deportivo pertenece a una disciplina. En V1 solo existe F5, pero el modelo debe admitir perfiles independientes futuros para F7 y F11.

Un jugador puede pertenecer a múltiples grupos y cada partido válido de F5 modifica el mismo perfil/rating F5 global del jugador.

Las estadísticas pueden consultarse globalmente y desglosarse por grupo, pero el rating competitivo F5 es único.

### 2. El grupo es social, el partido define la actividad

Un jugador puede pertenecer a muchos grupos.

Un grupo no debe quedar arquitectónicamente encerrado a una única disciplina. V1 solo crea partidos F5, pero F7 y F11 son requisitos futuros confirmados.

### 3. Progresión visible y memorable

El rating no debe cambiar silenciosamente.

Después de una votación cerrada, el jugador debe poder ver un `Progression Reveal` con:

- card anterior;
- card nueva;
- OVR anterior/nuevo;
- deltas por atributo;
- awards/achievements obtenidos;
- cambio de tier/card cuando corresponda.

El historial debe conservar hitos como:

- fecha de inicio;
- tiempo y cantidad de partidos hasta Silver/Gold/etc.;
- mejor OVR histórico;
- snapshots de progresión por partido.

### 4. Evidencia antes que autopercepción

La información autodeclarada sirve para cold start y preferencias.

A medida que existe historial real, el matchmaking y el rendimiento deben depender principalmente de evidencia observada.

### 5. Configurable, no hardcodeado

Rating, progresión, cards, awards, achievements, confidence y pesos de matchmaking deben tener una base configurable.

Las configuraciones nuevas aplican prospectivamente. Nunca reescriben la historia ya calculada.

### 6. Fricción mínima

La app debe adaptarse al fútbol amateur real:

- partidos con menos jugadores;
- bajas;
- suplentes;
- guests;
- lesiones;
- falta de estadísticas;
- poca participación en votaciones.

No debe intentar resolver conflictos humanos que corresponden al grupo.

### 7. Autoridad local

El owner y los moderadores autorizados son responsables de mantener correctamente cada grupo y partido.

El producto ofrece integridad técnica, auditoría y herramientas; no pretende arbitrar disputas sociales.

### 8. Future-aware, not future-built

F7, F11, Leagues/Competitions y monetización son futuros confirmados.

El MVP no los implementa, pero ninguna decisión estructural debe volverlos innecesariamente costosos o exigir rehacer el core.
