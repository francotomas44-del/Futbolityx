# Seguridad del backend

Este documento explica qué protege la combinación **API key + IP**, qué no
protege y cómo debe evolucionar antes de cobrar suscripciones.

## 1. Modelo de amenaza

Activos a proteger:

- El motor de análisis y los datos que no queremos distribuir libremente.
- La base de datos y los datos personales de usuarios.
- Las credenciales de pago (Mercado Pago, Stripe, etc.).
- La disponibilidad del servicio (evitar abuso y scraping masivo).

Atacantes posibles:

- Usuario que copia la API key pública del navegador.
- Script que hace scraping de endpoints.
- Cliente que intenta saltear el paywall modificando el frontend.
- Tercero que intenta falsificar un webhook de pago.

## 2. Qué protege API key + IP

- **API key**: identifica al cliente, permite rate limiting, revocación y
  trazabilidad. Si se filtra, se rota.
- **IP allowlist**: restringe llamadas server-to-server a rangos conocidos.
- **Rate limiting**: reduce abuso y scraping.
- **CORS**: evita que otros sitios usen la API desde el navegador (no evita
  llamadas directas con curl).
- **Validación de entrada**: evita SSRF, payloads enormes y datos inválidos.

## 3. Qué NO protege API key + IP

- **No autentica usuarios.** Una API key en el navegador es pública: cualquiera
  puede verla en DevTools. No sirve para decidir si alguien pagó.
- **No permite allowlist de IP para usuarios finales.** Cada usuario tiene su
  propia IP, que cambia (móvil, IPv6, NAT). Una allowlist de IP rompería la app.
- **No evita que alguien use el motor local.** El código es MIT y el motor está
  en `js/stats.js`; si el navegador lo descarga, ya lo tiene.
- **No evita scraping** por sí solo. Para eso: rate limiting agresivo, captchas
  en registro, límites por cuenta y monitoreo.

Conclusión: **API key + IP es una capa de anti-abuso, no un sistema de
autorización de pagos.**

## 4. Reglas de oro

1. **Nunca** poner secretos de pago en el frontend.
2. **Nunca** confiar en el cliente para decidir si un plan está activo.
3. Los endpoints premium deben verificar **usuario + entitlement** en el servidor.
4. Los webhooks de pago deben verificar **firma** y ser idempotentes.
5. Guardar solo **hashes** de API keys, nunca las keys en texto plano.
6. HTTPS obligatorio; HSTS a nivel proxy.
7. Rotar keys y secretos periódicamente.
8. Loguear requests sin incluir la API key ni datos personales sensibles.

## 5. Configuración segura

- `API_KEYS` con `keyHash` (SHA-256), no con `key`.
- `CORS_ORIGINS` limitado a los dominios reales.
- `TRUST_PROXY=true` solo si el proxy agrega `X-Forwarded-For` de forma confiable.
- `BODY_LIMIT_BYTES` y `ANALYZE_MAX_MATCHES` ajustados al uso real.
- Rate limiting con Redis si hay más de una instancia.
- Firewall/proxy delante del proceso Node; no exponer Node directamente.
- Variables de entorno en el gestor de secretos del proveedor, no en el repo.

## 6. Camino a suscripciones seguras

1. **Cuentas**: email magic link u OAuth. Sesión con cookie `HttpOnly`, `Secure`,
   `SameSite=Lax` o token JWT de corta duración.
2. **Entitlements**: tabla `subscriptions` con `user_id`, `plan`, `status`,
   `current_period_end`, `provider`, `provider_subscription_id`.
3. **Middleware**: cada endpoint premium resuelve `request.user` y verifica el
   plan antes de ejecutar. No alcanza con ocultar botones en el frontend.
4. **Pagos**: crear preferencia/sesión en el servidor; el cliente nunca envía el
   precio ni el plan como verdad.
5. **Webhooks**: verificar firma del proveedor, responder 2xx rápido, procesar
   de forma idempotente y reconciliar con una consulta al proveedor.
6. **Cancelación**: mantener acceso hasta `current_period_end`, luego degradar.
7. **Auditoría**: registrar cambios de plan, pagos, reembolsos y accesos
   administrativos.

## 7. Datos y privacidad

- `/v1/analyze` recibe los partidos que envía el cliente. No persistir ese
  payload salvo que sea necesario y esté informado en la política de privacidad.
- Los logs deben evitar API keys, tokens, emails y cualquier dato personal.
- Definir retención de logs y backups.
- Si se agregan cuentas, actualizar `docs/legal/politica-de-privacidad.md` y
  `docs/legal/terminos-y-condiciones.md` antes de recolectar datos.

## 8. Checklist antes de producción

- [ ] HTTPS y dominio propio.
- [ ] `API_KEYS` con hashes y scopes mínimos.
- [ ] `CORS_ORIGINS` sin comodines.
- [ ] Rate limiting probado.
- [ ] Health check y alertas.
- [ ] Backups y plan de recuperación.
- [ ] Webhooks con firma verificada.
- [ ] Entitlements verificados en el servidor.
- [ ] Documentos legales actualizados (cuentas, pagos, cancelación, reembolsos).
- [ ] Botón de arrepentimiento y política de reembolsos publicados.
