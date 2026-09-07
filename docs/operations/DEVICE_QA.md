# Manual device QA V1

Completar sobre el deployment HTTPS del SHA candidato, con SMTP/storage reales.
Registrar dispositivo, OS/browser version, actor, timestamp y tester. Playwright
no reemplaza este checklist.

## Matriz requerida

- [ ] Desktop Chrome/Chromium actual, 1440 px.
- [ ] Desktop Edge o Firefox actual.
- [ ] Android Chrome físico, viewport aproximado 390–430 px.
- [ ] iPhone Safari físico; si no está disponible, waiver explícito firmado y
      riesgo anotado.

## Flujo autenticado por dispositivo

- [ ] Register 18+ y recepción/apertura de verificación real.
- [ ] Login, refresh, logout y nuevo login.
- [ ] Forgot/reset real; el token no se puede reutilizar.
- [ ] Home muestra current/next/attention sin error de consola.
- [ ] Play y deep link directo cargan.
- [ ] Match OPEN permite join/leave controlado y mantiene cupo.
- [ ] Match Detail STARTED/FINISHED conserva equipos/resultado.
- [ ] Group, roster y ranking contextual cargan.
- [ ] Rankings Global/Group/City/Venue cambian URL/contexto.
- [ ] My/Public Profile y Progression accesible cargan.
- [ ] Search separa Jugadores/Grupos y preserva privacidad.
- [ ] Notifications dropdown/page/read state quedan sincronizados.
- [ ] Avatar JPEG, PNG y WebP: crop/zoom, replace, delete y re-upload.
- [ ] Voting/Progression funciona si el fixture controlado lo permite.

## Calidad transversal

- [ ] No horizontal overflow ni bottom-nav overlap.
- [ ] Teclado móvil no vuelve inaccesible el CTA activo.
- [ ] Back/forward conserva Search/Rankings/query state.
- [ ] Refresh y deep links no producen 404 del proxy.
- [ ] Falla API temporal muestra retry/recuperación sin estado stale.
- [ ] Cero React key warnings, hydration errors, 403 conocidos, promises sin
      manejar y errores product-visible técnicos.
- [ ] Avatar se sirve por HTTPS con ETag/cache privado y sin original expuesto.

## Admin desktop

- [ ] Usuario normal recibe Acceso denegado.
- [ ] SUPERADMIN entra a Overview, Players, Reports, System, Errors y Audit.
- [ ] Search y una mutation reversible controlada quedan auditadas.
- [ ] System muestra environment, version, SHA, build y migration esperados.

No ejecutar acciones destructivas finales ni usar datos de personas reales en
esta prueba.
