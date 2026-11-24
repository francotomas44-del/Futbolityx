# Backend de Futbolityx

API propia para mover las funciones importantes fuera del navegador y preparar
el terreno para cuentas y suscripciones.

Estado actual:

- El frontend **sigue funcionando solo**, sin backend.
- `server/` expone el **motor de análisis**, un **proxy de datos en vivo**,
  **cuentas por magic link**, **sesiones**, **entitlements**, **checkout** y
  **cancelación de suscripciones**.
- La misma lógica corre como servidor Fastify local/Docker y como funciones
  serverless en **Vercel** (`api/`).
- La app puede empezar a usar el backend de forma gradual mediante `js/api.js`.
- El catálogo tiene **Free, Pro y Elite** y los precios propuestos.
- El flujo de cuentas, cuotas, checkout, cancelación y webhooks ya está
  implementado y probado con un store en memoria.
- Todavía **no** hay cobros activos: faltan credenciales, price IDs, base de
  datos PostgreSQL, proveedor de email y la aprobación de precios.

## Requisitos

- Node.js 20 o superior.
- npm.

## Arranque local

```powershell
cd server
npm install
Copy-Item .env.example .env
npm run hash-key
```

El comando `hash-key` imprime:

- una API key (la usa el cliente),
- su SHA-256 (va en el servidor),
- una entrada lista para pegar en `API_KEYS`.

Editá `.env` con esa entrada y arrancá:

```powershell
npm run dev
```

Por defecto escucha en `http://127.0.0.1:8787`.

Comprobación rápida:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/v1/health
```

## Endpoints

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| `GET` | `/v1/health` | pública | Estado del servicio. |
| `GET` | `/v1/meta` | pública | Versión, features y límites. |
| `GET` | `/v1/plans` | pública | Catálogo, estado del cobro y modo beta. |
| `POST` | `/v1/auth/magic-link` | pública | Envía un magic link al email. |
| `GET` | `/v1/auth/callback` | token | Valida el link y crea la sesión. |
| `POST` | `/v1/auth/logout` | cookie | Cierra la sesión. |
| `GET` | `/v1/account` | sesión | Usuario, plan, suscripción, beta y uso. |
| `POST` | `/v1/billing/checkout` | sesión | Crea checkout de Paddle o Mercado Pago. |
| `POST` | `/v1/billing/cancel` | sesión | Cancela la renovación en el proveedor. |
| `POST` | `/v1/webhooks/paddle` | firma | Activa/renueva/cancela suscripciones. |
| `POST` | `/v1/webhooks/mercadopago` | firma | Activa/renueva/cancela suscripciones. |
| `GET` | `/v1/whoami` | `X-API-Key` | Devuelve key, scopes e IP vista por el servidor. |
| `POST` | `/v1/analyze` | sesión o `X-API-Key` | Motor de análisis completo. |
| `GET` | `/v1/live/scoreboard` | sesión Pro/Elite o `X-API-Key` | Partidos del día por liga. |
| `GET` | `/v1/live/summary` | sesión Pro/Elite o `X-API-Key` | Ficha en vivo de un partido. |

En Vercel las mismas funciones se publican como `/api/...`:

| Fastify | Vercel |
| --- | --- |
| `/v1/health` | `/api/health` |
| `/v1/meta` | `/api/meta` |
| `/v1/plans` | `/api/plans` |
| `/v1/auth/magic-link` | `/api/auth/magic-link` |
| `/v1/auth/callback` | `/api/auth/callback` |
| `/v1/auth/logout` | `/api/auth/logout` |
| `/v1/account` | `/api/account` |
| `/v1/billing/checkout` | `/api/billing/checkout` |
| `/v1/billing/cancel` | `/api/billing/cancel` |
| `/v1/webhooks/paddle` | `/api/webhooks/paddle` |
| `/v1/webhooks/mercadopago` | `/api/webhooks/mercadopago` |
| `/v1/whoami` | `/api/whoami` |
| `/v1/analyze` | `/api/analyze` |
| `/v1/live/scoreboard` | `/api/live/scoreboard` |
| `/v1/live/summary` | `/api/live/summary` |

### `POST /v1/analyze`

Recibe los partidos normalizados y los equipos, y devuelve el mismo resultado
que el motor del frontend (`input`, `output`, `homeStats`, `awayStats`,
`baseline`, `confidence`, `headToHead`, `adjustments`, `notes`).

```json
{
  "homeId": "a",
  "awayId": "b",
  "competition": "Liga Profesional Argentina",
  "lineups": true,
  "matches": [
    {
      "id": "m1",
      "date": "2026-01-01",
      "competition": "Liga Profesional Argentina",
      "homeId": "a",
      "awayId": "b",
      "homeGoals": 2,
      "awayGoals": 1,
      "homeCorners": 5,
      "awayCorners": 4,
      "homeCards": 2,
      "awayCards": 2
    }
  ],
  "teams": [
    { "id": "a", "name": "Equipo A" },
    { "id": "b", "name": "Equipo B" }
  ]
}
```

Límites por defecto: 50.000 partidos, 20.000 equipos y 4,5 MB de cuerpo
(Vercel Functions no acepta más). Si corrés Fastify en un VPS podés subir
`BODY_LIMIT_BYTES`.

### Datos en vivo

```powershell
$headers = @{ "X-API-Key" = "tu_key" }
Invoke-RestMethod "http://127.0.0.1:8787/v1/live/scoreboard?league=arg.1&date=2026-11-13" -Headers $headers
Invoke-RestMethod "http://127.0.0.1:8787/v1/live/summary?league=arg.1&event=123456" -Headers $headers
```

El backend valida la liga contra una allowlist, valida la fecha/evento, aplica
timeout, cachea la respuesta y devuelve `cached`/`stale`.

## Planes y entitlements

`GET /v1/plans` devuelve el catálogo con `pricingStatus: "proposed"` y
`billing: "not_available"` mientras los precios no estén aprobados o falte
configurar un proveedor. El checkout rechaza la compra con
`pricing_not_approved` hasta definir `PRICING_STATUS=approved`. La propuesta es
**Free + Pro + Elite**:

- **Free:** análisis básico, 10 análisis por día, sin datos en vivo.
- **Pro:** análisis ilimitado, datos en vivo, exportación y comparador.
- **Elite:** todo Pro, alertas, modelos configurables, API y soporte
  prioritario.

Los entitlements se resuelven en el servidor a partir de la suscripción activa.
Una suscripción `canceled` conserva el acceso hasta `current_period_end`. Una
suscripción vencida o inexistente vuelve a Free.

### Prueba cerrada (beta)

Para abrir una ronda cerrada sin cobrar:

```env
BETA_MODE=closed
BETA_ALLOWED_EMAILS=tester1@email.com,tester2@email.com
BETA_TEST_PLAN=pro
BETA_DISABLE_CHECKOUT=true
BETA_LABEL=Prueba cerrada
```

- `BETA_MODE=closed` rechaza magic links de emails no invitados con
  `403 beta_invite_required`. También invalida las sesiones si el email sale de la
  lista.
- `BETA_TEST_PLAN` (`pro` por defecto, o `elite`) se otorga sin suscripción a los
  invitados. Si el usuario tiene una suscripción paga real, esa tiene prioridad.
- `BETA_DISABLE_CHECKOUT=true` (default) bloquea `/v1/billing/checkout` con
  `403 beta_checkout_disabled` y fuerza `billing: "not_available"` en
  `/v1/plans`. Ponerlo en `false` permite probar checkout en sandbox.
- `/v1/plans` expone `beta` y `/v1/account` expone `beta.invited` para que la UI
  muestre el cartel de prueba.
- Apagar la beta es `BETA_MODE=off`; los invitados vuelven a Free (o a su
  suscripción real) y no se borran datos.

Los precios y los IDs de cada proveedor se configuran por entorno:

```env
PLAN_PRO_ARS_MONTHLY=6900
PLAN_PRO_ARS_YEARLY=59000
PLAN_PRO_USD_MONTHLY=9
PLAN_PRO_USD_YEARLY=90
PLAN_ELITE_ARS_MONTHLY=14900
PLAN_ELITE_ARS_YEARLY=129000
PLAN_ELITE_USD_MONTHLY=19
PLAN_ELITE_USD_YEARLY=190

# Paddle Billing (USD)
PLAN_PADDLE_PRO_MONTHLY=pri_...
PLAN_PADDLE_PRO_YEARLY=pri_...
PLAN_PADDLE_ELITE_MONTHLY=pri_...
PLAN_PADDLE_ELITE_YEARLY=pri_...

# Mercado Pago (ARS)
PLAN_MP_PRO_MONTHLY=...
PLAN_MP_PRO_YEARLY=...
PLAN_MP_ELITE_MONTHLY=...
PLAN_MP_ELITE_YEARLY=...
```

El esquema PostgreSQL está en [`sql/001_init.sql`](sql/001_init.sql). El store
usa `DATABASE_URL` en producción y memoria en desarrollo/tests. Las tablas
incluyen usuarios, tokens de login, sesiones, suscripciones, eventos de pago y
eventos de uso.

### Flujo de cuentas

1. `POST /v1/auth/magic-link` con `{ "email": "..." }`.
2. El usuario abre el link recibido por email (o `devLink` en desarrollo).
3. `GET /v1/auth/callback?token=...` valida el token, marca el email y setea
   una cookie `HttpOnly` `SameSite=Lax`.
4. `GET /v1/account` devuelve usuario, plan, suscripción y uso de las últimas
   24 horas.
5. `POST /v1/billing/checkout` crea el checkout del proveedor elegido. Solo se
   permite si el usuario no tiene un plan pago activo; si ya lo tiene, devuelve
   `409 already_subscribed`.
6. El webhook firmado actualiza la suscripción y, por lo tanto, el plan.
7. `POST /v1/billing/cancel` cancela la renovación en Paddle o Mercado Pago y
   mantiene el acceso hasta `current_period_end`.

Los magic links vencen a los 15 minutos y son de un solo uso. Las sesiones
duran 30 días por defecto. Ambos valores se configuran por entorno.

### Paddle y Mercado Pago

- **Paddle** se usa para pagos internacionales en USD. Los precios se crean en
  el dashboard de Paddle y se referencian con `pri_...`.
- **Mercado Pago** se usa para ARS. Las suscripciones se crean como
  `preapproval_plan` y se referencian con su ID.
- Los webhooks se verifican con firma HMAC:
  - Paddle: `Paddle-Signature` (`ts` + `h1`).
  - Mercado Pago: `x-signature` (`ts` + `v1`).
- Los eventos se guardan en `payment_events` con `provider_event_id` único.
  Si un evento se reintenta después de procesarse, se ignora; si falla a mitad
  de camino, queda sin `processed_at` para que el reintento lo complete.
- Paddle envía el `user_id` en `custom_data`; Mercado Pago lo envía en
  `external_reference`. El servidor también puede recuperar el usuario desde
  la suscripción existente.
- Para Mercado Pago, el webhook solo trae el ID: el servidor consulta
  `GET /preapproval/{id}` para conocer estado, plan y período.

Checkout local sin credenciales devuelve `503 checkout_not_configured` o
`503 paddle_not_configured` / `503 mercadopago_not_configured`. Es el
comportamiento esperado hasta cargar las claves reales.

Si el usuario ya tiene un plan pago activo, el checkout devuelve
`409 already_subscribed`. Para cambiar de plan debe cancelar la renovación y
esperar el final del período pagado, o escribir a **futbolityx@gmail.com**.

## Autenticación

Hay dos formas de autenticarse:

1. **Sesión de usuario** (navegador): cookie `HttpOnly` creada por el magic
   link. Se usa para el panel de cuenta, el checkout y la app.
2. **API key** (server-to-server): header `X-API-Key`. Se usa para
   integraciones, workers o clientes propios. No consume la cuota del plan.

`/v1/analyze` y `/v1/live/*` aceptan ambas. Las rutas de cuenta y checkout
solo aceptan sesión. `/v1/whoami` solo acepta API key.

```http
X-API-Key: <key>
```

`API_KEYS` es un JSON con una o más entradas:

```json
[
  {
    "id": "web",
    "keyHash": "<sha256>",
    "scopes": ["analyze", "live"],
    "ips": []
  }
]
```

- `keyHash` es el SHA-256 de la key. En desarrollo también se acepta `key` en
  texto plano, pero no se recomienda en producción.
- `scopes`: `analyze`, `live` o `*`.
- `ips`: allowlist opcional de IPs/CIDR **para esa key**.

Generar una key:

```powershell
npm run hash-key
```

### IP allowlist

Hay dos niveles:

1. `IP_ALLOWLIST` global (vacía por defecto).
2. `ips` por cada API key.

Sirve para llamadas **server-to-server** (por ejemplo, un webhook o un worker).
No sirve para restringir a los usuarios finales: cada usuario navega desde su
propia IP, que cambia con frecuencia (móvil, IPv6, NAT). Para usuarios hay que
usar sesiones y entitlements.

### Rate limiting

- Global: `RATE_LIMIT_MAX` por minuto y por IP.
- `/v1/analyze`: 20 requests por minuto.
- `/v1/live/*`: 40 requests por minuto.

En Vercel el límite es **best-effort por instancia** (memoria). Para producción
con tráfico real, reemplazarlo por Upstash Redis, Vercel KV o un limitador
distribuido. El rate limiting de Fastify sí funciona bien en Docker/VPS con una
sola instancia.

En producción con varias instancias, reemplazar el límite en memoria por Redis.

## Variables de entorno

Ver [`.env.example`](.env.example). Las principales:

| Variable | Default | Uso |
| --- | --- | --- |
| `PORT` | `8787` | Puerto. |
| `HOST` | `0.0.0.0` | Interfaz. |
| `CORS_ORIGINS` | GitHub Pages + localhost | Orígenes permitidos. |
| `API_KEYS` | vacío | Keys y scopes. |
| `IP_ALLOWLIST` | vacío | Allowlist global opcional. |
| `TRUST_PROXY` | `false` | Confiar en `X-Forwarded-For` del proxy. |
| `BODY_LIMIT_BYTES` | `4500000` | Tope del cuerpo (límite de Vercel). |
| `ANALYZE_MAX_MATCHES` | `50000` | Tope de partidos. |
| `UPSTREAM_TIMEOUT_MS` | `8000` | Timeout de datos en vivo. |
| `APP_URL` | `http://localhost:8766` | URL pública del frontend. |
| `API_PUBLIC_URL` | vacío | URL pública del backend (para magic links). |
| `DATABASE_URL` | vacío | PostgreSQL de cuentas y suscripciones. |
| `SESSION_COOKIE_NAME` | `futbolityx_session` | Nombre de la cookie de sesión. |
| `SESSION_DAYS` | `30` | Duración de la sesión. |
| `MAGIC_LINK_MINUTES` | `15` | Vigencia del magic link. |
| `AUTH_DEV_MODE` | `false` | Devuelve el magic link en la respuesta (solo dev). |
| `RESEND_API_KEY` | vacío | Envío de emails con Resend. |
| `EMAIL_FROM` | vacío | Remitente verificado en Resend. |
| `BILLING_RETURN_URL` | `APP_URL` | Retorno después del pago. |
| `PRICING_STATUS` | `proposed` | `approved` habilita el checkout. |
| `PADDLE_ENVIRONMENT` | `production` | `sandbox` usa `sandbox-api.paddle.com`. |
| `PADDLE_API_BASE` | vacío | Override de la URL de la API de Paddle. |
| `PADDLE_API_KEY` | vacío | API key de Paddle Billing. |
| `PADDLE_WEBHOOK_SECRET` | vacío | Secreto de webhooks de Paddle. |
| `MP_API_BASE` | vacío | Override de la URL de la API de Mercado Pago. |
| `MP_ACCESS_TOKEN` | vacío | Access token de Mercado Pago. |
| `MP_WEBHOOK_SECRET` | vacío | Secreto de webhooks de Mercado Pago. |

## Docker

El motor vive en `js/stats.js`, así que el build se hace desde la raíz del repo:

```powershell
docker build -f server/Dockerfile -t futbolityx-api .
docker run --env-file server/.env -p 8787:8787 futbolityx-api
```

## Deploy en Vercel

Guía paso a paso, variables y checklist de cobros:
[`docs/deploy-vercel.md`](../docs/deploy-vercel.md).

El repo está preparado para un solo proyecto de Vercel:

- El frontend se sirve como sitio estático desde la raíz.
- Las funciones de `api/` se despliegan como Vercel Functions.
- `vercel.json` configura región `gru1`, memoria y `includeFiles` para
  `js/stats.js`.
- `.vercelignore` excluye `data/` (94 MB) para no superar el límite de archivos
  estáticos del plan Hobby. En Vercel, `index.html` apunta
  `FUTBOLITYX_DATA_BASE` a GitHub Pages, que ya sirve los datos con CORS.
  Si usás Vercel Pro, podés quitar `data` de `.vercelignore` y borrar ese bloque
  de `index.html`.

Variables mínimas en Vercel:

```env
NODE_ENV=production
APP_URL=https://tu-proyecto.vercel.app
API_PUBLIC_URL=https://tu-proyecto.vercel.app
CORS_ORIGINS=https://tu-proyecto.vercel.app,https://francotomas44-del.github.io
API_KEYS=[{"id":"web","keyHash":"<sha256>","scopes":["analyze","live"],"ips":[]}]
ANALYZE_MAX_MATCHES=20000
DATABASE_URL=postgresql://...
SESSION_COOKIE_NAME=futbolityx_session
SESSION_DAYS=30
MAGIC_LINK_MINUTES=15
RESEND_API_KEY=re_...
EMAIL_FROM=Futbolityx <no-reply@futbolityx.com>
```

Variables de cobro (cuando estén aprobadas):

```env
PRICING_STATUS=approved
PADDLE_ENVIRONMENT=sandbox
PADDLE_API_BASE=
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
PLAN_PADDLE_PRO_MONTHLY=pri_...
PLAN_PADDLE_PRO_YEARLY=pri_...
PLAN_PADDLE_ELITE_MONTHLY=pri_...
PLAN_PADDLE_ELITE_YEARLY=pri_...
MP_ACCESS_TOKEN=...
MP_WEBHOOK_SECRET=...
PLAN_MP_PRO_MONTHLY=...
PLAN_MP_PRO_YEARLY=...
PLAN_MP_ELITE_MONTHLY=...
PLAN_MP_ELITE_YEARLY=...
```

Notas:

- Vercel limita el cuerpo de las funciones (4.5 MB en Hobby). Mantené
  `ANALYZE_MAX_MATCHES` bajo y enviá solo los partidos necesarios.
- El rate limiting en memoria no se comparte entre instancias; para producción
  real, usar Upstash Redis o Vercel KV.
- El rate limiting de los magic links y del checkout también es por instancia.
  Si hay abuso, moverlo a Redis.
- Configurar los webhooks apuntando a
  `https://tu-proyecto.vercel.app/api/webhooks/paddle` y
  `https://tu-proyecto.vercel.app/api/webhooks/mercadopago`.
- El health check es `/api/health`.
- Si el frontend y el backend están en dominios distintos, la cookie de sesión
  necesita `SameSite=None; Secure` y CORS con credenciales. La configuración
  actual usa `SameSite=Lax`, pensada para el mismo dominio o subdominios.

### Docker / VPS

El servidor Fastify sigue disponible para Docker o VPS:

```powershell
docker build -f server/Dockerfile -t futbolityx-api .
docker run --env-file server/.env -p 8787:8787 futbolityx-api
```

Checklist general:

1. Configurar `API_KEYS` con hashes, no con keys en texto plano.
2. Configurar `CORS_ORIGINS` con el dominio real.
3. Si hay proxy, `TRUST_PROXY=true` **solo** si el proxy agrega
   `X-Forwarded-For` de forma confiable.
4. HTTPS obligatorio.
5. Health check: `/api/health` en Vercel o `/v1/health` en Fastify.
6. Rotar keys si se filtran.

## Migración gradual del frontend

`js/api.js` expone `window.AD.api` con:

```js
AD.api.isConfigured();
AD.api.health();
AD.api.meta();
AD.api.plans();
AD.api.analyze(payload);
AD.api.liveScoreboard("arg.1", "2026-11-13");
AD.api.liveSummary("arg.1", "123456");
AD.api.requestMagicLink("vos@email.com");
AD.api.account();
AD.api.checkout({ plan: "pro", interval: "month", provider: "mercadopago" });
AD.api.cancelSubscription();
AD.api.logout();
```

`js/account.js` usa esas funciones para el modal de cuenta, el plan actual, la
cuota y el selector Free/Pro/Elite.

En Vercel, el frontend y el backend comparten el mismo proyecto. `index.html`
detecta el dominio y configura `base` con el mismo origen; `vercel.json` reescribe
`/v1/:path*` a `/api/:path*`, así que el cliente puede seguir usando rutas `/v1`.
En local usa `http://localhost:8787`.

Para activarlo manualmente, definir antes de cargar `js/api.js`:

```html
<script>
  window.FUTBOLITYX_API = {
    base: "https://api.futbolityx.com",
    key: "futbolityx_web_...", // opcional, solo server-to-server
    timeoutMs: 15000
  };
</script>
```

Mientras no esté configurado, la app sigue usando el motor local y el modal de
cuenta muestra un aviso.

## Próximos pasos

1. Aprobar los precios definitivos y cargar los price/plan IDs de Paddle y
   Mercado Pago.
2. Crear la base PostgreSQL, ejecutar `sql/001_init.sql` y configurar
   `DATABASE_URL`.
3. Configurar Resend (`RESEND_API_KEY`, `EMAIL_FROM`) y verificar el dominio.
4. Desplegar en Vercel y probar magic link, checkout y webhooks en sandbox.
5. Mover el rate limiting a Redis/Upstash si hay más de una instancia.
6. Agregar alertas de fallas de webhook y conciliación de pagos.
7. Evaluar migrar el cálculo de análisis completamente al servidor (hoy el
   frontend sigue calculando localmente).

## Seguridad

Leer [`SECURITY.md`](SECURITY.md) antes de exponer el servicio a internet.
