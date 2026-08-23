# MVP Scope — F5 Groups

## Estado

**FROZEN — Product Discovery v1.0**

Una idea nueva no modifica el MVP automáticamente.

Solo se reabre el alcance si aparece:

- un defecto conceptual fundamental;
- un problema grave de seguridad o integridad;
- una decisión que invalida el producto;
- una decisión que bloquea un futuro confirmado;
- una limitación arquitectónica que exigiría rehacer el core.

## Dentro de V1

### Identity / Player

- cuenta;
- perfil básico;
- perfil deportivo F5;
- roles/preferencias F5;
- hasta 3 fortalezas autodeclaradas;
- preferencia/disponibilidad como arquero;
- nivel inicial autodeclarado;
- card F5;
- OVR F5;
- atributos F5;
- progreso e historial;
- última actividad;
- mejor OVR histórico.

### Groups

- crear grupo;
- múltiples grupos por jugador;
- owner único;
- múltiples moderadores;
- permisos configurables por moderador;
- miembros;
- invitaciones mediante link;
- abandono/expulsión sin borrar historia;
- sucesión de ownership.

### Matches

- crear partido F5;
- draft/publicación;
- fecha;
- hora;
- duración;
- cupo objetivo;
- lugar;
- modificación de horario/fecha;
- confirmados;
- suplentes;
- bajas;
- promoción automática;
- override manual;
- múltiples guests;
- nombre opcional de guest;
- roster bloqueado al comenzar el partido;
- cancelación;
- veedor opcional;
- confirmación final de participantes antes de abrir votación.

### Guest linking

- guest evaluable;
- guest sin derecho a votar salvo que tenga cuenta real;
- propuesta de vínculo Guest → Player;
- aprobación obligatoria del Player real;
- transferencia de historial solo después de aceptar;
- auditoría del vínculo.

### Matchmaking

- manual;
- algorítmico/inteligente;
- propuesta editable;
- priorizar arquero por equipo cuando sea posible;
- balance de roles;
- balance de capacidad/rating;
- señales autodeclaradas para jugadores nuevos;
- pérdida progresiva de peso del self-report con historial;
- configuración futura de pesos sin rediseñar el motor.

### Post-match / Voting

- roster confirmado antes de abrir votación;
- ventana de 18 horas por defecto, configurable;
- cierre anticipado si todos los elegibles votaron;
- no autoevaluación;
- compañeros y rivales evaluables;
- posibilidad de saltear jugadores;
- modo rápido;
- modo completo;
- rating 1–10;
- hasta 3 fortalezas;
- hasta 3 puntos bajos;
- hasta 3 destacados;
- confidence configurable;
- poca participación válida;
- detección simple de boletas anómalas;
- owner/mod autorizado puede anular boleta;
- votos anónimos frente a jugadores, no frente a moderación.

### Rating / Progression

- OVR inicial 60;
- atributos iniciales configurables;
- progresión no lineal;
- mayor elasticidad en rangos bajos;
- dificultad creciente para subir a ratings altos;
- sensibilidad negativa configurable;
- menor impacto de negativos aislados;
- recurrencia negativa configurable;
- confidence afecta magnitud del cambio;
- límites máximos de cambio por partido;
- precisión interna superior a la visible;
- configuración prospectiva;
- snapshot before/after por partido.

### Cards

- card por disciplina;
- card inicial;
- tiers básicos;
- cambio/reveal visual;
- historial de hitos;
- arquitectura para cards especiales/configurables.

### Statistics

- partidos jugados;
- goles opcionales;
- asistencias opcionales;
- resultado opcional;
- `UNKNOWN` distinto de empate;
- posibilidad de empate conocido sin score exacto;
- desglose por grupo;
- stats globales F5.

### Awards

- conjunto pequeño inicial;
- definición extensible;
- imagen futura;
- historial.

### Achievements

- conjunto pequeño inicial;
- definición extensible;
- imagen futura;
- historial.

### Notifications

- preferencias por evento;
- preferencias por canal;
- invitación a grupo;
- partido publicado;
- cambio relevante de partido;
- promoción desde waitlist;
- recordatorio opcional 1 hora antes;
- votación abierta;
- resultados disponibles;
- expulsión/remoción;
- eventos administrativos necesarios para owner/moderadores.

## Extensibilidad obligatoria

Debe ser posible evolucionar sin rehacer el core:

- configuración de rating/progresión;
- configuración de confidence;
- configuración de matchmaking;
- nuevas stats;
- nuevas cards;
- nuevas imágenes de cards;
- nuevos awards;
- nuevos achievements;
- nuevos canales de notificación;
- nuevas disciplinas.

## Future confirmed — fuera de V1

- F7;
- F11;
- Leagues / Competitions;
- monetización.

## Parking lot / backlog

- tablón social;
- comentarios;
- respuestas;
- reacciones;
- búsqueda pública de jugadores;
- mensajes privados;
- cuadrangulares / mini torneos;
- estadísticas avanzadas;
- cards de eventos/temporadas sofisticadas;
- sponsors;
- marketplace;
- video/fotos sociales;
- moderación social avanzada.
