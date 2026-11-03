# Base histórica integrada

El sistema ya **no requiere importar datos a mano**: viene con una base de resultados
históricos reales, descargada de fuentes libres y confiables, lista para analizar.

## Fuentes

- **[la base pública](https://github.com/<repo>)** — datos **libres / de dominio público**
  (licencia CC0), sin API key, en JSON estático. Se descargan y quedan **locales** en
  `data/base/`, por lo que la app **no consulta internet en tiempo de uso**.
  Reproducido por `scripts/build-dataset.ps1`.
- **la API — historia anterior** (`source: "history"`) — tramo que
  la base pública no publica (divisiones antiguas y temporadas previas a 2010-11),
  descargado de la API pública de **la API** por `scripts/build-history.ps1` y
  guardado en `data/history/<código>.json`.
- **la base pública — competiciones nuevas** (`source: "base-extra"`) — ligas y
  copas que la base no traía (África, MLS, CONCACAF, Sudamérica, Asia…), descargadas
  de la base pública por `scripts/build-base-extra.ps1` y guardadas en
  `data/base-extra/<slug>.json`.
- **la API "al día"** (`source: "season"`) — temporada en curso y tramo reciente de
  las 21 primeras divisiones/competiciones que la base ya tiene
  (`scripts/build-season.ps1`, `data/season/<código>.json`).
- **la API — Liga Profesional Argentina** (`source: "arg"`) — historial 2001 y
  2003–2026 por torneo (`scripts/build-arg.ps1`, `data/arg/<año>.json`).
- **la API — CONMEBOL Sudamericana** (`source: "sudamericana"`) — la Sudamericana no
  está en la base pública, así que se baja de **la API** por
  `scripts/build-sudamericana.ps1` (temporadas **2005–2026**) y se guarda en
  `data/sudamericana/conmebol.sudamericana.json`. Incluye los partidos jugados
  (`STATUS_FULL_TIME` + `STATUS_FINAL_PEN`) **y los cruces por jugar** sin marcador, que
  alimentan la portada **"Hoy"**. Su entrada del manifiesto lleva **`rev`** (hash del
  contenido) porque cambia con el tiempo (suma resultados y cruces por jugar).
- **la API — CONMEBOL Libertadores** (`source: "libertadores"`) — también de la API
  pública de **la API** por `scripts/build-libertadores.ps1` (temporadas **2005–2026**),
  guardada en `data/libertadores/conmebol.libertadores.json`. Reemplaza a la antigua
  entrada `sa-lib` de `base-extra`: ese archivo juntaba los `*_copal.txt`
  (Libertadores) **y** los `*_copas.txt` (Sudamericana) del repositorio la base pública bajo un
  mismo código "Copa Libertadores", con lo que el historial quedaba contaminado con partidos
  de la Sudamericana. Igual que la Sudamericana, incluye jugados (`STATUS_FULL_TIME` +
  `STATUS_FINAL_PEN`) y cruces por jugar, y su entrada lleva **`rev`**.
- **la API — Sudamérica doméstica** (`source: "southamerica"`) — primeras divisiones de
  **Chile** (`chi.1`), **Uruguay** (`uru.1`), **Perú** (`per.1`), **Bolivia** (`bol.1`) y
  **Venezuela** (`ven.1`), que la base no traía: sus clubes aparecían **solo** en las copas
  CONMEBOL. Se bajan de la API pública de **la API** por `scripts/build-southamerica.ps1`
  (temporadas **2005–2026**) a `data/southamerica/<código>.json` (~30.600 partidos).
  Reutiliza los alias de las copas para no partir clubes, incluye los jugados
  (`STATUS_FULL_TIME` + `STATUS_FINAL_PEN`) **y los cruces por jugar**, y su entrada lleva
  **`rev`**.
- **la API — copas y selecciones nuevas** (`source: "cups"`) — cuatro competiciones que
  la base no traía: **Copa América** (`conmebol.america`, 2001 → hoy), **Eliminatorias
  Mundial CONMEBOL** (`fifa.worldq.conmebol`, 2003 → hoy), **UEFA Europa League**
  (`uefa.europa`, 2009 → hoy) y **UEFA Conference League** (`uefa.europa.conf`, 2021 → hoy).
  De la API pública de **la API** por `scripts/build-cups.ps1`, guardadas en
  `data/cups/<código>.json` (~2,2 MB). Incluyen los jugados (`STATUS_FULL_TIME` +
  `STATUS_FINAL_PEN`) **y los cruces por jugar** (alimentan la portada "Hoy"), y su entrada
  lleva **`rev`**. De las dos copas europeas se guarda **solo la fase principal**: las rondas
  previas (`qualifying`, `preliminary`, `play-off round`, `play-offs`, `first round`) se
  descartan con una lista negra sobre `season.slug` (`scripts/cups.json`, campo
  `phaseExclude`). Las dos competiciones de selecciones usan un mapa de alias propio
  (vacío salvo `Venezuela`; ver más abajo).

## Cobertura (313 archivos · ~93 MB · 9 fuentes + tarjetas)

Reparto de partidos por fuente (crudo, antes de deduplicar entre fuentes):

| Fuente (`source`) | Archivos | Partidos |
|---|---|---|
| `base` | 203 | 52.015 |
| `arg` | 25 | 9.506 |
| `season` | 21 | 2.790 |
| `history` | 21 | 65.276 |
| `base-extra` | 32 | 27.582 |
| `sudamericana` | 1 | 2.296 |
| `libertadores` | 1 | 3.200 |
| `southamerica` | 5 | 30.630 |
| `cups` | 4 | 3.917 |
| **Total** | **313** | **197.212** |

Además, **22 archivos de tarjetas** (`source: "cards"`, `data/cards/`, ≈1,7 MB) **no agregan
partidos**: enriquecen los ya existentes con **amarillas, rojas y córners** por equipo (≈60.600
partidos cubiertos). Se unen por `id` de la API al cargar. Ver [`tarjetas.md`](tarjetas.md).

Tras **deduplicar** los solapamientos entre fuentes y **fusionar variantes de nombre**,
la app queda con **192.202 partidos**, **2.089 equipos/selecciones** y
**110 competiciones** (los 3.917 crudos de `cups` entran como 3.754 jugados; los
**162 por jugar** —72 de la Europa League y 90 de la Conference— los carga aparte
`AD.dataset.loadUpcoming` para la portada "Hoy", y un partido se descarta por repetido
dentro de la propia fuente).

**Variantes de nombre.** Las fuentes escriben al mismo club de dos formas
distintas (`Flamengo RJ` / `CR Flamengo`, `Botafogo RJ` / `Botafogo FR`, `Atlético Mineiro` /
`CA Mineiro`, …). La normalización genérica de `canonicalName()` (quita FC/SC/…) no siempre los
colapsa, así que el club quedaba partido en dos equipos. `js/store.js` incluye una tabla
curada (`TEAM_ALIAS`, 87 claves: 19 clubes brasileños y 2 sudamericanos; 6 alemanes, 5
austríacos y 36 más que cada fuente renombra u abrevia —la base pública pasó a usar el nombre
«largo» con ciudad o sufijo legal desde 2020-21, y la API añade la sigla o el país— partidos
entre su liga y las copas) y `canonicalMap()` elige como **nombre superviviente** el que no lleva paréntesis y,
a igualdad, el del club con **más partidos**. El alias se aplica también sin el sufijo
`(PAÍS)`, de modo que `AFC Ajax (NED)` y `AFC Ajax` caen en el mismo club. Los clubes que
la API nombra distinto según la temporada dentro de una misma liga se corrigen en el origen,
con `scripts/southamerica-team-map.json` (p. ej. `Unión Wanderers` 2020 = `Santiago
Wanderers (CHI)`, `Melipilla` 2021 = `Deportes Melipilla`, `El Vigia` = `Atlético Vigía`).

**Alias de las copas nuevas (`scripts/cups-team-map.json`).** `cups` reutiliza
`scripts/team-alias.json` y añade un mapa propio con **17 entradas** escritas con el
nombre **exacto** de la base: variantes que el resolutor difuso no acertaba (`Apoel Nicosia`
→ `APOEL Nikosia (CYP)`, `Dynamo Kyiv` → `Dinamo Kiev (UKR)`, `Sparta Prague` → `AC Sparta
Praha (CZE)`, `CFR Cluj-Napoca` → `CFR Cluj (ROU)`, …) y **dos falsos positivos** de la regla
de prefijos que apuntaban a un club equivocado: `Lillestrom` → `Lille OSC` y `Riga FC` →
`Skonto Riga` (quedan como `Lillestrøm` y `Riga FC`). El índice de resolución es el
**ampliado** (incluye `history` y `season`), así que los clubes que ya existían con
otro nombre **no** se recrean.

**Colisiones club / selección.** Cuando un club y una selección nacional comparten
exactamente el mismo nombre, la base los fusionaba en un solo equipo. Se corrigieron en el
origen: la API llamaba `Austria` al **FK Austria Wien** (`data/season/at.1.json`) y
`Peru` al **AC Perugia** de la Serie A 2000-2004 (`data/history/it.1.json`); y el
resolutor de nombres degradaba el club zimbabuense **Scottland FC** (así, con dos «t») a
`Scotland` (`data/base-extra/af-zw.json`). Los alias de origen
(`scripts/team-alias.json`, `scripts/base-extra-team-map.json`) evitan que
vuelvan a ocurrir en las próximas descargas.

**Mapeos erróneos del resolutor la API (pendiente).** El resolutor de la API
(`scripts/feed-common.ps1`) empareja la similitud por tokens con una regla de «cobertura» que
da falsos positivos cuando el nombre de entrada empieza con un token corto del candidato:
`Portsmouth` → `Shanghai Port FC`, `Portuguesa` → `Shanghai Port FC`, `América (MG)` →
`CF América`, `Platanias` → `Gimnasia de La Plata`, `Tigres FC` → `Tigre`,
`Desportivo Aves` → `Deportivo Alavés` y `Atlético Minero` → `Atlético Mineiro`. Deja
partidos de una liga bajo un club de otro país. Se corrigió a mano el caso más claro
(`data/history/pt.1.json`: los 34 partidos de `Deportivo Alavés` en la Primeira Liga
2017-18 pasaron a `CD Aves`), pero el arreglo de fondo es endurecer la regla de cobertura y
**reconstruir** `history`/`southamerica`. Aparte existe una clase de **homónimos
entre países** que la app fusiona por nombre (`CD Nacional` Portugal/Uruguay/Paraguay,
`River Plate` Argentina/Uruguay, `Llaneros` Colombia/Venezuela): requiere desambiguar en el
origen con el sufijo `(PAÍS)`.

Al sumar `cups` aparecieron **tres casos más**, ya tapados con alias: `Lillestrom` →
`Lille OSC` y `Riga FC` → `Skonto Riga` (los dos falsos positivos, arriba) y la **selección
`Venezuela`** → el club `Atlético Venezuela` — la base **no tenía** la selección (nunca jugó
un Mundial) y su único equipo venezolano era ese club de liga, al que el resolutor difuso
asignaba los 35 partidos de la Copa América. Las competiciones de selecciones usan ahora su
propio mapa (`$aliasNations` en `scripts/build-cups.ps1`: `venezuela` → `Venezuela`).

**Marcadores inválidos (la API).** Cuando la API no tiene el resultado de un partido
devuelve `score: -1` para el equipo sin dato (no `null`). Los generadores solo
comprobaban que el marcador fuera un entero, así que el `-1` pasaba y dejaba
partidos con goles negativos (dos casos: `Universidad de Concepción (CHI)` y
`Once Caldas`). Se endurecieron los seis generadores de la API
(los generadores de la fuente) para descartar `score < 0`, se limpiaron los archivos
afectados y el almacén (`store.importBulk`/`importMatches` e `init`) descarta
cualquier partido con marcador negativo, de modo que instalaciones ya guardadas
se sanean al cargar.

**Procedencia por partido.** Cada partido guarda su `source`. Antes el cargador
etiquetaba todos los partidos como `base`; ahora cada fila conserva la
`source` de su archivo del manifiesto (`history`, `season`,
`southamerica`, `sudamericana`, `libertadores`, `cups`,
`base-extra`, `arg`, etc.).

Cobertura por tipo:

- **Selecciones nacionales**
  - **Copa Mundial FIFA** — todas las ediciones (1930 → 2026).
  - **Eurocopa UEFA** — ediciones disponibles (2020, 2024, 2028).
  - **Copa América** (2001 → 2024) y **Eliminatorias Mundial CONMEBOL** (2003 → 2025),
    ambas de la API (`cups`).
- **Clubes (internacional)**
  - **UEFA Champions League**, **CAF Champions League** y **CONCACAF Champions Cup**.
  - **Copa Libertadores** y **CONMEBOL Sudamericana** (ambas de la API, 2005 → 2026).
  - **UEFA Europa League** (2009 → 2026) y **UEFA Conference League** (2021 → 2026), de
    la API (`cups`), **solo la fase principal** (sin rondas previas).
- **Ligas nacionales — primera división**
  - **Europa** (2010-11 → 2026-27, según disponibilidad): Inglaterra, España, Alemania,
    Italia, Francia, Países Bajos, Portugal, Austria, Bélgica, Suiza, Grecia, Turquía,
    Escocia y Rusia.
  - **Resto del mundo** (nuevas, `base-extra`): **MLS** (EE. UU.), Brasil (Serie A
    y B), Colombia, Ecuador, Paraguay, Costa Rica, Kazajistán, Israel, Arabia Saudita,
    **Nigeria, Ghana, Kenia, Malaui, Ruanda, Senegal, Tanzania, Uganda, Zambia,
    Zimbabue y Sudáfrica**, más México, China, Japón, Australia, Argelia, Egipto y Marruecos.
- **Historia anterior (la API, `history`)** — ligas europeas y americanas en años
  previos a 2010-11, ancladas al primer partido que ya tiene cada liga.
- **Copas nacionales** — FA Cup (Inglaterra), Copa do Brasil y copas de Austria.

Cada dato es real; nada se inventa.

## Cómo se carga

1. **Automático:** la **primera vez** que abrís la app con la base vacía, se cargan los
   archivos solos (verás una barra de progreso).
2. **Manual:** botón **«Cargar base»** en la barra superior (o el botón del primer uso,
   «Cargar partidos y empezar»). Reemplaza los datos actuales (pide confirmación).
3. Una vez cargada, se guarda **en el navegador (IndexedDB)** y persiste entre sesiones.
4. **Puesta al día:** al abrir, si el manifiesto trae archivos que esa instalación no tiene
   (una competición o temporada agregada después, o datos corregidos con otra `rev`), la app
   los descarga y fusiona **sin borrar nada** y sin duplicar partidos: se apoya en el registro
   `futbolityx:base:files` (`localStorage`) y en la clave fecha + equipos canónicos. También se
   puede forzar desde **Datos → Buscar datos nuevos**.

> Usá siempre `http://localhost:8766/` (ver `docs/persistencia.md`). El almacenamiento del
> navegador depende del **origen**: `file://`, `localhost` y `127.0.0.1` guardan por separado.

## Cómo regenerar / actualizar la base

```powershell
# 1) Base pública (resto del mundo)
powershell -ExecutionPolicy Bypass -File scripts\build-dataset.ps1
# 2) Historia previa (la API) para cada liga
powershell -ExecutionPolicy Bypass -File scripts\build-history.ps1
# 3) Competiciones nuevas de la base pública (África, MLS, CONCACAF, Sudamérica, Asia…)
powershell -ExecutionPolicy Bypass -File scripts\build-base-extra.ps1
# 4) Temporada en curso de las ligas ya cubiertas (la API)
powershell -ExecutionPolicy Bypass -File scripts\build-season.ps1
# 5) Tarjetas (amarillas/rojas) y córners por partido (la API)
powershell -ExecutionPolicy Bypass -File scripts\build-cards.ps1
# 6) CONMEBOL Sudamericana (la API; la base pública no la publica)
powershell -ExecutionPolicy Bypass -File scripts\build-sudamericana.ps1
# 7) CONMEBOL Libertadores (la API; reemplaza la antigua entrada sa-lib de base-extra)
powershell -ExecutionPolicy Bypass -File scripts\build-libertadores.ps1
# 8) Sudamérica doméstica: Chile, Uruguay, Perú, Bolivia y Venezuela (la API)
powershell -ExecutionPolicy Bypass -File scripts\build-southamerica.ps1
# 9) Copas y selecciones nuevas: Copa América, Eliminatorias CONMEBOL, Europa y Conference (la API)
powershell -ExecutionPolicy Bypass -File scripts\build-cups.ps1
```

Cada script descarga su fuente, escribe sus archivos bajo `data/<source>/` y (re)genera
`data/manifest.json`, que es lo que lee la app (`js/dataset.js`). Es reproducible: la
fuente queda identificada en cada paso. `scripts/base-extra.json` lista las
competiciones del paso 3, `scripts/leagues.json` las del paso 2 y
`scripts/cups.json` las del paso 9.

> Solo una corrida a la vez: los pasos 2, 3, 6, 7, 8 y 9 reescriben `data/manifest.json`;
> correrlos en paralelo deja el manifiesto inconsistente.

## Límites (honestidad estadística)

- Las ligas domésticas de la base pública llegan hasta **2010-11**; la API cubre hacia atrás
  (`history`) y hacia adelante (`season`), pero **la API no tiene** Hungría,
  Argelia, Egipto ni Marruecos, y Chequia devuelve 0 partidos.
- **No** hay alineaciones, árbitros ni cuotas en esta base (eso requeriría otras fuentes:
  ver `docs/apis-datos.md`).
- Los nombres de equipos provienen de las fuentes y **pueden variar** (p. ej. un club con
  dos grafías). La app **fusiona** las variantes que comparten nombre canónico
  (`unifyTeams`) y **descarta** los partidos repetidos entre fuentes.
- Los datos son de **resultados** (marcadores), no de eventos minuto a minuto.

## Correcciones de nombres (fantasmas)

Un mismo nombre puede designar a dos clubes según la temporada. Cuando el importador lo
resolvió mal, quedaron **partidos fantasma** (el rival correcto, pero el club equivocado).
Los archivos ya están corregidos en origen y `rev` fuerza su reimportación; además
`AD.store.repairPhantoms()` retira los fantasmas en instalaciones viejas. La regla es
segura: solo borra una fila si en **la misma fecha** el club correcto jugó contra **el mismo
rival** en la misma competición (imposible para dos clubes de la misma liga). Compara por
**nombre canónico** (la misma agrupación que `unifyTeams`), no por id: así también funciona
durante un sync, cuando el import crea equipos "variante" que todavía no se fusionaron.
Es idempotente y corre al iniciar y al terminar cada puesta al día.

| Temporadas | Fuente decía | Es en realidad | Se guardó como |
|---|---|---|---|
| 2006, 2007 y 2018 (Série A) | `CA Paranaense` | **Paraná** (la API id 3453) | Athletico Paranaense |
| 2019 y 2020 (Série B) | `CA Paranaense` / `Paraná Clube` | **Paraná** | Athletico Paranaense |
| 2023 y 2024 (Série A) | `CA Paranaense` | **Athletico Paranaense** (nombre oficial) | correcto (alias) |
| 2000-2011 (LaLiga) | `Deportivo` | **Deportivo La Coruña** (la API id 90) | el equipo de Alavés (Vitoria) |

Verificación: se comparó **cada** fila con el `id` de evento de la API (94/94 de Paraná y
398/398 de Deportivo). `CA Paranaense` en 2023/2024 sigue siendo Athletico, por eso el
alias de la app (`js/store.js`) se mantiene y la corrección es por año en los datos.
Los builders (`scripts/team-alias.json` y `scripts/base-extra-team-map.json`)
incorporan la resolución para que una regeneración no reintroduzca el error.

Verificado también el **camino de actualización**: se cargó una instalación nueva con la
base anterior al arreglo (192.193 partidos, 879/603/198/12) y luego se sirvió la base nueva;
el sync retiró los 557 fantasmas en la misma pasada y quedó en 192.202 partidos, 488 de
Alavés, 437 de Athletico, 603 de Deportivo y 182 de Paraná, sin recargar.

