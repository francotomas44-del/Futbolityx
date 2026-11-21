/* v2.js — capa pública "amistosa" (portada "Hoy", modo simple/avanzado,
   compartir pronósticos y PWA). Es una capa ADITIVA: no reemplaza las vistas
   originales; se apoya en los motores existentes (AD.store, AD.stats, AD.dataset).

   Namespace: window.AD.v2 */
(function () {
  "use strict";

  window.AD = window.AD || {};

  var S = window.AD.store;
  var ST = window.AD.stats;
  var DS = window.AD.dataset;

  /* ===== Marca ==================================================
     Cambiá estas líneas y cambia en TODA la interfaz. */
  var BRAND = {
    name: "Futbolityx",
    claim: "Pronósticos de fútbol, claros y honestos",
    url: "https://francotomas44-del.github.io/Futbolityx/"
  };

  var OLD_NAME = "Futbolunaki"; // nombre anterior, para reemplazar el texto visible

  var MAX_CARDS = 30;   // cuántos próximos partidos se muestran con pronóstico
  var RECENCY = 0.35;   // énfasis en forma reciente (igual que la pestaña Análisis)

  /* ===== Preferencias de interfaz (persistidas) ================= */
  var PREF_KEY = "futbolunaki:ui";
  var prefs = { mode: "simple" };
  try {
    var rawPref = localStorage.getItem(PREF_KEY);
    if (rawPref) {
      var parsed = JSON.parse(rawPref);
      if (parsed && typeof parsed === "object") prefs = Object.assign(prefs, parsed);
    }
  } catch (e) { /* ignora */ }

  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} }

  /* ===== utilidades ============================================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pct1(x) { return String(Math.round(100 * (x || 0))); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  /* ===== Zonas horarias ========================================
     La base histórica indica la hora LOCAL del partido. Para las
     ligas cuyos equipos están en un solo país usamos la zona horaria de
     ese país (VENUE_TZ) para pasar la hora local a un instante UTC.
     Los partidos que ya traen offset explícito (ej. "20:00 UTC-4") se
     convierten con ese dato exacto. El usuario elige su país (o deja
     "Automático", que usa la zona horaria de su navegador). */
  var VENUE_TZ = {
    "en.1": "Europe/London", "sco.1": "Europe/London",
    "es.1": "Europe/Madrid", "de.1": "Europe/Berlin", "it.1": "Europe/Rome",
    "fr.1": "Europe/Paris", "nl.1": "Europe/Amsterdam", "pt.1": "Europe/Lisbon",
    "at.1": "Europe/Vienna", "be.1": "Europe/Brussels", "ch.1": "Europe/Zurich",
    "gr.1": "Europe/Athens", "tr.1": "Europe/Istanbul", "ru.1": "Europe/Moscow",
    "mx.1": "America/Mexico_City", "ar.1": "America/Argentina/Buenos_Aires",
    "br.1": "America/Sao_Paulo", "cz.1": "Europe/Prague", "hu.1": "Europe/Budapest",
    "cn.1": "Asia/Shanghai", "jp.1": "Asia/Tokyo", "au.1": "Australia/Sydney",
    "co.1": "America/Bogota", "dz.1": "Africa/Algiers", "eg.1": "Africa/Cairo",
    "ma.1": "Africa/Casablanca"
  };

  var COUNTRIES = [
    { code: "AR", name: "Argentina", flag: "🇦🇷", tz: "America/Argentina/Buenos_Aires" },
    { code: "UY", name: "Uruguay", flag: "🇺🇾", tz: "America/Montevideo" },
    { code: "CL", name: "Chile", flag: "🇨🇱", tz: "America/Santiago" },
    { code: "PY", name: "Paraguay", flag: "🇵🇾", tz: "America/Asuncion" },
    { code: "BO", name: "Bolivia", flag: "🇧🇴", tz: "America/La_Paz" },
    { code: "PE", name: "Perú", flag: "🇵🇪", tz: "America/Lima" },
    { code: "CO", name: "Colombia", flag: "🇨🇴", tz: "America/Bogota" },
    { code: "EC", name: "Ecuador", flag: "🇪🇨", tz: "America/Guayaquil" },
    { code: "VE", name: "Venezuela", flag: "🇻🇪", tz: "America/Caracas" },
    { code: "MX", name: "México", flag: "🇲🇽", tz: "America/Mexico_City" },
    { code: "US", name: "Estados Unidos (Este)", flag: "🇺🇸", tz: "America/New_York" },
    { code: "BR", name: "Brasil", flag: "🇧🇷", tz: "America/Sao_Paulo" },
    { code: "ES", name: "España", flag: "🇪🇸", tz: "Europe/Madrid" },
    { code: "PT", name: "Portugal", flag: "🇵🇹", tz: "Europe/Lisbon" },
    { code: "GB", name: "Reino Unido", flag: "🇬🇧", tz: "Europe/London" },
    { code: "FR", name: "Francia", flag: "🇫🇷", tz: "Europe/Paris" },
    { code: "DE", name: "Alemania", flag: "🇩🇪", tz: "Europe/Berlin" },
    { code: "IT", name: "Italia", flag: "🇮🇹", tz: "Europe/Rome" },
    { code: "NL", name: "Países Bajos", flag: "🇳🇱", tz: "Europe/Amsterdam" },
    { code: "BE", name: "Bélgica", flag: "🇧🇪", tz: "Europe/Brussels" },
    { code: "CH", name: "Suiza", flag: "🇨🇭", tz: "Europe/Zurich" },
    { code: "AT", name: "Austria", flag: "🇦🇹", tz: "Europe/Vienna" },
    { code: "GR", name: "Grecia", flag: "🇬🇷", tz: "Europe/Athens" },
    { code: "TR", name: "Turquía", flag: "🇹🇷", tz: "Europe/Istanbul" },
    { code: "RU", name: "Rusia", flag: "🇷🇺", tz: "Europe/Moscow" },
    { code: "CZ", name: "Chequia", flag: "🇨🇿", tz: "Europe/Prague" },
    { code: "HU", name: "Hungría", flag: "🇭🇺", tz: "Europe/Budapest" },
    { code: "JP", name: "Japón", flag: "🇯🇵", tz: "Asia/Tokyo" },
    { code: "CN", name: "China", flag: "🇨🇳", tz: "Asia/Shanghai" },
    { code: "AU", name: "Australia (Sídney)", flag: "🇦🇺", tz: "Australia/Sydney" },
    { code: "EG", name: "Egipto", flag: "🇪🇬", tz: "Africa/Cairo" },
    { code: "MA", name: "Marruecos", flag: "🇲🇦", tz: "Africa/Casablanca" },
    { code: "DZ", name: "Argelia", flag: "🇩🇿", tz: "Africa/Algiers" }
  ];

  var WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  function detectTz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; }
  }
  var detectedTz = detectTz() || "UTC";

  function countryByCode(code) {
    for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].code === code) return COUNTRIES[i];
    return null;
  }
  function currentTz() {
    var c = prefs.country ? countryByCode(prefs.country) : null;
    return c ? c.tz : detectedTz;
  }
  function tzLabel() {
    var c = prefs.country ? countryByCode(prefs.country) : null;
    return c ? c.name : detectedTz;
  }

  var dtfCache = {};
  function partsInTz(ms, tz) {
    tz = tz || currentTz();
    var f = dtfCache[tz];
    if (f === undefined) {
      try {
        f = new Intl.DateTimeFormat("en-GB", {
          timeZone: tz, hour12: false,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
      } catch (e) { f = null; }
      dtfCache[tz] = f;
    }
    if (!f) {
      var d = new Date(ms);
      return { year: String(d.getFullYear()), month: pad2(d.getMonth() + 1), day: pad2(d.getDate()),
        hour: pad2(d.getHours()), minute: pad2(d.getMinutes()), second: pad2(d.getSeconds()) };
    }
    var parts = f.formatToParts(new Date(ms));
    var o = {};
    for (var i = 0; i < parts.length; i++) if (parts[i].type !== "literal") o[parts[i].type] = parts[i].value;
    var h = parseInt(o.hour, 10); if (h === 24) h = 0;
    o.hour = pad2(h);
    return o;
  }
  function dateKeyInTz(ms, tz) {
    var p = partsInTz(ms, tz);
    return p.year + "-" + p.month + "-" + p.day;
  }
  function timeInTz(ms, tz) {
    var p = partsInTz(ms, tz);
    return p.hour + ":" + p.minute;
  }
  function tzOffsetMs(tz, ts) {
    var p = partsInTz(ts, tz);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) -
      Math.floor(ts / 1000) * 1000;
  }
  function zonedTimeToUtc(y, mo, da, hh, mm, tz) {
    var guess = Date.UTC(y, mo - 1, da, hh, mm);
    var o1 = tzOffsetMs(tz, guess);
    var ts = guess - o1;
    var o2 = tzOffsetMs(tz, ts);
    return o2 !== o1 ? guess - o2 : ts;
  }
  function gmtLabel(tz) {
    var off = Math.round(tzOffsetMs(tz || currentTz(), Date.now()) / 60000);
    var a = Math.abs(off);
    return "GMT" + (off < 0 ? "-" : "+") + pad2(Math.floor(a / 60)) + ":" + pad2(a % 60);
  }

  /* Instante (ms) del partido. exact=false => no se pudo ubicar la zona
     de la sede (se muestra la hora local tal cual, sin convertir).
     Se memoriza por partido (no depende de la zona elegida por el usuario). */
  function kickoff(f) {
    if (f && f._ko && f._kdate === f.date && f._ktime === f.time) return f._ko;
    var res = computeKickoff(f);
    if (f) { f._ko = res; f._kdate = f.date; f._ktime = f.time; }
    return res;
  }
  function computeKickoff(f) {
    var t = (f && f.time) ? String(f.time) : "";
    var m = /(\d{1,2}):(\d{2})(?:\s*UTC([+-]?\d{1,2})(?::?(\d{2}))?)?/.exec(t);
    if (!f || !f.date || !m) return { ms: null, hasTime: false };
    var ymd = f.date.split("-");
    var y = +ymd[0], mo = +ymd[1], da = +ymd[2];
    if (!y || !mo || !da) return { ms: null, hasTime: false };
    var hh = +m[1], mi = +m[2];
    if (m[3] !== undefined && m[3] !== "") {
      var oh = parseInt(m[3], 10), om = m[4] ? parseInt(m[4], 10) : 0;
      var sign = oh < 0 ? -1 : 1;
      var offMin = sign * (Math.abs(oh) * 60 + om);
      return { ms: Date.UTC(y, mo - 1, da, hh, mi) - offMin * 60000, hasTime: true, exact: true };
    }
    var venue = VENUE_TZ[f.code];
    if (venue) return { ms: zonedTimeToUtc(y, mo, da, hh, mi, venue), hasTime: true, exact: true };
    return { ms: null, hasTime: true, exact: false };
  }

  /* Etiquetas de "Hoy / Mañana / Ayer" según la zona elegida. */
  var _todayKey = null, _tomKey = null, _yesKey = null;
  function refreshDayKeys() {
    var now = Date.now();
    _todayKey = dateKeyInTz(now);
    _tomKey = dateKeyInTz(now + 86400000);
    _yesKey = dateKeyInTz(now - 86400000);
  }
  function dayLabel(dateStr) {
    if (!_todayKey) refreshDayKeys();
    if (dateStr === _todayKey) return "Hoy";
    if (dateStr === _tomKey) return "Mañana";
    if (dateStr === _yesKey) return "Ayer";
    var d = new Date(dateStr + "T12:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return WEEKDAYS[d.getDay()] + " " + d.getDate() + "/" + (d.getMonth() + 1);
  }

  /* Texto de fecha/hora del partido, ya en la zona del usuario. */
  function whenText(f) {
    var k = kickoff(f);
    if (k.ms) return dayLabel(dateKeyInTz(k.ms)) + " · " + timeInTz(k.ms);
    if (k.hasTime) return dayLabel(f.date) + " · " + f.time + " (hora local)";
    return dayLabel(f.date) + " · hora por confirmar";
  }
  /* Clave de agrupación por día (en la zona del usuario). */
  function groupKey(f) {
    var k = kickoff(f);
    return k.ms ? dateKeyInTz(k.ms) : f.date;
  }
  function slug(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $("v2-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "v2-toast";
      el.className = "v2-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-on");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-on"); }, 2600);
  }

  /* ===== Marca y modo simple/avanzado ========================== */
  function rebrandText(root) {
    if (!root) root = document.body;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var v = node.nodeValue;
      if (v && v.indexOf(OLD_NAME) !== -1) node.nodeValue = v.split(OLD_NAME).join(BRAND.name);
    });
  }

  function applyBrand() {
    try {
      document.title = BRAND.name + " — " + BRAND.claim;
      var h1 = document.querySelector(".brand h1");
      if (h1) {
        var first = h1.firstChild;
        if (first && first.nodeType === 3) first.nodeValue = BRAND.name;
        else h1.insertBefore(document.createTextNode(BRAND.name), h1.firstChild);
      }
      var sub = document.querySelector(".brand-sub");
      if (sub) sub.textContent = BRAND.claim;
      var logo = document.querySelector(".brand img");
      if (logo) logo.alt = BRAND.name;
      rebrandText(document.body);
    } catch (e) { /* ignora */ }
  }

  function isAdvanced() { return prefs.mode === "avanzado"; }

  function applyMode() {
    document.body.classList.toggle("simple", !isAdvanced());
    var btn = $("btn-mode");
    if (btn) {
      btn.textContent = isAdvanced() ? "Modo simple" : "Modo avanzado";
      btn.setAttribute("aria-pressed", isAdvanced() ? "true" : "false");
    }
  }

  function toggleMode() {
    prefs.mode = isAdvanced() ? "simple" : "avanzado";
    savePrefs();
    applyMode();
    if (!isAdvanced()) {
      var active = document.querySelector(".view.is-active");
      if (active && active.hasAttribute("data-adv")) {
        var t = document.querySelector('.tabs .tab[data-view="hoy"]');
        if (t) t.click();
      }
    }
  }

  /* ===== Liga Argentina en vivo ================================
     La base histórica de la Argentina se arma desde la fuente de datos
     (scripts/build-arg.ps1, temporadas 2001 y 2003..2026). Aquí traemos
     en vivo lo de la temporada en curso (próximos partidos para la portada
     "Hoy" y resultados ya jugados), así la portada queda al día aunque el
     paquete local sea de una fecha anterior. Si no hay internet, se usa lo
     último guardado y la portada sigue mostrando el resto (datos locales). */
  var AR_LEAGUE = "arg.1"; /* identificador de la fuente */
  var AR_CODE = "ar.1";    /* código interno (el que usan las demás capas) */
  /* Archivo de la temporada en curso (≈5 MB): partidos futuros + historial.
     Se pide en segundo plano y queda cacheado; el tablero del día (≈50 KB) es
     el que manda para el estado y el marcador en vivo. */
  var AR_SEASON_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/" + AR_LEAGUE +
    "/scoreboard?dates=" + new Date().getFullYear() + "&limit=1000";
  var AR_BOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/" + AR_LEAGUE + "/scoreboard?dates=";
  var AR_LIVE_CACHE_KEY = "futbolityx:ar-live:v2";
  var AR_LIVE_TTL = 6 * 60 * 60 * 1000; /* temporada: 6 horas */
  var AR_BOARD_TTL = 60 * 1000;         /* tablero del día: 1 minuto */

  /* Nombres de equipo de la fuente -> nombre canónico que usa la base, para que el
     historial de un club no quede partido en dos equipos. Es el mismo mapa que
     scripts/arg-team-map.json (usado al generar data/arg/*.json). Clave en
     minúsculas. */
  var TEAM_ALIAS = {
    "arsenal sarandi": "Arsenal de Sarandí",
    "belgrano (córdoba)": "Belgrano de Córdoba",
    "central córdoba (santiago del estero)": "Central Córdoba SdE",
    "colón (santa fe)": "Colón de Santa Fe",
    "estudiantes de la plata": "Estudiantes",
    "gimnasia la plata": "Gimnasia de La Plata",
    "gimnasia y esgrima (jujuy)": "Gimnasia y Esgrima de Jujuy",
    "godoy cruz antonio tomba": "Godoy Cruz",
    "instituto (córdoba)": "Instituto de Córdoba",
    "san martín (tucumán)": "San Martín de Tucumán",
    "san martín de tucumán": "San Martín de Tucumán",
    "sarmiento (junín)": "Sarmiento de Junín",
    "talleres (córdoba)": "Talleres de Córdoba",
    "unión (santa fe)": "Unión de Santa Fe"
  };
  function resolveTeamName(name) {
    var k = String(name == null ? "" : name).trim().toLowerCase();
    return TEAM_ALIAS[k] || name;
  }

  /* Nombre a mostrar en pantalla (nombre completo del club cuando la fuente
     usa una forma abreviada). No afecta la búsqueda en la base. */
  var DISPLAY_NAME = {
    "gimnasia (mendoza)": "Gimnasia y Esgrima de Mendoza"
  };
  function dispName(name) {
    if (name == null) return "";
    var k = String(name).trim().toLowerCase();
    return DISPLAY_NAME[k] || String(name);
  }

  /* Torneo argentino a partir del identificador de temporada (event.season.slug).
     Mismo criterio que scripts/build-arg.ps1, para que lo bajado en vivo
     quede en la misma competición que el historial (Apertura/Clausura/Inicial/
     Final/Superliga/Copa Diego Armando Maradona/Liga Profesional/...). */
  function seasonTail(t) {
    var m = /^(\d{4})(\d{2})$/.exec(String(t));
    return m ? m[1] + "-" + m[2] : String(t);
  }
  function cap1(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function arCompName(ev) {
    var s = ev && ev.season ? ev.season : {};
    var slug = String(s.slug || "");
    var sy = s.year != null ? String(s.year) : "";
    var m;
    if (!slug) return "Liga Profesional (Argentina)";
    if (/copa-diego-armando-maradona/.test(slug)) return "Copa Diego Armando Maradona 2020-21 (Argentina)";
    if ((m = /^superliga-argentina-(.+)$/.exec(slug))) return "Superliga " + seasonTail(m[1]) + " (Argentina)";
    if (/argentine-liga-profesional/.test(slug)) {
      var y = (/(19|20)\d{2}/.exec(slug) || [])[0] || sy;
      return "Liga Profesional " + y + " (Argentina)";
    }
    if (/^campeonato-de-1ra-division-/.test(slug)) {
      return "Campeonato de Primera División " + seasonTail(slug.slice("campeonato-de-1ra-division-".length)) + " (Argentina)";
    }
    if ((m = /^torneo-de-primera-division-((19|20)\d{2})/.exec(slug))) return "Primera División " + m[1] + " (Argentina)";
    if ((m = /^torneo-(apertura|clausura|inicial|final)-((19|20)\d{2})/.exec(slug))) return "Torneo " + cap1(m[1]) + " " + m[2] + " (Argentina)";
    if ((m = /^torneo-(apertura|clausura)/.exec(slug))) return "Torneo " + cap1(m[1]) + " " + sy + " (Argentina)";
    if ((m = /^(apertura|clausura)---/.exec(slug))) return "Torneo " + cap1(m[1]) + " " + sy + " (Argentina)";
    if (/^pre-libertadores/.test(slug)) return "Liguilla Pre-Libertadores " + sy + " (Argentina)";
    if (/^pre-sudamericana/.test(slug)) return "Liguilla Pre-Sudamericana " + sy + " (Argentina)";
    return "Liga Profesional (Argentina)";
  }

  /* Convierte los eventos de la fuente en partidos para la portada "Hoy".
     Incluye los que todavía no empezaron (pre) y los que están en juego (in),
     con marcador y minuto; los finalizados (post) se usan solo para retirar la
     tarjeta y para importar el resultado. */
  function parseArLive(payload) {
    var evs = payload && payload.events;
    if (!Array.isArray(evs)) return [];
    var today = new Date().toISOString().slice(0, 10);
    var out = [];
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      var comp = ev.competitions && ev.competitions[0];
      if (!comp || !Array.isArray(comp.competitors)) continue;
      var stt = (ev.status && ev.status.type) || {};
      var state = String(stt.state || ""); /* pre | in | post */
      var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(ev.date || ""));
      if (!m) continue;
      var date = m[1] + "-" + m[2] + "-" + m[3];
      /* Los de días anteriores solo interesan si siguen en juego
         (un partido de madrugada que la fuente agrupa en otro día). */
      if (state === "post" && date < today) continue;
      if (state !== "in" && state !== "post" && date < today) continue;
      var home = "", away = "", hg = null, ag = null;
      for (var j = 0; j < comp.competitors.length; j++) {
        var c = comp.competitors[j];
        var nm = c.team && (c.team.displayName || c.team.name);
        var sc = c.score != null && c.score !== "" ? Number(c.score) : NaN;
        if (c.homeAway === "home") { home = nm; hg = isFinite(sc) ? sc : null; }
        else if (c.homeAway === "away") { away = nm; ag = isFinite(sc) ? sc : null; }
      }
      if (!home || !away) continue;
      out.push({
        date: date,
        time: m[4] + ":" + m[5] + " UTC+0", /* la fuente entrega la hora en UTC */
        competition: arCompName(ev),
        code: AR_CODE,
        home: String(home),
        away: String(away),
        state: state === "in" ? "in" : state === "post" ? "post" : "pre",
        live: state === "in",
        homeGoals: hg,
        awayGoals: ag,
        clock: String((ev.status && ev.status.displayClock) || ""),
        period: Number(ev.status && ev.status.period) || 0,
        detail: String((ev.status && ev.status.detail) || ""),
        externalId: ev.id != null ? String(ev.id) : null
      });
    }
    return out;
  }

  /* Partidos ya jugados de la liga argentina (misma fuente). Se usan para
     dar historial real a TODOS los equipos actuales, incluidos los que no
     están en la base histórica (p. ej. Gimnasia y Esgrima de Mendoza).
     Mismos nombres de competición que la base, para que el motor los agrupe. */
  function parseArResults(payload) {
    var evs = payload && payload.events;
    if (!Array.isArray(evs)) return [];
    var out = [];
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      var st = ev.status && ev.status.type ? ev.status.type.name : "";
      if (st !== "STATUS_FULL_TIME") continue; /* solo partidos terminados */
      var comp = ev.competitions && ev.competitions[0];
      if (!comp || !Array.isArray(comp.competitors)) continue;
      var home = "", away = "", hg = null, ag = null;
      for (var j = 0; j < comp.competitors.length; j++) {
        var c = comp.competitors[j];
        var nm = resolveTeamName(c.team && c.team.displayName);
        var sc = c.score != null ? Number(c.score) : NaN;
        if (c.homeAway === "home") { home = nm; hg = sc; }
        else if (c.homeAway === "away") { away = nm; ag = sc; }
      }
      if (!home || !away || !isFinite(hg) || !isFinite(ag)) continue;
      var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ev.date || ""));
      if (!m) continue;
      out.push({
        date: m[1] + "-" + m[2] + "-" + m[3],
        competition: arCompName(ev),
        league: "Liga Profesional (Argentina)",
        home: String(home),
        away: String(away),
        homeGoals: hg,
        awayGoals: ag,
        externalId: ev.id != null ? String(ev.id) : null
      });
    }
    return out;
  }

  /* Los resultados se importan de forma incremental: cada tablero puede traer
     un partido que acaba de terminar. Se evita duplicar por id de evento y, si
     los equipos existen en la base, también por fecha + equipos: la ingesta en
     vivo guarda solo los dígitos del id, así que comparar el texto exacto no
     no alcanza. */
  function extKey(x) { return String(x == null ? "" : x).replace(/^\D+/, ""); }

  function importArResultRows(rows) {
    if (!rows || !rows.length) return 0;
    var seenExt = {}, i;
    var ms = S.state.matches;
    for (i = 0; i < ms.length; i++) {
      if (ms[i].externalId != null) seenExt[extKey(ms[i].externalId)] = true;
    }
    /* Primero descarta por id (barato y suficiente el 99% de las veces). */
    var pending = rows.filter(function (r) {
      if (r.externalId && seenExt[extKey(r.externalId)]) return false;
      if (r.externalId) seenExt[extKey(r.externalId)] = true;
      return true;
    });
    if (!pending.length) return 0;

    /* Solo si queda algo: descarta por fecha + equipos. Cubre el mismo partido
       guardado con el id sin prefijo (ingesta en vivo). */
    var seenPair = {};
    for (i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.date && m.homeId != null && m.awayId != null) {
        seenPair[m.date + "|" + m.homeId + "|" + m.awayId] = true;
      }
    }
    var fresh = pending.filter(function (r) {
      var ht = S.findTeamByName(r.home), at = S.findTeamByName(r.away);
      var pair = ht && at ? r.date + "|" + ht.id + "|" + at.id : "";
      if (pair && seenPair[pair]) return false;
      if (pair) seenPair[pair] = true;
      return true;
    });
    if (!fresh.length) return 0;
    var res = S.importBulk(fresh, "arg");
    ctx = null; /* cambió la base: se reconstruye el contexto de pronóstico */
    if (res && res.added) {
      try { document.dispatchEvent(new CustomEvent("ad:data-changed")); } catch (e) {}
    }
    return res && res.added ? res.added : 0;
  }
  function importArResults(payload) { return importArResultRows(parseArResults(payload)); }

  /* Ningún partido comparte identidad si no es el mismo evento de la fuente. */
  function arKey(f) {
    return f.externalId ? String(f.externalId) : (f.date + "|" + f.home + "|" + f.away);
  }

  /* ---- tablero del día (rápido): estado, marcador y minuto en vivo ---- */
  var arBoard = { ts: 0, fixtures: [], promise: null };

  function arDayKeys() {
    var now = Date.now(), out = [];
    /* Ayer y hoy: un partido de madrugada puede quedar agrupado en otro día. */
    for (var d = -1; d <= 0; d++) {
      out.push(new Date(now + d * 86400000).toISOString().slice(0, 10).replace(/-/g, ""));
    }
    return out;
  }

  function loadArBoard(force) {
    var now = Date.now();
    if (!force && arBoard.ts && (now - arBoard.ts) < AR_BOARD_TTL) return Promise.resolve(arBoard.fixtures);
    if (arBoard.promise && !force) return arBoard.promise;
    var jobs = arDayKeys().map(function (day) {
      return fetch(AR_BOARD_URL + day, { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .catch(function () { return null; });
    });
    arBoard.promise = Promise.all(jobs).then(function (payloads) {
      var fixtures = [], results = [], seen = {};
      payloads.forEach(function (p) {
        if (!p) return;
        parseArLive(p).forEach(function (f) {
          var k = arKey(f);
          if (seen[k]) return;
          seen[k] = 1;
          fixtures.push(f);
        });
        try { results = results.concat(parseArResults(p)); } catch (e) {}
      });
      arBoard.ts = Date.now();
      arBoard.fixtures = fixtures;
      arBoard.promise = null;
      if (results.length) { try { importArResultRows(results); } catch (e) {} }
      return fixtures;
    }).catch(function () { arBoard.promise = null; return arBoard.fixtures; });
    return arBoard.promise;
  }

  /* ---- archivo de la temporada (grande): futuros + historial, en segundo plano ---- */
  var arSeasonPromise = null;

  function readArCache() {
    try {
      var raw = localStorage.getItem(AR_LIVE_CACHE_KEY);
      var o = raw ? JSON.parse(raw) : null;
      return o && Array.isArray(o.fixtures) ? o : null;
    } catch (e) { return null; }
  }

  function seasonFixtures() {
    var c = readArCache();
    var arr = c && Array.isArray(c.fixtures) ? c.fixtures : [];
    /* La caché de temporada solo aporta partidos por jugar: el estado en vivo
       siempre lo manda el tablero del día (si no, un "en vivo" viejo quedaría
       pegado para siempre). */
    arr.forEach(function (f) { if (f) { f.state = "pre"; f.live = false; } });
    return arr;
  }

  function refreshArSeason(force) {
    if (arSeasonPromise && !force) return arSeasonPromise;
    if (!force) {
      var c = readArCache();
      if (c && (Date.now() - (c.ts || 0)) < AR_LIVE_TTL) return Promise.resolve(c.fixtures || []);
    }
    arSeasonPromise = fetch(AR_SEASON_URL, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (p) {
        try { importArResults(p); } catch (e) {} /* historial real de la liga argentina */
        var fx = parseArLive(p).filter(function (f) { return f.state === "pre"; });
        try {
          localStorage.setItem(AR_LIVE_CACHE_KEY, JSON.stringify({ ts: Date.now(), fixtures: fx }));
        } catch (e) {}
        arSeasonPromise = null;
        /* Los futuros llegaron después del primer pintado: se refresca solo. */
        if (isActive() && cache.fixtures) {
          upcomingWithLive(cache.local).then(function (list) {
            if (!isActive()) return;
            cache.fixtures = list || [];
            renderList();
          });
        }
        return fx;
      })
      .catch(function () { arSeasonPromise = null; return seasonFixtures(); });
    return arSeasonPromise;
  }

  /* Une los futuros de la temporada con el tablero del día. El tablero manda:
     trae el estado real, el marcador y el minuto. */
  function mergeArFixtures(season, board, now) {
    var byKey = {}, out = [];
    (season || []).forEach(function (f) {
      var k = arKey(f);
      if (byKey[k]) return;
      byKey[k] = f;
      out.push(f);
    });
    (board || []).forEach(function (b) {
      var k = arKey(b), cur = byKey[k];
      if (!cur) { byKey[k] = b; out.push(b); return; }
      cur.state = b.state;
      cur.live = b.live;
      if (b.state === "in" || b.state === "post") {
        cur.homeGoals = b.homeGoals;
        cur.awayGoals = b.awayGoals;
      }
      cur.clock = b.clock;
      cur.period = b.period;
      cur.detail = b.detail;
    });
    var live = [], next = [];
    out.forEach(function (f) {
      var fk = fixtureKey(f);
      if (f.state === "post") {
        liveState[fk] = { state: "post", ts: now };
        return;
      }
      if (f.state === "in") {
        liveState[fk] = { state: "in", ts: now,
          hg: f.homeGoals, ag: f.awayGoals, clock: f.clock, period: f.period };
        live.push(f);
        return;
      }
      next.push(f);
    });
    return live.concat(next);
  }

  /* Próximos partidos = locales (base histórica) + Liga Argentina (fuente en vivo).
     Primero el tablero del día (rápido y con el estado en vivo); el archivo de
     la temporada se actualiza en segundo plano para los partidos futuros. */
  function upcomingWithLive(localFx, force) {
    localFx = localFx || [];
    if (prefs.arLive === false) return Promise.resolve(localFx);
    return loadArBoard(force).then(function (board) {
      var merged = mergeArFixtures(seasonFixtures(), board, Date.now());
      refreshArSeason(false); /* no bloquea el pintado */
      return localFx.concat(merged);
    });
  }

  /* Firma del estado de la liga argentina: si cambia (gol, inicio, final)
     se vuelve a pintar la lista. */
  function arSignature(fx) {
    return (fx || []).filter(function (f) { return f && f.code === AR_CODE; }).map(function (f) {
      return arKey(f) + "|" + (f.state || "") + "|" +
        (f.homeGoals == null ? "" : f.homeGoals) + "-" + (f.awayGoals == null ? "" : f.awayGoals) +
        "|" + (f.clock || "");
    }).join(";");
  }

  /* ===== Motor de pronóstico (reutiliza AD.stats) ============== */
  var ctx = null;

  function buildContext() {
    var matches = S.state.matches;
    return { matches: matches, ratings: ST.eloRatings(matches), compBase: {}, globalBase: null };
  }

  function baseFor(comp) {
    if (!ctx) return null;
    if (!comp) {
      if (!ctx.globalBase) ctx.globalBase = ST.leagueBaselines(ctx.matches);
      return ctx.globalBase;
    }
    if (!(comp in ctx.compBase)) ctx.compBase[comp] = ST.competitionBaseline(ctx.matches, comp);
    return ctx.compBase[comp];
  }

  function predict(homeId, awayId, comp) {
    var matches = ctx.matches;
    var base = baseFor(comp);
    var hs = ST.teamStats(homeId, matches, RECENCY);
    var as = ST.teamStats(awayId, matches, RECENCY);
    var eg = ST.expectedGoals(hs, as, base);
    var d = ST.derived(ST.scoreMatrix(eg.home, eg.away), eg.home, eg.away);
    d.markets = ST.blendElo(d.markets, ctx.ratings[homeId] || 1500, ctx.ratings[awayId] || 1500);
    var conf = ST.confidence({
      homeStats: hs, awayStats: as, hasCornersData: false, hasCardsData: false,
      lineupsConfirmed: false, homeBajas: false, awayBajas: false, meteo: false
    });
    return {
      lh: eg.home, la: eg.away,
      hw: d.markets.homeWin, dr: d.markets.draw, aw: d.markets.awayWin,
      over25: d.markets.over25, btts: d.markets.btts,
      top: d.markets.correct, conf: conf, homeMatches: hs.matches, awayMatches: as.matches
    };
  }

  function favorite(p) {
    if (p.hw >= p.dr && p.hw >= p.aw) return "home";
    if (p.aw >= p.hw && p.aw >= p.dr) return "away";
    return "draw";
  }

  function confSlug(label) {
    return ({ "Alta": "alta", "Media": "media", "Baja": "baja", "Muy baja": "muybaja" })[label] || "media";
  }

  /* ===== Portada "Hoy" ======================================== */
  var cache = { fixtures: null, local: null, filter: "" };

  function isActive() {
    var v = $("view-hoy");
    return !!v && v.classList.contains("is-active");
  }

  /* ===== Partidos en vivo y partidos que ya terminaron ======== */
  /* "Hoy" muestra los partidos que todavía no terminaron. El estado real se
     consulta a la fuente (una petición por competición y día, cada 2 minutos) desde
     poco antes del inicio: así el partido se marca EN VIVO con su marcador y,
     cuando llega el pitazo final, la tarjeta se retira en el acto. Sin dato de
     la fuente se usa la duración máxima habitual (≈2 h 05). Los análisis guardados
     no se tocan: siguen en "Mis predicciones" y en el historial. */
  var MATCH_LEN_MS = 125 * 60000;  /* ≈2 h 05: 90' + 15' de descanso + añadido */
  var MATCH_HARD_MS = 180 * 60000; /* tope: 3 h (alargue + penales + demoras) */
  var FEED_PRE_MS = 5 * 60000;     /* se consulta desde 5 min antes del inicio */
  var BOARD_TTL = 120000;

  var liveState = {};   /* partido -> { state, ts, hg, ag, clock, period } */
  var boardCache = {};  /* "liga|AAAAMMDD" -> { ts, events } */
  var boardFetch = {};  /* "liga|AAAAMMDD" -> true mientras descarga */

  function fixtureKey(f) {
    return f.externalId ? String(f.externalId)
      : (f.code + "|" + f.date + "|" + f.home + "|" + f.away);
  }

  function boardKey(f, kind) {
    var slug = window.AD.live && window.AD.live.slugForCode ? window.AD.live.slugForCode(f.code) : null;
    var k = kickoff(f);
    if (!slug || !k || !k.ms) return "";
    /* La fuente agrupa por día de Nueva York; los partidos de madrugada (hora UTC)
       pueden caer en el día anterior. Se guarda también el día UTC. */
    var day = kind === "utc"
      ? new Date(k.ms).toISOString().slice(0, 10)
      : dateKeyInTz(k.ms, "America/New_York");
    return slug + "|" + day.replace(/-/g, "");
  }

  function stateFor(f, now) {
    var rec = liveState[fixtureKey(f)];
    if (!rec) return null;
    if (rec.state === "post") return "post"; /* terminal: ya terminó */
    return (now - rec.ts) < 300000 ? rec.state : null;
  }

  function isOver(f, now) {
    var k = kickoff(f);
    if (!k || !k.ms) return false;
    if (now - k.ms >= MATCH_HARD_MS) return true;
    if (f && f.state === "in") return false; /* fuente en vivo: sigue en juego */
    var st = stateFor(f, now);
    if (st === "post") return true;   /* pitazo final confirmado por la fuente */
    if (st === "in" || st === "pre") return false; /* sigue en juego o demorado */
    return now - k.ms >= MATCH_LEN_MS; /* sin dato: regla por tiempo */
  }

  /* Datos del partido en juego (marcador y minuto), o null si no está en vivo. */
  function liveOf(f, now) {
    if (!f) return null;
    var rec = liveState[fixtureKey(f)];
    var st = stateFor(f, now);
    if (st === "in" && rec) {
      return { hg: rec.hg, ag: rec.ag, clock: rec.clock || "", period: rec.period || 0 };
    }
    if (f.state === "in") {
      return { hg: f.homeGoals, ag: f.awayGoals, clock: f.clock || "", period: f.period || 0 };
    }
    return null;
  }

  function overCount(all, now) {
    var n = 0;
    for (var i = 0; i < all.length; i++) if (isOver(all[i], now)) n++;
    return n;
  }

  /* ---- estado real en la fuente (solo para la ventana de cierre) ---- */
  function foldName(s) {
    return String(s == null ? "" : s)
      .replace(/\([^)]*\)/g, " ")
      .replace(/ø/g, "o").replace(/ł/g, "l").replace(/đ/g, "d")
      .replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ı/g, "i")
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  var NAME_SKIP = { fc: 1, cf: 1, ac: 1, afc: 1, sc: 1, sk: 1, sl: 1, sv: 1, cd: 1,
    ca: 1, cr: 1, cs: 1, club: 1, calcio: 1, de: 1, del: 1, la: 1, las: 1, los: 1,
    el: 1, real: 1, fk: 1, bk: 1, if: 1, ifk: 1, kaa: 1, rsc: 1, rc: 1, ud: 1, sd: 1,
    se: 1, ad: 1, as: 1, ss: 1, tsv: 1, vfl: 1, vfb: 1, spvgg: 1 };
  function nameTokens(s) {
    return foldName(s).split(" ").filter(function (t) {
      return t && !NAME_SKIP[t] && !/^\d+$/.test(t);
    });
  }
  function nameScore(a, b) {
    var A = nameTokens(a), B = nameTokens(b);
    if (!A.length || !B.length) return 0;
    if (A.join(" ") === B.join(" ")) return 2;
    var small = A.length <= B.length ? A : B, big = A.length <= B.length ? B : A;
    if (small.every(function (t) { return big.indexOf(t) !== -1; })) return 2;
    if (A[0] === B[0]) return 1;
    if (A[0].length >= 5 && B[0].length >= 5) {
      var pre = 0, n = Math.min(A[0].length, B[0].length);
      while (pre < n && A[0].charAt(pre) === B[0].charAt(pre)) pre++;
      if (pre >= 6) return 1;
    }
    return 0;
  }

  function parseBoard(p) {
    var out = [], evs = p && p.events;
    if (!Array.isArray(evs)) return out;
    evs.forEach(function (ev) {
      var comp = ev.competitions && ev.competitions[0];
      if (!comp) return;
      var home = "", away = "", hg = null, ag = null;
      (comp.competitors || []).forEach(function (c) {
        var nm = c.team && (c.team.displayName || c.team.name);
        var sc = c.score != null && c.score !== "" ? Number(c.score) : NaN;
        if (c.homeAway === "home") { home = nm || ""; hg = isFinite(sc) ? sc : null; }
        else if (c.homeAway === "away") { away = nm || ""; ag = isFinite(sc) ? sc : null; }
      });
      var st = ev.status && ev.status.type ? ev.status.type.state : "";
      var ms = Date.parse(ev.date || "");
      if (home && away && st) {
        out.push({ id: ev.id != null ? String(ev.id) : "", home: home, away: away,
          state: st, ms: isNaN(ms) ? null : ms,
          hg: hg, ag: ag,
          clock: String((ev.status && ev.status.displayClock) || ""),
          period: Number(ev.status && ev.status.period) || 0 });
      }
    });
    return out;
  }

  function findEvent(f, events) {
    /* Las fuentes externas traen el id del evento: es la vía exacta. */
    var m = /^(?:[a-z]+:)?(\d+)$/i.exec(String(f.externalId == null ? "" : f.externalId));
    if (m) {
      for (var i = 0; i < events.length; i++) if (events[i].id === m[1]) return events[i];
      return null;
    }
    /* Sin id: nombre parecido y mismo horario (±10 min). */
    var k = kickoff(f);
    if (!k || !k.ms) return null;
    var best = null, bestScore = 0;
    events.forEach(function (ev) {
      if (ev.ms == null || Math.abs(ev.ms - k.ms) > 10 * 60000) return;
      var sc = nameScore(f.home, ev.home) + nameScore(f.away, ev.away);
      if (sc > bestScore) { bestScore = sc; best = ev; }
    });
    return bestScore >= 3 ? best : null;
  }

  function applyBoard(key, events, now) {
    var fallback = {}, changed = false;
    (cache.fixtures || []).forEach(function (f) {
      var k = kickoff(f);
      if (!k || !k.ms) return;
      var el = now - k.ms;
      if (el < -FEED_PRE_MS || el >= MATCH_HARD_MS) return;
      if (boardKey(f, "et") !== key && boardKey(f, "utc") !== key) return;
      var ev = findEvent(f, events);
      if (!ev) {
        /* Partido de madrugada: la fuente pudo agruparlo en el día siguiente. */
        if (f.externalId && new Date(k.ms).getUTCHours() < 4) fallback[boardKey(f, "utc")] = true;
        return;
      }
      var fk = fixtureKey(f), rec = liveState[fk];
      /* El estado no retrocede: si ya está en juego (o terminado), un tablero
         viejo que todavía lo da por "por jugar" no lo apaga. */
      if (rec && (rec.state === "post" || (rec.state === "in" && ev.state === "pre"))) return;
      if (rec && rec.state === ev.state && rec.hg === ev.hg && rec.ag === ev.ag &&
          rec.clock === ev.clock && rec.period === ev.period) { rec.ts = now; return; }
      liveState[fk] = { state: ev.state, ts: now,
        hg: ev.hg, ag: ev.ag, clock: ev.clock, period: ev.period };
      changed = true;
    });
    Object.keys(fallback).forEach(function (k2) { if (k2) fetchBoard(k2, now); });
    /* Se repinta si cambió el estado (inicio, gol, final): así el marcador y
       el minuto en vivo se ven sin recargar la página. */
    if (isActive() && (changed || overCount(cache.fixtures, Date.now()) !== cache.ended)) renderList();
  }

  function fetchBoard(key, now) {
    var c = boardCache[key];
    if (c && (now - c.ts) < BOARD_TTL) return;
    if (boardFetch[key]) return;
    var parts = key.split("|");
    var url = "https://site.api.espn.com/apis/site/v2/sports/soccer/" + parts[0] +
      "/scoreboard?dates=" + parts[1];
    boardFetch[key] = true;
    fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (p) {
        var events = parseBoard(p);
        boardCache[key] = { ts: Date.now(), events: events };
        applyBoard(key, events, Date.now());
      })
      .catch(function () { /* sin conexión: queda la regla por tiempo */ })
      .then(function () { boardFetch[key] = null; });
  }

  function refreshStatuses(now) {
    if (!window.AD.live || !window.AD.live.slugForCode || !cache.fixtures) return;
    var all = cache.fixtures, seen = {};
    for (var i = 0; i < all.length; i++) {
      var f = all[i], k = kickoff(f);
      if (!k || !k.ms) continue;
      var el = now - k.ms;
      /* Desde poco antes del inicio (para detectar el arranque y marcarlo en
         vivo) hasta el tope de duración del partido. */
      if (el < -FEED_PRE_MS || el >= MATCH_HARD_MS) continue;
      var key = boardKey(f, "et");
      if (!key || seen[key]) continue;
      seen[key] = true;
      fetchBoard(key, now);
    }
  }

  /* Mientras la portada está abierta, revisa el estado de los partidos (en vivo
     y finalizados) y refresca el tablero argentino cada minuto. */
  var retireTimer = null;
  var arPollTs = 0;

  function pollAr(now) {
    if (prefs.arLive === false) return;
    if (now - arPollTs < 55000) return;
    if (!cache.fixtures || !cache.fixtures.some(function (f) { return f.code === AR_CODE; })) return;
    arPollTs = now;
    upcomingWithLive(cache.local, true).then(function (fx) {
      if (!isActive()) return;
      var sig = arSignature(fx);
      if (sig === cache.arSig) return;
      cache.fixtures = fx || [];
      renderList();
    }).catch(function () { /* sin conexión: queda lo último mostrado */ });
  }

  function watchRetired() {
    if (retireTimer) return;
    retireTimer = setInterval(function () {
      if (!isActive() || !cache.fixtures || !cache.fixtures.length) return;
      var now = Date.now();
      refreshStatuses(now);
      pollAr(now);
      if (overCount(cache.fixtures, now) === cache.ended) return;
      renderList();
    }, 30000);
    /* Al volver a la pestaña, actualiza enseguida (los navegadores frenan los
       temporizadores en segundo plano). */
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible" || !isActive()) return;
      if (!cache.fixtures || !cache.fixtures.length) return;
      arPollTs = 0;
      pollAr(Date.now());
      renderList();
    });
  }

  function onShowView() { renderHoy(); }

  function onDataChanged() {
    ctx = null;
    cache.fixtures = null;
    if (isActive()) renderHoy();
  }

  function renderHoy() {
    var host = $("hoy-root");
    if (!host) return;
    if (!S.state.matches.length) { renderOnboarding(host); return; }

    host.innerHTML =
      '<div class="hoy-head">' +
        '<div><h2 class="hoy-title" data-tip="Partidos próximos con su pronóstico 1X2 (local, empate, visita), marcador más probable y nivel de confianza. Los partidos se retiran solos al terminar.">Partidos y pronósticos</h2>' +
        '<p class="muted" id="hoy-sub">Cargando próximos partidos…</p></div>' +
      "</div>" +
      '<div id="hoy-list">' + skeleton(4) + "</div>";

    DS.loadUpcoming()
      .then(function (fx) { cache.local = fx || []; return upcomingWithLive(cache.local); })
      .then(function (fx) { cache.fixtures = fx || []; renderList(); })
      .catch(function (e) {
        var list = $("hoy-list"), sub = $("hoy-sub");
        if (sub) sub.textContent = "No se pudieron cargar los próximos partidos.";
        if (list) host.innerHTML = '<div class="panel"><p class="muted">' +
          esc(e && e.message ? e.message : String(e)) + "</p></div>";
      });
  }

  function renderOnboarding(host) {
    host.innerHTML =
      '<section class="onboard">' +
        '<div class="onboard-orb" aria-hidden="true"></div>' +
        '<span class="hero-pill">&#9917; ' + esc(BRAND.name) + "</span>" +
        '<h2 class="onboard-title" data-tip="Futbolityx calcula pronósticos de fútbol con datos históricos, simulación e informes. Todo se procesa en tu navegador.">Pronósticos de fútbol en segundos</h2>' +
        '<p class="onboard-sub">Mirá las probabilidades de los próximos partidos, calculadas en tu navegador. ' +
          "Empezá gratis; los planes Pro y Elite son opcionales.</p>" +
        '<div class="onboard-actions">' +
          '<button class="btn btn-primary btn-lg" id="onboard-start" type="button">Cargar partidos y empezar</button>' +
          '<button class="btn btn-ghost btn-lg" type="button" data-goto="acerca">Cómo funciona</button>' +
        "</div>" +
        '<p class="muted onboard-note">La primera vez descarga la base histórica (~95 MB, una sola vez). ' +
        "Después queda guardada en este navegador y abre al instante.</p>" +
        '<p class="muted onboard-legal">Al usar Futbolityx aceptás los ' +
        '<a href="legal.html#doc-terminos">Términos y Condiciones</a> y la ' +
        '<a href="legal.html#doc-privacidad">Política de Privacidad</a>. Es una herramienta ' +
        "informativa: no es un servicio de apuestas ni garantiza resultados.</p>" +
        '<p class="muted" id="base-status"></p>' +
      "</section>";

    var b = $("onboard-start");
    if (b) b.addEventListener("click", function () {
      var top = $("btn-load-base");
      if (top) top.click();
    });
  }

  function skeleton(n) {
    var out = "";
    for (var i = 0; i < n; i++) {
      out += '<div class="fx-skel"><div class="sk-line w40"></div><div class="sk-line w80"></div>' +
        '<div class="sk-bar"></div><div class="sk-line w60"></div></div>';
    }
    return out;
  }

  /* El filtro de "Hoy" lista las competiciones con partidos por jugar y también
     las conocidas por AD.dataset.leagues. Así una competición como CONMEBOL
     Sudamericana sigue figurando aunque su última jornada ya haya terminado. */
  function allCompetitionNames(fixtures) {
    var seen = {}, names = [];
    function add(n) {
      if (!n) return;
      n = String(n);
      if (seen[n]) return;
      seen[n] = true;
      names.push(n);
    }
    (fixtures || []).forEach(function (f) { add(f && f.competition); });
    var known = window.AD && window.AD.dataset && window.AD.dataset.leagues;
    if (known) Object.keys(known).forEach(function (k) { add(known[k]); });
    names.sort(function (a, b) {
      var x = a.toLowerCase(), y = b.toLowerCase();
      return x < y ? -1 : (x > y ? 1 : 0);
    });
    return names;
  }

  function compOptions(fixtures) {
    return '<option value="">Todas las competiciones</option>' + allCompetitionNames(fixtures).map(function (n) {
      return '<option value="' + esc(n) + '">' + esc(n) + "</option>";
    }).join("");
  }

  function hoyToolsHTML(fixtures) {
    return '<div class="hoy-tools">' +
      '<label class="hoy-field"><span>Competición</span>' +
        '<select id="hoy-comp">' + compOptions(fixtures) + "</select></label>" +
      '<label class="hoy-field hoy-live"><span>Fuente</span>' +
        '<span class="hoy-live-pick"><input type="checkbox" id="hoy-live"' +
          (prefs.arLive !== false ? " checked" : "") +
        "> Liga Argentina (en vivo)</span></label>" +
      "</div>";
  }

  function wireHoyTools() {
    var sel = $("hoy-comp");
    if (sel) {
      sel.value = cache.filter || "";
      sel.addEventListener("change", function () { cache.filter = sel.value; renderList(); });
    }
    var liveCb = $("hoy-live");
    if (liveCb) liveCb.addEventListener("change", function () {
      prefs.arLive = liveCb.checked;
      savePrefs();
      upcomingWithLive(cache.local || []).then(function (fx) { cache.fixtures = fx || []; renderList(); });
    });
  }

  function renderList() {
    var listEl = $("hoy-list");
    if (!listEl) return;
    var all = cache.fixtures || [];
    var now = Date.now();
    /* Los partidos terminados dejan de mostrarse en la portada. */
    var fixtures = all.filter(function (f) { return !isOver(f, now); });
    cache.ended = overCount(all, now);
    refreshStatuses(now);
    var sub = $("hoy-sub");

    if (!fixtures.length) {
      if (sub) sub.textContent = "No hay partidos en vivo ni por jugar en este momento.";
      listEl.innerHTML = '<div class="panel"><p class="muted">' +
        (all.length
          ? "Ya terminaron los partidos que había en la base. Los resultados están en <strong>Partidos</strong>."
          : "La base no incluye partidos futuros. Podés analizar cualquier cruce desde <strong>Analizar</strong>.") +
        "</p></div>";
      return;
    }

    var filter = cache.filter || "";
    var filtered = filter ? fixtures.filter(function (f) { return f.competition === filter; }) : fixtures;

    /* El filtro puede apuntar a una competición conocida sin partidos próximos
       (p. ej. CONMEBOL Sudamericana). En ese caso se mantiene la selección y se
       explica el estado vacío, en vez de volver silenciosamente a "Todas". */
    if (!filtered.length) {
      if (sub) sub.textContent = "Sin partidos de " + filter;
      listEl.innerHTML = hoyToolsHTML(fixtures) +
        '<div class="panel"><p class="muted">No hay partidos en vivo ni por jugar de <strong>' +
        esc(filter) + "</strong> en este momento. Elegí otra competición o analizá un cruce desde <strong>Analizar</strong>.</p></div>";
      wireHoyTools();
      return;
    }

    refreshDayKeys();

    /* Ordena por el instante real (ya convertido a la zona del usuario) y
       agrupa por día en esa misma zona. Los partidos EN VIVO van primero. */
    var decorated = filtered.map(function (f) {
      var k = kickoff(f);
      return { f: f, ms: k.ms, key: groupKey(f), live: liveOf(f, now) };
    });
    decorated.sort(function (a, b) {
      if (!!a.live !== !!b.live) return a.live ? -1 : 1;
      var av = a.ms != null ? a.ms : Date.parse(a.f.date + "T12:00:00");
      var bv = b.ms != null ? b.ms : Date.parse(b.f.date + "T12:00:00");
      if (av !== bv) return av - bv;
      return a.f.competition < b.f.competition ? -1 : 1;
    });
    var shown = decorated.slice(0, MAX_CARDS);

    if (!ctx) ctx = buildContext();

    var items = shown.map(function (d, i) {
      var f = d.f;
      var ht = S.findTeamByName(resolveTeamName(f.home)), at = S.findTeamByName(resolveTeamName(f.away));
      var p = null;
      if (ht && at) { try { p = predict(ht.id, at.id, f.competition); } catch (e) { p = null; } }
      var slug = (window.AD.live && window.AD.live.slugForCode) ? window.AD.live.slugForCode(f.code) : null;
      var em = /^(?:[a-z]+:)?(\d+)$/i.exec(String(f.externalId == null ? "" : f.externalId));
      var act = !!(slug && d.ms && window.AD.livehoy &&
        window.AD.livehoy.isCandidate({ slug: slug, ms: d.ms }, now));
      return {
        f: f, ht: ht, at: at, p: p, key: d.key, live: d.live,
        fk: fixtureKey(f), domId: "fxl" + i,
        slug: slug, ms: d.ms, id: em ? em[1] : null, act: act
      };
    });

    var liveCount = items.filter(function (it) { return !!it.live; }).length;
    if (sub) {
      sub.textContent = (liveCount ? liveCount + " en vivo · " : "") +
        filtered.length.toLocaleString("es") +
        (filtered.length === 1 ? " partido" : " partidos") +
        (filtered.length > MAX_CARDS ? " · mostrando los primeros " + MAX_CARDS : "") +
        " · horarios en " + tzLabel() + " (" + gmtLabel() + ")";
    }

    var parts = [];
    parts.push(hoyToolsHTML(fixtures));
    if (liveCount) parts.push('<p class="hoy-src">' + liveCount +
      (liveCount === 1 ? " partido en vivo" : " partidos en vivo") +
      " · marcadores al día</p>");

    var lastDay = null;
    items.forEach(function (it, i) {
      if (it.key !== lastDay) {
        lastDay = it.key;
        parts.push('<div class="day-sep"><span>' + esc(dayLabel(it.key)) + "</span><i></i></div>");
      }
      parts.push(cardHTML(it, i));
    });

    listEl.innerHTML = parts.join("");

    /* Firma del estado en vivo de la liga argentina: se usa para no repintar
       si el tablero no cambió. */
    cache.arSig = arSignature(cache.fixtures);

    wireHoyTools();

    listEl.querySelectorAll("[data-fx]").forEach(function (btn) {
      btn.addEventListener("click", function () { onCardAction(btn, items); });
    });

    /* Análisis en vivo de los partidos en juego o que empiezan dentro de 1 h.
       livehoy se encarga de consultar, recalcular y repintar solo esa parte. */
    if (window.AD.livehoy) {
      try {
        window.AD.livehoy.start(items.filter(function (it) { return it.act; }));
      } catch (e) { /* nunca debe romper la portada */ }
    }
  }

  function cardHTML(it, i) {
    var f = it.f, p = it.p, live = it.live;
    var when = whenText(f);

    var whenHTML = (live && live.clock)
      ? '<span class="fxl-inline is-live" data-live-clock="1"><i></i>EN VIVO · ' + esc(live.clock) + "</span>"
      : live
        ? '<span class="fxl-inline is-live" data-live-clock="1"><i></i>EN VIVO</span>'
        : esc(when);

    var head = '<div class="fx-top"><span class="fx-comp">' + esc(f.competition) + "</span>" +
      '<span class="fx-when" data-fkwhen="1">' + whenHTML + "</span></div>";

    var middle = (live && live.hg != null && live.ag != null)
      ? '<div class="fx-score">' + esc(live.hg) + "<i>:</i>" + esc(live.ag) + "</div>"
      : '<div class="fx-vs">VS</div>';

    var teams = '<div class="fx-teams">' +
      '<div class="fx-team home"><span class="fx-name">' + esc(dispName(f.home)) + "</span>" +
        (p ? '<span class="fx-tag" data-fktag="h">' + pct1(p.hw) + "%</span>" : "") + "</div>" +
      middle +
      '<div class="fx-team away"><span class="fx-name">' + esc(dispName(f.away)) + "</span>" +
        (p ? '<span class="fx-tag" data-fktag="a">' + pct1(p.aw) + "%</span>" : "") + "</div>" +
      "</div>";

    var body;
    if (!p) {
      body = '<div class="fx-nodata">Sin historial suficiente para estimar ' +
        "(igual podés analizarlo a mano).</div>";
    } else {
      var hw = pct1(p.hw), dr = pct1(p.dr), aw = pct1(p.aw);
      var top = p.top && p.top[0] ? (p.top[0].h + " - " + p.top[0].a) : "—";
      var topP = p.top && p.top[0] ? pct1(p.top[0].p) + "%" : "";
      var fav = favorite(p);
      var favLabel = fav === "home" ? "Gana " + dispName(f.home) : fav === "away" ? "Gana " + dispName(f.away) : "Empate";

      body =
        '<div class="prob-bar">' +
          '<span class="seg seg-home" style="width:' + hw + '%"><b>' + hw + "%</b></span>" +
          '<span class="seg seg-draw" style="width:' + dr + '%"><b>' + dr + "%</b></span>" +
          '<span class="seg seg-away" style="width:' + aw + '%"><b>' + aw + "%</b></span>" +
        "</div>" +
        '<div class="prob-legend"><span class="lg-home">1 · Local</span>' +
          '<span class="lg-draw">X · Empate</span><span class="lg-away">2 · Visita</span></div>' +
        '<div class="fx-stats">' +
          "<span><b>" + esc(favLabel) + "</b></span>" +
          "<span>Goles esperados " + p.lh.toFixed(1) + "–" + p.la.toFixed(1) + "</span>" +
          "<span>Marcador probable <b>" + (p.top && p.top[0] ? p.top[0].h + "-" + p.top[0].a : "—") +
            "</b> (" + (p.top && p.top[0] ? pct1(p.top[0].p) + "%" : "—") + ")</span>" +
          '<span class="badge conf-' + confSlug(p.conf.label) + '">Confianza ' + p.conf.label + "</span>" +
        "</div>";
    }

    var liveBtn = (window.AD.live && window.AD.live.slugForCode(f.code))
      ? '<button class="btn btn-ghost btn-mini" type="button" data-fx="live" data-i="' + i + '">Alineaciones</button>'
      : "";

    var actions = '<div class="fx-actions">' +
      '<button class="btn btn-primary btn-mini" type="button" data-fx="analizar" data-i="' + i + '">Analizar completo</button>' +
      liveBtn +
      '<button class="btn btn-secondary btn-mini" type="button" data-fx="compartir" data-i="' + i + '">Compartir</button>' +
      '<button class="btn btn-ghost btn-mini" type="button" data-fx="imagen" data-i="' + i + '">Imagen</button>' +
      "</div>";

    var liveHost = it.act
      ? '<div class="fxl" data-fkl="' + esc(it.domId) + '"><div class="fxl-load">' +
        '<span class="fxl-dot"></span>Actualizando datos…</div></div>'
      : "";

    var note = live
      ? '<p class="fx-livenote">El pronóstico 1X2 es previo al partido; el marcador y el análisis se actualizan en vivo.</p>'
      : "";

    return '<article class="fx' + (live ? " fx--live" : "") + (p ? "" : " fx--nodata") +
      '" data-fk="' + esc(it.domId) + '">' +
      head + teams + '<div class="fx-static-body">' + note + body + "</div>" + liveHost + actions + "</article>";
  }

  function onCardAction(btn, items) {
    var i = Number(btn.getAttribute("data-i"));
    var it = items[i];
    if (!it) return;
    var action = btn.getAttribute("data-fx");
    if (action === "analizar") analyzeTeams(it);
    else if (action === "compartir") shareFixture(it);
    else if (action === "imagen") downloadCard(it);
    else if (action === "live" && window.AD.live) {
      window.AD.live.open({
        slug: window.AD.live.slugForCode(it.f.code),
        eventId: it.f.externalId ? String(it.f.externalId).replace(/^\D+/, "") : null,
        date: it.f.date,
        home: it.f.home,
        away: it.f.away,
        competition: it.f.competition
      });
    }
  }

  function analyzeTeams(it) {
    if (!it.ht || !it.at) { toast("No se encontraron esos equipos en la base."); return; }
    var l = $("an-local"), v = $("an-visitante");
    if (l) l.value = it.ht.id;
    if (v) v.value = it.at.id;
    var tab = document.querySelector('.tabs .tab[data-view="analisis"]');
    if (tab) tab.click();
    var go = $("btn-analizar");
    if (go) go.click();
  }

  /* ===== Compartir ============================================ */
  function buildShareText(it) {
    var f = it.f, p = it.p;
    var lines = [BRAND.name + " · " + dispName(f.home) + " vs " + dispName(f.away)];
    lines.push(f.competition);
    lines.push("Cuándo: " + whenText(f) + " (hora " + tzLabel() + ")");
    if (p) {
      lines.push("Local " + pct1(p.hw) + "% · Empate " + pct1(p.dr) + "% · Visita " + pct1(p.aw) + "%");
      if (p.top && p.top[0]) lines.push("Marcador más probable: " + p.top[0].h + "-" + p.top[0].a);
    }
    lines.push("Estimación estadística, no es una garantía.");
    lines.push(BRAND.url);
    return lines.join("\n");
  }

  function fallbackCopy(t) {
    var ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast("Pronóstico copiado."); }
    catch (e) { window.prompt("Copiá el pronóstico:", t); }
    ta.remove();
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast("Pronóstico copiado."); }, function () { fallbackCopy(t); });
    } else fallbackCopy(t);
  }

  function shareFixture(it) {
    var text = buildShareText(it);
    makeCardBlob(it).then(function (blob) {
      var file = null;
      try { file = new File([blob], "pronostico.png", { type: "image/png" }); } catch (e) { file = null; }
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text: text, title: BRAND.name }).catch(function () {});
      } else if (navigator.share) {
        navigator.share({ title: BRAND.name + ": " + dispName(it.f.home) + " vs " + dispName(it.f.away), text: text, url: BRAND.url })
          .catch(function () {});
      } else {
        copyText(text);
      }
    }).catch(function () { copyText(text); });
  }

  function downloadCard(it) {
    makeCardBlob(it).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "pronostico-" + slug(dispName(it.f.home)) + "-vs-" + slug(dispName(it.f.away)) + ".png";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
      toast("Imagen descargada.");
    }).catch(function () { toast("No se pudo generar la imagen."); });
  }

  /* ===== Imagen compartible (canvas) ========================== */
  function makeCardBlob(it) {
    return new Promise(function (resolve, reject) {
      try {
        var c = drawCard(it);
        if (c.toBlob) c.toBlob(function (b) { b ? resolve(b) : resolve(dataURLtoBlob(c.toDataURL("image/png"))); }, "image/png");
        else resolve(dataURLtoBlob(c.toDataURL("image/png")));
      } catch (e) { reject(e); }
    });
  }

  function dataURLtoBlob(dataUrl) {
    var parts = dataUrl.split(",");
    var bin = atob(parts[1]);
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: "image/png" });
  }

  function roundRect(x, rx, ry, w, h, r) {
    x.beginPath();
    x.moveTo(rx + r, ry);
    x.arcTo(rx + w, ry, rx + w, ry + h, r);
    x.arcTo(rx + w, ry + h, rx, ry + h, r);
    x.arcTo(rx, ry + h, rx, ry, r);
    x.arcTo(rx, ry, rx + w, ry, r);
    x.closePath();
  }

  function fitText(x, text, cx, y, size, maxW, weight) {
    var s = size;
    do {
      x.font = (weight ? weight + " " : "") + s + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      if (x.measureText(text).width <= maxW) break;
      s -= 2;
    } while (s > 24);
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.fillText(text, cx, y);
  }

  function segLabel(x, text, cx, cy, w) { if (w > 84) x.fillText(text, cx, cy); }

  function drawCard(it) {
    var f = it.f, p = it.p;
    var W = 1080, H = 1350;
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");

    var g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#071019"); g.addColorStop(0.55, "#0d1b2e"); g.addColorStop(1, "#08131f");
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    var rg = x.createRadialGradient(W / 2, 430, 40, W / 2, 430, 560);
    rg.addColorStop(0, "rgba(34,227,154,0.30)"); rg.addColorStop(1, "rgba(34,227,154,0)");
    x.fillStyle = rg; x.beginPath(); x.arc(W / 2, 430, 560, 0, Math.PI * 2); x.fill();

    x.textAlign = "left"; x.textBaseline = "alphabetic";
    x.fillStyle = "#22e39a"; x.font = "bold 46px system-ui, sans-serif";
    x.fillText(BRAND.name, 80, 132);
    x.fillStyle = "#8da3c0"; x.font = "26px system-ui, sans-serif";
    x.fillText(BRAND.claim, 80, 172);

    x.textAlign = "center";
    x.fillStyle = "#cfe0f5"; x.font = "34px system-ui, sans-serif";
    x.fillText(f.competition, W / 2, 300);
    x.fillStyle = "#8da3c0"; x.font = "30px system-ui, sans-serif";
    x.fillText(whenText(f), W / 2, 350);
    x.fillStyle = "#6b7f99"; x.font = "25px system-ui, sans-serif";
    x.fillText("hora " + tzLabel() + " · " + gmtLabel(), W / 2, 388);

    x.fillStyle = "#ffffff";
    fitText(x, dispName(f.home), W / 2, 480, 78, 920, "bold");
    x.fillStyle = "#8da3c0"; x.font = "40px system-ui, sans-serif"; x.textAlign = "center";
    x.fillText("vs", W / 2, 545);
    x.fillStyle = "#ffffff";
    fitText(x, dispName(f.away), W / 2, 635, 78, 920, "bold");

    var bx = 90, bw = W - 180, by = 720, bh = 92;
    if (p) {
      var sum = (p.hw + p.dr + p.aw) || 1;
      var w1 = bw * p.hw / sum, w2 = bw * p.dr / sum, w3 = bw * p.aw / sum;
      roundRect(x, bx, by, bw, bh, 18); x.save(); x.clip();
      x.fillStyle = "#22e39a"; x.fillRect(bx, by, w1, bh);
      x.fillStyle = "#ffc857"; x.fillRect(bx + w1, by, w2, bh);
      x.fillStyle = "#6d8cff"; x.fillRect(bx + w1 + w2, by, w3, bh);
      x.restore();

      x.textAlign = "center"; x.textBaseline = "middle";
      x.font = "bold 42px system-ui, sans-serif"; x.fillStyle = "#032018";
      segLabel(x, pct1(p.hw) + "%", bx + w1 / 2, by + bh / 2, w1);
      x.fillStyle = "#3a2a00";
      segLabel(x, pct1(p.dr) + "%", bx + w1 + w2 / 2, by + bh / 2, w2);
      x.fillStyle = "#071033";
      segLabel(x, pct1(p.aw) + "%", bx + w1 + w2 + w3 / 2, by + bh / 2, w3);

      x.textBaseline = "alphabetic"; x.textAlign = "left"; x.font = "30px system-ui, sans-serif";
      x.fillStyle = "#22e39a"; x.fillText("1 Local", bx, by + 150);
      x.fillStyle = "#ffc857"; x.fillText("X Empate", bx + 300, by + 150);
      x.fillStyle = "#6d8cff"; x.fillText("2 Visita", bx + 660, by + 150);

      x.textAlign = "center";
      x.fillStyle = "#eaf2fb"; x.font = "34px system-ui, sans-serif";
      x.fillText("Marcador más probable", W / 2, 990);
      x.fillStyle = "#ffffff"; x.font = "bold 130px system-ui, sans-serif";
      x.fillText(p.top && p.top[0] ? p.top[0].h + " - " + p.top[0].a : "—", W / 2, 1110);
      x.fillStyle = "#8da3c0"; x.font = "30px system-ui, sans-serif";
      x.fillText("Goles esperados " + p.lh.toFixed(1) + " – " + p.la.toFixed(1) +
        "   ·   Confianza " + p.conf.label, W / 2, 1165);
    } else {
      x.textAlign = "center"; x.fillStyle = "#8da3c0"; x.font = "40px system-ui, sans-serif";
      x.fillText("Sin historial suficiente para estimar", W / 2, 800);
      x.textAlign = "left";
    }

    x.textAlign = "center";
    x.fillStyle = "#6b7f99"; x.font = "27px system-ui, sans-serif";
    x.fillText("Estimación estadística · no es una garantía · +18 si se usa en apuestas", W / 2, 1252);
    x.fillStyle = "#22e39a"; x.font = "30px system-ui, sans-serif";
    x.fillText(BRAND.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), W / 2, 1302);

    return c;
  }

  /* ===== PWA ================================================== */
  function registerSW() {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.register) return;
    var ok = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!ok) return;
    navigator.serviceWorker.register("sw.js").catch(function () { /* ignora */ });
  }

  /* ===== Selector de país / zona horaria ====================== */
  function buildCountrySelect() {
    var sel = $("sel-country");
    if (!sel) return;
    var opts = ['<option value="">🌐 Automático · ' + esc(detectedTz) + "</option>"];
    COUNTRIES.forEach(function (c) {
      opts.push('<option value="' + c.code + '">' + c.flag + " " + esc(c.name) + "</option>");
    });
    sel.innerHTML = opts.join("");
    sel.value = prefs.country || "";
    sel.addEventListener("change", function () {
      prefs.country = sel.value;
      savePrefs();
      refreshDayKeys();
      toast("Horarios en hora de " + tzLabel() + " (" + gmtLabel() + ").");
      if (isActive()) renderHoy();
    });
  }

  /* ===== init ================================================= */
  function init() {
    applyBrand();
    applyMode();
    refreshDayKeys();
    buildCountrySelect();
    watchRetired();
    var btn = $("btn-mode");
    if (btn) btn.addEventListener("click", toggleMode);
    registerSW();
  }

  /* Un partido que la fuente da por terminado: se retira de la portada en el acto
     (sin esperar a la ventana de cierre por tiempo). */
  function matchEnded(key) {
    if (!key) return;
    liveState[key] = { state: "post", ts: Date.now() };
    if (isActive()) renderList();
  }

  window.AD.v2 = {
    onShowView: onShowView,
    onDataChanged: onDataChanged,
    renderHoy: renderHoy,
    matchEnded: matchEnded,
    toggleMode: toggleMode,
    applyMode: applyMode,
    brand: BRAND,
    teamDisplayName: dispName,
    whenText: whenText
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
