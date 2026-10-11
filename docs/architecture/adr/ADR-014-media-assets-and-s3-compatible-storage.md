# ADR-014 — Media Assets and S3-Compatible Object Storage

## Status

Accepted.

## Context

Player necesita una foto deportiva para su Card, pero la identidad de dominio
no debe depender de URLs, buckets ni APIs del provider. El modelo inicial
retenía sólo la rendition 800×1000: era privado y seguro, pero impedía
reencuadrar sin degradar porque toda edición posterior partía de una imagen ya
recortada.

## Decision

- `Player.avatarMediaAssetId` continúa siendo nullable y referencia
  exclusivamente la rendition activa `PLAYER_AVATAR`.
- Un upload nuevo crea una fuente privada `PLAYER_AVATAR_SOURCE` y una
  rendition privada `PLAYER_AVATAR`; ambas usan ids y object keys distintos.
- `player_avatar_states` es una relación 1:1 por Player que vincula fuente y
  rendition, persiste `cropX`, `cropY` y `zoom` normalizados, una revisión CAS
  y timestamps. El estado de crop no contamina metadata genérica.
- La fuente no es el original: el API valida como máximo 8 MB, aplica
  orientación EXIF, elimina metadata, limita dentro de 2400×2400 sin ampliar y
  codifica WebP quality 90. La rendition se deriva desde esa fuente como WebP
  800×1000 quality 82.
- Browser y Sharp comparten el contrato matemático
  `avatarCropRectangle(sourceWidth, sourceHeight, crop)`; ningún offset de
  viewport se persiste.
- `GET /me/player/avatar/source` exige sesión y resuelve sólo el source del
  Player actor. No existe delivery público de source.
  `/media/:assetId/content` continúa entregando sólo la rendition READY
  actualmente referenciada.
- Cada upload/reencuadre crea object key y asset nuevos. Storage se escribe
  antes; una transacción bloquea Player/estado, activa assets y conmuta las
  referencias. Si DB/CAS falla, los objetos nuevos se compensan y se marcan
  DELETED. Los objetos anteriores se retiran best-effort sólo después del
  commit.
- Reencuadre bloquea el estado y compara revisión y rendition esperadas. Una
  escritura obsoleta devuelve conflicto 409, sin doble transición ni asset
  autoritativo huérfano.
- Reemplazo y eliminación abarcan la pareja source+rendition. Anonimización
  reutiliza la misma eliminación antes de borrar auth. Un cleanup externo
  fallido nunca deja una referencia activa rota.
- Avatares existentes permanecen source-less y válidos. Se proyectan como
  LEGACY y requieren una reselección única para habilitar reencuadre real; no
  hay backfill ni reconstrucción falsa.
- La rendition usa asset id/key nuevos en cada guardado, por lo que el cache
  privado immutable nunca sirve un encuadre anterior.

## Migration and rollback

La migración es aditiva: amplía el enum con `PLAYER_AVATAR_SOURCE` y crea
`player_avatar_states`; no modifica referencias ni objetos existentes. Un
rollback de aplicación puede ignorar la tabla y conserva legibilidad de las
renditions. Revertir físicamente el enum o borrar la tabla no es una operación
automática segura después de crear sources: exige primero retirar esos assets
y se planifica como migración explícita, nunca como rollback destructivo ciego.

## Consequences

MinIO puede sustituirse por AWS S3, R2 u otro provider S3-compatible sin cambiar
Player ni contratos públicos. El costo de storage aumenta por la fuente
saneada, acotada y privada, a cambio de re-edición fiel. El proxy API sigue
siendo apropiado para estos objetos; videos/CDN/direct upload requieren otra
decisión futura. Un cleanup best-effort fallido puede dejar un objeto marcado
DELETED para reconciliación posterior, pero nunca una referencia activa rota.
