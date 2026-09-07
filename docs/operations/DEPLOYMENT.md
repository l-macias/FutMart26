# Deployment V1

Este runbook es la secuencia reproducible de deploy de FIFAR V1. No reemplaza
la evidencia de ejecución en staging/producción. La API debe correr en **una sola
instancia**; Web y Admin son stateless.

## Topología

```text
Internet
  -> Nginx HTTPS
       -> Web    127.0.0.1:3000
       -> Admin  127.0.0.1:3001
       -> API    127.0.0.1:4000 (exactamente una instancia)
             -> PostgreSQL
             -> SMTP real
             -> object storage S3-compatible privado
```

La definición de containers está en `deploy/compose.production.yml`; el proxy
de referencia está en `deploy/nginx`. PostgreSQL, SMTP y object storage son
dependencias externas y no forman parte del compose de aplicación.

## Prerrequisitos

- Docker Engine con Compose v2 y espacio suficiente.
- Nginx y Certbot en el host frontal.
- PostgreSQL soportado y herramientas cliente de la misma major o una major
  posterior compatible (`pg_dump`, `pg_restore`, `psql`).
- bucket privado de media y bucket privado de backups en otra failure domain.
- sender SMTP aprobado.
- archivo de secrets del host con permisos `0600`, fuera del repositorio.
- SHA candidato inmutable con CI verde.

## Metadata y dominios

Definir sin valores por defecto implícitos:

- `WEB_URL=https://<web>` y `WEB_DOMAIN=<web>`;
- `ADMIN_URL=https://<admin>` y `ADMIN_DOMAIN=<admin>`;
- `BETTER_AUTH_URL=https://<api>` y `API_DOMAIN=<api>`;
- `NEXT_PUBLIC_API_URL=https://<api>` durante el build;
- `APP_VERSION`, `GIT_SHA` de 40 caracteres y `BUILD_TIMESTAMP` ISO-8601.

Los tres hosts deben ser los definitivos del entorno. No usar `localhost` ni
dominios de staging en una imagen de producción.

## Build inmutable

Construir los tres targets desde un checkout limpio del mismo SHA:

```bash
docker build --target api \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION=true \
  --build-arg APP_VERSION="$APP_VERSION" \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_TIMESTAMP="$BUILD_TIMESTAMP" \
  -t "$IMAGE_REGISTRY/football-api:$RELEASE_TAG" .
docker build --target web --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION=true \
  --build-arg APP_VERSION="$APP_VERSION" --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_TIMESTAMP="$BUILD_TIMESTAMP" \
  -t "$IMAGE_REGISTRY/football-web:$RELEASE_TAG" .
docker build --target admin --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION=true \
  --build-arg APP_VERSION="$APP_VERSION" --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_TIMESTAMP="$BUILD_TIMESTAMP" \
  -t "$IMAGE_REGISTRY/football-admin:$RELEASE_TAG" .
```

No usar `latest`. Inspeccionar las imágenes y confirmar que no contienen `.env`,
`.git`, `.runtime`, dumps, screenshots ni artefactos Playwright.

## Proxy y TLS

Renderizar sólo los tres placeholders permitidos; limitar la lista evita que
`envsubst` reemplace variables propias de Nginx:

```bash
envsubst '${WEB_DOMAIN} ${ADMIN_DOMAIN} ${API_DOMAIN}' \
  < deploy/nginx/football.conf.template \
  > /etc/nginx/sites-enabled/football.conf
install -m 0644 deploy/nginx/football-proxy.conf \
  /etc/nginx/snippets/football-proxy.conf
nginx -t
systemctl reload nginx
```

Obtener primero los certificados con Certbot usando un bootstrap HTTP o modo
standalone. Confirmar `systemctl status certbot.timer` y ejecutar
`certbot renew --dry-run`. HTTP debe redirigir a HTTPS. La API sólo se publica a
través de Nginx; por eso `TRUST_PROXY=true` es seguro en este layout. Nunca
exponga `:4000` en una interfaz pública.

## Orden de deploy

1. Congelar el SHA y comprobar CI.
2. Ejecutar y verificar backup DB off-host y checkpoint de media.
3. Cargar y revisar el env del host desde el checkout de operaciones del SHA
   candidato; comprobar URLs, secretos y destino DB antes de cualquier write.
4. Ejecutar **una sola vez** `pnpm db:migrate`.
5. Ejecutar `pnpm prod:check` y registrar la migración esperada. Este check exige
   el schema actual, por eso corre después de migrar; conecta sin mutar DB/storage.
6. Pull de imágenes inmutables.
7. `docker compose --env-file <secrets> -f deploy/compose.production.yml up -d`.
8. Esperar `GET /readiness` 200. `/ready` queda como alias compatible.
9. Ejecutar smoke de usuario y Admin.
10. Verificar versión, SHA, build timestamp y migración en Admin `/system`.
11. Revisar 5xx, Errors y Audit; conservar la imagen anterior.

`/health` sólo prueba proceso vivo. `/readiness` prueba DB y migración para
admisión de tráfico. Storage se muestra en el snapshot, pero sólo DB/migración
deciden readiness; `prod:check` sí exige el probe de storage configurado.

## Startup y shutdown

El API puede iniciar mientras PostgreSQL aún no está disponible, pero permanece
fuera de tráfico con readiness 503. Compose reinicia fallos de proceso; no se
debe ocultar una configuración inválida, que falla antes de escuchar.

Al recibir `SIGTERM`, Fastify deja de aceptar trabajo, cierra conexiones y luego
el pool PostgreSQL. `SHUTDOWN_TIMEOUT_MS` es 15 s por defecto y Compose concede
20 s. Confirmar en staging que el container termina dentro de ese margen.

## Smoke post-deploy

- Auth: register, verificación real, login, logout, forgot/reset y token no
  reutilizable.
- Usuario: Home, Play, deep link Match, join/leave, Group, Rankings, Profile,
  Search, Notifications, avatar replace/delete/re-upload.
- Admin: denial normal, login SUPERADMIN, Players search, Reports, System,
  Errors y Audit; hacer sólo una mutación reversible controlada.
- Direct links: `/play`, Match, Group, Rankings, Profile, Search, Notifications,
  `/players`, `/reports` y `/system` sin 404 de proxy.
- Headers: TLS válido, redirect HTTP, HSTS, CSP, `nosniff`, cookies Secure y
  CORS sólo Web/Admin.

## Rollback

Para un bad deploy, quite tráfico y redeploye la imagen inmutable anterior. No
haga rollback automático de DB. Las migrations son forward-only; preferir
forward-fix compatible. Restaurar DB sólo ante corrupción/pérdida de datos y
siguiendo `BACKUP_RESTORE.md`.

Después del rollback: readiness, auth, flujo Match, Admin System y logs. Si la
migration nueva no es compatible con la imagen anterior, el rollback de app no
es seguro y se debe contener tráfico hasta un forward-fix.

## Capacidad y disco

No fijar CPU/RAM sin medir el VPS real. Presupuestar un API, pool DB de 10, tres
containers, proxy y margen de build/rollback. Docker usa rotación `10m × 3` por
servicio. Monitorear DB, images/cache, logs, backups locales y storage; nunca
conservar backups sólo en el volumen del host.
