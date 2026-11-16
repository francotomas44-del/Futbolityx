# Deploy en Vercel y activación de cobros

Guía operativa para publicar Futbolityx con cuentas, planes y pagos. El detalle
técnico de la API está en [`server/README.md`](../server/README.md).

## Estado actual

- Frontend estático en la raíz del repo.
- Backend serverless en `api/`, con rewrite `/v1/*` → `/api/*` en
  [`vercel.json`](../vercel.json).
- Cuentas por magic link, sesiones con cookie `HttpOnly`, planes Free/Pro/Elite,
  cuotas y entitlements.
- Checkout y webhooks de Paddle (USD) y Mercado Pago (ARS) implementados.
- Los cobros quedan deshabilitados hasta que se cumplan estas tres condiciones:
  1. `PRICING_STATUS=approved`.
  2. El proveedor tenga API key/token **y** webhook secret.
  3. Exista al menos un price ID (Paddle) o preapproval plan ID (Mercado Pago).
- `data/` (94 MB) se excluye del deploy con [`.vercelignore`](../.vercelignore);
  en Vercel (o cualquier host que no sea GitHub Pages/localhost) el frontend lee
  los datos históricos desde GitHub Pages. Si usás Vercel Pro y desplegás `data/`
  dentro del proyecto, borrá el bloque correspondiente en `index.html`.

## 1. Crear el proyecto en Vercel

1. Importar `francotomas44-del/Futbolityx` desde el dashboard de Vercel.
2. Framework preset: **Other**. Sin build command. Output directory: `.`.
3. Región: `gru1` (ya está en `vercel.json`).
4. No cargar variables todavía; primero crear la base y el proveedor de email.

El deploy inicial puede quedar con las cuentas deshabilitadas, pero el análisis
local y los datos históricos deben seguir funcionando.

## 2. Variables de entorno

Cargar en **Production** y, si se usan, en **Preview**.

### Base

```env
NODE_ENV=production
APP_URL=https://tu-proyecto.vercel.app
API_PUBLIC_URL=https://tu-proyecto.vercel.app
CORS_ORIGINS=https://tu-proyecto.vercel.app,https://francotomas44-del.github.io
API_KEYS=[{"id":"web","keyHash":"<sha256>","scopes":["analyze","live"],"ips":[]}]
ANALYZE_MAX_MATCHES=20000
BODY_LIMIT_BYTES=4500000
```

- `API_PUBLIC_URL` es la URL pública del backend. Si frontend y backend comparten
  proyecto, usar el mismo dominio.
- Generar el hash de la API key con `cd server; npm run hash-key`.
- No usar `AUTH_DEV_MODE=true` en producción.

### Cuentas y email

```env
DATABASE_URL=postgresql://...
SESSION_COOKIE_NAME=futbolityx_session
SESSION_DAYS=30
MAGIC_LINK_MINUTES=15
AUTH_DEV_MODE=false
RESEND_API_KEY=re_...
EMAIL_FROM=Futbolityx <no-reply@tudominio.com>
```

Sin `RESEND_API_KEY` y `EMAIL_FROM`, el magic link falla con
`email_not_configured` en producción.

### Precios y cobros

Primero dejar los precios en `proposed`. Cuando estén aprobados, cambiar a
`approved` y recién ahí cargar las credenciales reales.

```env
PRICING_STATUS=proposed
PLAN_PRO_ARS_MONTHLY=6900
PLAN_PRO_ARS_YEARLY=59000
PLAN_PRO_USD_MONTHLY=9
PLAN_PRO_USD_YEARLY=90
PLAN_ELITE_ARS_MONTHLY=14900
PLAN_ELITE_ARS_YEARLY=129000
PLAN_ELITE_USD_MONTHLY=19
PLAN_ELITE_USD_YEARLY=190
```

Paddle (internacional, USD):

```env
PADDLE_ENVIRONMENT=sandbox
PADDLE_API_BASE=
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
PLAN_PADDLE_PRO_MONTHLY=pri_...
PLAN_PADDLE_PRO_YEARLY=pri_...
PLAN_PADDLE_ELITE_MONTHLY=pri_...
PLAN_PADDLE_ELITE_YEARLY=pri_...
```

Mercado Pago (ARS):

```env
MP_API_BASE=
MP_ACCESS_TOKEN=...
MP_WEBHOOK_SECRET=...
PLAN_MP_PRO_MONTHLY=...
PLAN_MP_PRO_YEARLY=...
PLAN_MP_ELITE_MONTHLY=...
PLAN_MP_ELITE_YEARLY=...
```

## 3. Base de datos PostgreSQL

1. Crear una base en Neon, Vercel Postgres o Supabase.
2. Copiar la connection string a `DATABASE_URL`.
3. Ejecutar el esquema:

```powershell
psql "$env:DATABASE_URL" -f server/sql/001_init.sql
```

4. Verificar que las tablas existan: `users`, `login_tokens`, `sessions`,
   `subscriptions`, `payment_events`, `usage_events`.
5. Redeploy después de cargar `DATABASE_URL`.

Sin `DATABASE_URL`, en Vercel las rutas de cuenta fallan con
`database_not_configured`; el resto de la app sigue funcionando.

## 4. Resend y dominio de envío

1. Crear una cuenta en Resend y verificar el dominio de `EMAIL_FROM`.
2. Crear una API key y cargarla en `RESEND_API_KEY`.
3. Probar un magic link real a un email propio.
4. Revisar que el enlace llegue a `https://tu-proyecto.vercel.app/api/auth/callback`
   y que después redirija a `APP_URL/?auth=ok`.

## 5. Verificación de cuentas en producción

Con el deploy y la base configurados:

```powershell
curl.exe https://tu-proyecto.vercel.app/api/health
curl.exe https://tu-proyecto.vercel.app/v1/plans
```

Luego, en el navegador:

1. Abrir la app y pulsar **Ingresar**.
2. Pedir el magic link y completar el login.
3. Verificar la cookie `futbolityx_session` como `HttpOnly`, `Secure` y
   `SameSite=Lax`.
4. Abrir **Mi cuenta** y comprobar plan Free, uso `0 / 10` y logout.
5. Confirmar que el plan Pro/Elite muestra **Próximamente** mientras
   `PRICING_STATUS=proposed`.
6. Con una suscripción de prueba activa, usar **Cancelar renovación** y verificar
   que el acceso se mantiene hasta `current_period_end`.

## 6. Paddle sandbox

1. Crear los productos y precios en el dashboard sandbox de Paddle.
2. Cargar los `pri_...` en las variables `PLAN_PADDLE_*`.
3. Configurar el webhook:
   `https://tu-proyecto.vercel.app/api/webhooks/paddle`
   con los eventos de suscripción (`subscription.created`, `subscription.updated`,
   `subscription.canceled`, `subscription.past_due`).
4. Copiar el webhook secret a `PADDLE_WEBHOOK_SECRET`.
5. Para probar el checkout, definir temporalmente `PRICING_STATUS=approved` en
   el entorno de pruebas y usar `PADDLE_ENVIRONMENT=sandbox`.
6. Pagar con una tarjeta de prueba y verificar:
   - El webhook responde 200 y no duplica el evento.
   - `/v1/account` muestra el plan Pro o Elite.
   - Los límites y funciones del plan se aplican.

## 7. Mercado Pago sandbox

1. Crear los planes de suscripción (`preapproval_plan`) en el entorno de prueba.
2. Cargar los IDs en `PLAN_MP_*`.
3. Configurar el webhook:
   `https://tu-proyecto.vercel.app/api/webhooks/mercadopago`
   para eventos de `preapproval` y `subscription_preapproval`.
4. Copiar el secret a `MP_WEBHOOK_SECRET`.
5. Probar con un usuario de prueba y verificar el flujo completo.
6. Confirmar que los eventos de `payment` no se confunden con preapprovals.

## 8. Pasar a producción

Antes de cobrar de verdad:

- [ ] Precios definitivos aprobados.
- [ ] `PRICING_STATUS=approved`.
- [ ] `PADDLE_ENVIRONMENT=production` y credenciales live de Paddle.
- [ ] Credenciales de producción de Mercado Pago.
- [ ] Webhooks apuntando a las URLs públicas y secrets actualizados.
- [ ] `AUTH_DEV_MODE=false`.
- [ ] `RESEND_API_KEY` y dominio verificado.
- [ ] Documentos legales v2.0 publicados y enlazados desde la app.
- [ ] Probar un pago real de bajo monto y reembolsarlo.
- [ ] Verificar cancelación y acceso hasta `current_period_end`.
- [ ] Configurar alertas de errores 5xx y de webhooks fallidos.

## 9. Operación y límites conocidos

- El rate limiting de Vercel es en memoria por instancia. Para producción con
  tráfico real, moverlo a Upstash Redis o Vercel KV.
- Los webhooks se guardan en `payment_events` con `(provider, provider_event_id)`
  único. Un evento duplicado no se vuelve a aplicar.
- Si un webhook llega con un price/plan ID desconocido, queda registrado y se
  emite un warning. Revisar logs y conciliar manualmente.
- La cookie `SameSite=Lax` funciona con frontend y backend en el mismo dominio.
  Si se separan, usar `SameSite=None; Secure` y CORS con credenciales.
- El plan Free tiene 10 análisis cada 24 horas. El uso se cuenta en
  `usage_events`.
- El checkout permite una sola suscripción paga activa por cuenta. Para cambiar
  de plan, el usuario debe cancelar la renovación y esperar el final del período,
  o solicitar el cambio por email.

## 10. Rollback

Si un deploy rompe cuentas o cobros:

1. Volver al deployment anterior desde Vercel.
2. Si el problema es de precios, poner `PRICING_STATUS=proposed` para
   deshabilitar checkout sin tocar el resto.
3. Si el problema es de un proveedor, quitar su API key o webhook secret; el
   checkout de ese proveedor se deshabilita.
4. No borrar `payment_events` ni `subscriptions`: son la fuente de verdad para
   conciliar pagos.

## Problemas comunes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `database_not_configured` | Falta `DATABASE_URL` | Cargarla y redeployar |
| `email_not_configured` | Falta Resend | Cargar `RESEND_API_KEY` y `EMAIL_FROM` |
| El login no setea cookie | `APP_URL` no coincide con el host | Corregir `APP_URL` |
| `pricing_not_approved` | `PRICING_STATUS` no es `approved` | Aprobarlo antes de cobrar |
| `paddle_not_configured` | Falta API key, webhook secret o price ID | Completar variables |
| `mercadopago_not_configured` | Falta token, webhook secret o plan ID | Completar variables |
| Webhook 401 | Secret o firma incorrectos | Revisar el secret del dashboard |
| Webhook 502 de Mercado Pago | Se intentó consultar un pago como preapproval | Verificar el tipo de evento |
