# Backend de Futbolityx

API propia para mover las funciones importantes fuera del navegador y preparar
el terreno para cuentas y suscripciones.

Estado actual:

- El frontend **sigue funcionando solo**, sin backend.
- `server/` ya expone el **motor de análisis** y un **proxy de datos en vivo**.
- La app puede empezar a usar el backend de forma gradual mediante `js/api.js`.
- Todavía **no** hay usuarios, pagos ni suscripciones. Eso se agrega en la
  siguiente etapa.

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
`billing: "not_available"`. Los precios de Pro se pueden cambiar por entorno:

```env
PLAN_PRO_ARS_MONTHLY=6900
PLAN_PRO_ARS_YEARLY=59000
PLAN_PRO_USD_MONTHLY=9
```

La propuesta es **Free + Pro** al lanzamiento y **Elite** más adelante. El
esquema de base de datos para cuentas y suscripciones está en
[`sql/001_init.sql`](sql/001_init.sql), todavía sin conectar.

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

## Docker

El motor vive en `js/stats.js`, así que el build se hace desde la raíz del repo:

```powershell
docker build -f server/Dockerfile -t futbolityx-api .
docker run --env-file server/.env -p 8787:8787 futbolityx-api
```

## Deploy

Opciones simples: Railway, Render, Fly.io o un VPS con Docker.

Checklist:

1. Configurar `API_KEYS` con hashes, no con keys en texto plano.
2. Configurar `CORS_ORIGINS` con el dominio real.
3. Si hay proxy, `TRUST_PROXY=true` **solo** si el proxy agrega
   `X-Forwarded-For` de forma confiable.
4. HTTPS obligatorio.
5. Health check: `/v1/health`.
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
4. Integración de pagos (Mercado Pago para ARS; Stripe opcional para USD).
5. Webhooks firmados para activar/renovar/cancelar suscripciones.
6. Panel de cuenta: plan, renovación, cancelación y comprobantes.

## Seguridad

Leer [`SECURITY.md`](SECURITY.md) antes de exponer el servicio a internet.
