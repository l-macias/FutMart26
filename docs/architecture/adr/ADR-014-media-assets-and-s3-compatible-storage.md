# ADR-014 — Media Assets and S3-Compatible Object Storage

## Status

Accepted.

## Context

Player necesita una foto deportiva para su Card, pero la identidad de dominio
no debe depender de URLs, buckets ni APIs de MinIO. Los uploads requieren
validación, procesamiento, ownership y replacement seguro.

## Decision

- `Player` conserva una FK nullable al `MediaAsset` activo.
- V1 implementa únicamente purpose `PLAYER_AVATAR` y estados `PENDING`, `READY`
  y `DELETED`.
- Los bytes viven detrás de `StorageProvider`; el adapter actual usa la API S3
  compatible de MinIO con bucket privado pre-provisionado.
- Browser sube multipart al Fastify API. El API valida como máximo un raster de
  8 MB, autorota, elimina metadata, aplica crop y guarda sólo WebP 800×1000.
- Cada replacement usa asset id y key nuevos. Una transacción activa el nuevo
  asset y actualiza Player; el objeto anterior se limpia después best-effort.
- `/media/:assetId/content` exige autenticación, sólo entrega un asset READY que
  siga siendo avatar activo y usa cache privado immutable por asset id.
- Los contratos exponen únicamente asset id, ruta de delivery, versión y
  dimensiones. Storage key, bucket y provider permanecen internos.
- La imagen es actual, no histórica: Reveals anteriores pueden mostrar el
  avatar vigente.

## Consequences

MinIO puede sustituirse por AWS S3, R2 u otro provider compatible sin cambiar
Player ni los contratos. El proxy API es apropiado para una rendition pequeña;
videos/CDN/direct upload requieren otra decisión futura. Un cleanup fallido
puede dejar un objeto huérfano marcado `DELETED`, nunca una referencia activa
rota; Integration 29 definirá operación de limpieza y configuración production
obligatoria.
