# Backup y restore V1

Este procedimiento cubre PostgreSQL y media. Un dump local sin copia off-host y
sin restore probado **no** habilita release.

## Objetivos operativos

- RPO objetivo V1: hasta 24 h con backup diario verificado.
- RTO objetivo V1: recuperación manual dentro de 4 h para un beta pequeño; no
  es un SLA ni alta disponibilidad.
- Retención mínima: 14 diarios, 4 semanales y 3 mensuales.
- PostgreSQL y media deben tener recovery points alineados y fuera del VPS.

## Estrategia elegida

Media usa directamente object storage S3-compatible externo y privado. El
bucket de backups DB debe ser separado, privado, cifrado y con credenciales de
escritura/lectura acotadas. Si el deploy conserva MinIO local, debe existir un
`mc mirror` programado a una segunda failure domain; MinIO local solo es NO-GO.

Aplicar lifecycle del provider para retención. No dar acceso público y no usar
credenciales de media para backups DB.

## Crear y verificar backup DB

Requisitos: `pg_dump` y `pg_restore` compatibles con la versión del server.
`BACKUP_DIR` debe ser absoluto, estar fuera del repositorio y tener permisos
restrictivos.

```bash
DATABASE_URL='postgresql://…' BACKUP_DIR='/var/backups/football/staging' \
BACKUP_OFFSITE_REQUIRED=true \
  pnpm db:backup
```

El comando usa `pg_dump -Fc`, exige tamaño mayor a cero, valida el TOC con
`pg_restore --list` y crea un sidecar `.sha256`. Cualquier paso falla non-zero.
`pg_dump` produce un snapshot consistente online y no requiere detener la app.

## Copiar off-host

Configurar un destino S3-compatible externo por variables `BACKUP_S3_*`. Con
`BACKUP_OFFSITE_REQUIRED=true`, `db:backup` encadena y verifica automáticamente
la copia remota; cualquier fallo deja exit code non-zero. Para reintentar sólo
la subida de un dump ya verificado:

```bash
BACKUP_FILE='/var/backups/football/staging/football-….dump' \
  pnpm db:backup:offsite
```

El uploader exige HTTPS cuando hay endpoint explícito, usa cifrado server-side
AES-256, sube el checksum como metadata y verifica tamaño/checksum con
`HeadObject`. IAM role puede reemplazar keys estáticas. El log sólo muestra
bucket/key/tamaño, nunca credenciales.

Una ejecución exitosa del script prueba transporte, no retention ni restore.
Confirmar en el provider: bucket privado, lifecycle, cifrado y cuenta sin acceso
público.

## Automatización

Ejecutar diariamente con systemd timer, cron o scheduler del provider. Flujo:

1. `BACKUP_OFFSITE_REQUIRED=true pnpm db:backup`.
2. registrar exit code, tamaño, checksum y key remota.
3. limpiar staging local sólo después del `HeadObject` exitoso, conservando como
   máximo 2 copias para no llenar disco.

El scheduler debe alertar por exit code non-zero (mail del host/provider o
alerta ya disponible). Revisar diariamente el último éxito en operaciones. No
considerar stdout aislado como monitoreo suficiente.

## Backup de media

Para storage externo, habilitar versioning o snapshots del provider y probar
recuperación de una key. Para MinIO local:

```bash
mc alias set media-source "$OBJECT_STORAGE_ENDPOINT" "$OBJECT_STORAGE_ACCESS_KEY" "$OBJECT_STORAGE_SECRET_KEY"
mc alias set media-backup "$MEDIA_BACKUP_ENDPOINT" "$MEDIA_BACKUP_ACCESS_KEY" "$MEDIA_BACKUP_SECRET_KEY"
mc mirror --overwrite media-source/football-media media-backup/football-media
```

No usar `--remove`: una eliminación accidental no debe propagarse de inmediato
al recovery copy. Registrar el checkpoint temporal junto al backup DB.

## Restore drill obligatorio

Nunca restaurar sobre la única DB valiosa. Crear una DB nueva y vacía con nombre
explícito de drill. El uploader conserva el checksum como metadata `sha256`, no
como objeto sidecar. Recuperar ambos con un cliente S3 configurado para el mismo
provider y con credenciales operativas, sin imprimirlas:

```bash
aws s3 cp "s3://$BACKUP_S3_BUCKET/$BACKUP_OBJECT_KEY" "$RESTORE_DUMP_FILE"
backup_checksum=$(aws s3api head-object --bucket "$BACKUP_S3_BUCKET" \
  --key "$BACKUP_OBJECT_KEY" --query Metadata.sha256 --output text)
printf '%s  %s\n' "$backup_checksum" "$(basename "$RESTORE_DUMP_FILE")" \
  > "$RESTORE_DUMP_FILE.sha256"
```

Para un provider distinto de AWS, configurar su endpoint HTTPS en el cliente.
El script de restore valida el formato y recalcula el hash del dump descargado
antes de escribir en PostgreSQL. Crear el target vacío con `createdb`, usando
`PGHOST`, `PGPORT`, `PGUSER` y credenciales del entorno de drill:

```bash
createdb football_restore_drill
```

Ejecutar:

```bash
RESTORE_DATABASE_URL='postgresql://…/football_restore_drill' \
RESTORE_DUMP_FILE='/safe/football-….dump' \
RESTORE_CONFIRM='RESTORE_NON_PRODUCTION' \
  pnpm db:restore
```

`db:restore` rechaza el mismo URL que `DATABASE_URL`, exige el sidecar, valida
SHA-256 y TOC antes de `pg_restore --exit-on-error`.

Después:

1. ejecutar migrations actuales contra la DB restaurada;
2. arrancar un API production-like apuntando sólo a esa DB;
3. comprobar `/readiness`;
4. verificar cuentas, Players, Groups, Matches, participaciones, snapshots de
   Progression y Audit;
5. restaurar una key de avatar en un bucket temporal y comprobar GET autenticado,
   ETag, content type y tamaño;
6. documentar fecha, duración, versiones de PostgreSQL, dump, checksum y resultado;
7. eliminar los targets de drill sólo después de conservar evidencia.

## Recuperación real

1. Contener writes y declarar incidente.
2. Identificar recovery point DB + media alineado.
3. Descargar y verificar artefactos.
4. Restaurar en recursos nuevos, nunca sobre los dañados.
5. Aplicar migrations si corresponde.
6. Hacer smoke privado.
7. Cambiar conexión/routing.
8. Verificar y conservar los recursos anteriores para análisis.

Una falla de deploy de app no justifica restore DB. Ver `DEPLOYMENT.md` e
`INCIDENT_RUNBOOK.md`.
