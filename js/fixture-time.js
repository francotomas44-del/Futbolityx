/* fixture-time.js — fechas y horarios reales para partidos sin hora
   ----------------------------------------------------------------
   Algunas bases históricas guardan una sola fecha por jornada y dejan el
   campo `time` vacío. La portada "Hoy" mostrábala como "Hoy · hora por
   confirmar" aunque el partido fuera otro día. Este módulo consulta el
   marcador de ESPN sólo para esos partidos próximos, reemplaza la fecha y
   la hora por las reales (en UTC explícito, para que v2.js las convierta a
   la zona del usuario) y agrega los encuentros que faltaban en la base.

   Namespace: window.AD.fixtureTime */
(function () {
  "use strict";

  window.AD = window.AD || {};

  var API = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
  var LS_KEY = "futbolityx:fixture-time:v1";
  var TTL = 30 * 60 * 1000;   /* media hora */
  var DAYS = 14;              /* horizonte a enriquecer */
  var memCache = null;

  /* Nombres que no aportan a la comparación de equipos. */
  var STOP = {
    "fc": 1, "af": 1, "ec": 1, "sc": 1, "ac": 1, "ca": 1, "cr": 1, "cd": 1,
    "cf": 1, "sd": 1, "ud": 1, "ad": 1, "ssc": 1, "ss": 1, "as": 1, "os": 1, "if": 1, "fk": 1,
    "sk": 1, "bk": 1, "afc": 1, "fbc": 1, "club": 1, "clube": 1, "the": 1,
    "de": 1, "do": 1, "da": 1, "dos": 1, "das": 1, "association": 1,
    "associacao": 1, "sport": 1, "sporting": 1, "rb": 1
  };

  /* Formas abreviadas frecuentes en las bases locales. */
  var NAME_FIX = {
    "atletico paranaense": "atletico paranaense",
    "paranaense": "atletico paranaense",
    "clube do remo": "remo",
    "ca mineiro": "atletico mineiro",
    "atletico mineiro": "atletico mineiro",
    "sc corinthians paulista": "corinthians",
    "corinthians paulista": "corinthians",
    "cr vasco da gama": "vasco da gama",
    "rb bragantino": "red bull bragantino",
    "bragantino": "red bull bragantino",
    "chapecoense af": "chapecoense",
    "cruzeiro ec": "cruzeiro",
    "fluminense fc": "fluminense",
    "mirassol fc": "mirassol",
    "botafogo fr": "botafogo",
    "sao paulo fc": "sao paulo",
    "sao paulo": "sao paulo"
  };

  function normalize(s) {
    var t = String(s == null ? "" : s).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
    var tokens = t ? t.split(/\s+/) : [];
    tokens = tokens.map(function (x) { return x === "athletico" ? "atletico" : x; });
    tokens = tokens.filter(function (x) { return x && !STOP[x]; });
    var k = tokens.join(" ");
    return NAME_FIX[k] || k;
  }

  function nameScore(a, b) {
    var na = normalize(a), nb = normalize(b);
    if (!na || !nb) return 0;
    if (na === nb) return 100;
    if (na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0) return 80;
    var A = na.split(" "), B = nb.split(" ");
    var common = A.filter(function (x) { return B.indexOf(x) >= 0; }).length;
    var j = common / Math.min(A.length, B.length);
    return j >= 0.6 ? Math.round(50 + 40 * j) : Math.round(40 * j);
  }

  function loadCache() {
    if (memCache) return memCache;
    try {
      var o = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      memCache = (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
    } catch (e) { memCache = {}; }
    return memCache;
  }

  function saveCache(o) {
    memCache = o;
    try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) { /* sin espacio: seguimos en memoria */ }
  }

  function nextDay(ds) {
    var d = new Date(ds + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  function prevDay(ds) {
    var d = new Date(ds + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /* "Remo at Athletico Paranaense" -> local: Athletico Paranaense, visita: Remo */
  function eventTeams(e) {
    var name = String(e.name || "");
    var parts = name.split(/\s+at\s+/i);
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return { home: parts[1].trim(), away: parts[0].trim() };
    }
    var cs = (e.competitions && e.competitions[0] && e.competitions[0].competitors) || [];
    var h = null, a = null;
    cs.forEach(function (c) {
      if (c.homeAway === "home") h = c.team;
      if (c.homeAway === "away") a = c.team;
    });
    function label(t) {
      return t && (t.shortDisplayName || t.displayName || t.name) || "";
    }
    return { home: label(h), away: label(a) };
  }

  function competitionFor(code, fixtures) {
    for (var i = 0; i < fixtures.length; i++) {
      if (fixtures[i] && fixtures[i].code === code && fixtures[i].competition) return fixtures[i].competition;
    }
    var known = window.AD.dataset && window.AD.dataset.leagues;
    return (known && known[code]) || code;
  }

  function toFixture(e, code, competition) {
    var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(e.date || ""));
    var t = eventTeams(e);
    if (!m || !t.home || !t.away) return null;
    return {
      code: code,
      competition: competition,
      date: m[1],
      time: m[2] + ":" + m[3] + " UTC+0",
      home: t.home,
      away: t.away,
      externalId: "espn:" + e.id,
      source: "espn-time",
      state: e.state || "pre"
    };
  }

  /* Partidos próximos sin hora -> fecha/hora real desde ESPN. Nunca lanza:
     si la fuente falla, la lista sigue funcionando con el fallback honesto. */
  function enrich(fixtures) {
    fixtures = fixtures || [];
    if (!window.AD.live || !window.AD.live.slugForCode) return Promise.resolve(fixtures);

    var today = new Date().toISOString().slice(0, 10);
    var limit = new Date(Date.now() + DAYS * 86400000).toISOString().slice(0, 10);
    var candidates = fixtures.filter(function (f) {
      return f && !f.time && f.date && f.date >= today && f.date <= limit &&
        window.AD.live.slugForCode(f.code);
    });
    if (!candidates.length) return Promise.resolve(fixtures);

    /* Sólo consultamos los días que aparecen en la base (más un margen de un
       día por corrimientos de medianoche). Nada de barrer la temporada entera. */
    var datesByCode = {};
    candidates.forEach(function (f) {
      var set = datesByCode[f.code] || (datesByCode[f.code] = {});
      set[f.date] = 1;
      set[prevDay(f.date)] = 1;
      set[nextDay(f.date)] = 1;
    });

    var cache = loadCache();
    var jobs = [];
    Object.keys(datesByCode).forEach(function (code) {
      var slug = window.AD.live.slugForCode(code);
      if (!slug) return;
      Object.keys(datesByCode[code]).sort().forEach(function (day) {
        if (day < prevDay(today) || day > nextDay(limit)) return;
        var k = code + "|" + day;
        var rec = cache[k];
        if (rec && Date.now() - rec.ts < TTL) {
          jobs.push(Promise.resolve({ code: code, events: rec.events }));
          return;
        }
        jobs.push(fetch(API + slug + "/scoreboard?dates=" + day.replace(/-/g, "") + "&limit=200")
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            var events = ((j && j.events) || []).map(function (e) {
              return {
                id: e.id, date: e.date, name: e.name,
                state: (e.status && e.status.type && e.status.type.state) || "pre"
              };
            });
            cache[k] = { ts: Date.now(), events: events };
            return { code: code, events: events };
          })
          .catch(function () { return { code: code, events: [] }; }));
      });
    });

    return Promise.all(jobs).then(function (results) {
      saveCache(cache);

      var byCode = {};
      results.forEach(function (r) {
        (r.events || []).forEach(function (e) {
          if (String(e.date || "").slice(0, 10) < today) return;
          var fx = toFixture(e, r.code, competitionFor(r.code, fixtures));
          if (fx) (byCode[r.code] = byCode[r.code] || []).push(fx);
        });
      });

      var used = {}, out = [];
      fixtures.forEach(function (f) {
        if (!f || f.time || !f.date || f.date < today || f.date > limit ||
            !window.AD.live.slugForCode(f.code)) {
          out.push(f);
          return;
        }
        var events = byCode[f.code] || [];
        var best = null, bestScore = 0;
        events.forEach(function (e, i) {
          if (used[f.code + "|" + i]) return;
          var s = nameScore(f.home, e.home) + nameScore(f.away, e.away);
          if (s > bestScore) { bestScore = s; best = { e: e, i: i }; }
        });
        if (best && bestScore >= 130) {
          used[f.code + "|" + best.i] = 1;
          if (best.e.state === "post") return; /* ya terminó: se retira */
          var nf = {};
          Object.keys(f).forEach(function (k) { nf[k] = f[k]; });
          nf.date = best.e.date;
          nf.time = best.e.time;
          nf.externalId = best.e.externalId;
          nf.state = best.e.state;
          nf._timeEnriched = true;
          delete nf._ko; delete nf._kdate; delete nf._ktime;
          out.push(nf);
          return;
        }
        /* Sin horario confirmado: se muestra aparte, con etiqueta honesta. */
        out.push(f);
      });

      /* Partidos reales que la base no tenía. */
      Object.keys(byCode).forEach(function (code) {
        byCode[code].forEach(function (e, i) {
          if (used[code + "|" + i] || e.state === "post") return;
          var dup = out.some(function (x) { return x && x.externalId === e.externalId; });
          if (!dup) out.push(e);
        });
      });

      return out;
    }).catch(function () { return fixtures; });
  }

  window.AD.fixtureTime = {
    enrich: enrich,
    normalize: normalize,
    nameScore: nameScore
  };
})();
