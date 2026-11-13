# Backend de Futbolityx

API propia para mover las funciones importantes fuera del navegador y preparar
el terreno para cuentas y suscripciones.

Estado actual:

- El frontend **sigue funcionando solo**, sin backend.
- `server/` expone el **motor de análisis** y un **proxy de datos en vivo**.
- La misma lógica corre como servidor Fastify local/Docker y como funciones
  serverless en **Vercel** (`api/`).
- La app puede empezar a usar el backend de forma gradual mediante `js/api.js`.
- El catálogo ya tiene **Free, Pro y Elite** y los precios propuestos.
- Todavía **no** hay usuarios, pagos ni suscripciones activas. La integración
  de **Paddle** y **Mercado Pago** está preparada a nivel de configuración y
  verificación de firmas; falta conectar la base de datos y los checkouts.

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
| `GET` | `/v1/plans` | pública | Catálogo propuesto de planes (todavía sin cobro). |
| `GET` | `/v1/whoami` | `X-API-Key` | Devuelve key, scopes e IP vista por el servidor. |
| `POST` | `/v1/analyze` | `X-API-Key` + scope `analyze` | Motor de análisis completo. |
| `GET` | `/v1/live/scoreboard` | `X-API-Key` + scope `live` | Partidos del día por liga. |
| `GET` | `/v1/live/summary` | `X-API-Key` + scope `live` | Ficha en vivo de un partido. |

En Vercel las mismas funciones se publican como `/api/...`:

| Fastify | Vercel |
| --- | --- |
| `/v1/health` | `/api/health` |
| `/v1/meta` | `/api/meta` |
| `/v1/plans` | `/api/plans` |
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

Límites por defecto: 50.000 partidos, 20.000 equipos y 8 MB de cuerpo.

### Datos en vivo

```powershell
$headers = @{ "X-API-Key" = "tu_key" }
Invoke-RestMethod "http://127.0.0.1:8787/v1/live/scoreboard?league=arg.1&date=2026-11-13" -Headers $headers
Invoke-RestMethod "http://127.0.0.1:8787/v1/live/summary?league=arg.1&event=123456" -Headers $headers
```

El backend valida la liga contra una allowlist, valida la fecha/evento, aplica
timeout, cachea la respuesta y devuelve `cached`/`stale`.

## Planes (propuesta)

`GET /v1/plans` devuelve el catálogo con `pricingStatus: "proposed"` y
`billing: "not_available"`. La propuesta es **Free + Pro + Elite**:

- **Free:** análisis básico y límites diarios.
- **Pro:** todas las herramientas, datos en vivo y exportación.
- **Elite:** alertas, modelos configurables, API y soporte prioritario.

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

El esquema de base de datos para cuentas y suscripciones está en
[`sql/001_init.sql`](sql/001_init.sql), todavía sin conectar.

### Paddle y Mercado Pago

- **Paddle** se usa para pagos internacionales en USD. Los precios se crean en
  el dashboard de Paddle y se referencian con `pri_...`.
- **Mercado Pago** se usa para ARS. Las suscripciones se crean como
  `preapproval_plan` y se referencian con su ID.
- Los webhooks se verifican con firma HMAC:
  - Paddle: `Paddle-Signature` (`ts` + `h1`).
  - Mercado Pago: `x-signature` (`ts` + `v1`).
- Los módulos están en `src/lib/payments/`. Falta persistir los eventos y
  actualizar `subscriptions` cuando se conecte la base.

## Autenticación

Cada request protegida lleva:

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
| `ANALYZE_MAX_MATCHES` | `50000` | Tope de partidos. |
| `UPSTREAM_TIMEOUT_MS` | `8000` | Timeout de datos en vivo. |
| `APP_URL` | `http://localhost:8766` | URL pública del frontend. |
| `PADDLE_API_KEY` | vacío | API key de Paddle Billing. |
| `PADDLE_WEBHOOK_SECRET` | vacío | Secreto de webhooks de Paddle. |
| `MP_ACCESS_TOKEN` | vacío | Access token de Mercado Pago. |
| `MP_WEBHOOK_SECRET` | vacío | Secreto de webhooks de Mercado Pago. |

## Docker

El motor vive en `js/stats.js`, así que el build se hace desde la raíz del repo:

```powershell
docker build -f server/Dockerfile -t futbolityx-api .
docker run --env-file server/.env -p 8787:8787 futbolityx-api
```

## Deploy en Vercel

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
API_KEYS=[{"id":"web","keyHash":"<sha256>","scopes":["analyze","live"],"ips":[]}]
CORS_ORIGINS=https://tu-proyecto.vercel.app,https://francotomas44-del.github.io
ANALYZE_MAX_MATCHES=20000
```

Notas:

- Vercel limita el cuerpo de las funciones (4.5 MB en Hobby). Mantené
  `ANALYZE_MAX_MATCHES` bajo y enviá solo los partidos necesarios.
- El rate limiting en memoria no se comparte entre instancias; para producción
  real, usar Upstash Redis o Vercel KV.
- El health check es `/api/health`.

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
AD.api.analyze(payload);
AD.api.liveScoreboard("arg.1", "2026-11-13");
AD.api.liveSummary("arg.1", "123456");
```

Para activarlo, definir antes de cargar `js/api.js`:

```html
<script>
  window.FUTBOLITYX_API = {
    base: "https://api.futbolityx.com",
    key: "futbolityx_web_...",
    timeoutMs: 15000
  };
</script>
```

Mientras no esté configurado, la app sigue usando el motor local.

## Próximos pasos

1. Mover la base de datos al servidor (hoy `/v1/analyze` recibe los partidos).
2. Cuentas de usuario (email magic link u OAuth) y sesiones.
3. Tabla de suscripciones/entitlements y verificación en cada endpoint premium.
4. Integración de pagos (Mercado Pago para ARS; Paddle para USD).
5. Webhooks firmados para activar/renovar/cancelar suscripciones.
6. Panel de cuenta: plan, renovación, cancelación y comprobantes.

## Seguridad

Leer [`SECURITY.md`](SECURITY.md) antes de exponer el servicio a internet.
