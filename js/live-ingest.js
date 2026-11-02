/* live-ingest.js — Auto-ingesta de partidos finalizados desde ESPN
   ---------------------------------------------------------------
   Cuando un partido pasa a FINALIZADO en la portada "Hoy" (livehoy),
   lo añadimos automáticamente a la base local (S.state.matches) para
   que forme parte del historial, afecte a los promedios por equipo,
   a la evaluación y a futuros análisis.

   Clave para evitar duplicados:
   - Por externalId (id del evento ESPN) si existe
   - Si no, por fecha + equipos normalizados

   Namespace: window.AD.liveIngest */
(function () {
  "use strict";

  window.AD = window.AD || {};

  var S = window.AD.store;

  var LS_KEY = "futbolityx:live:ingested";
  var inFlight = {};

  function readIngested() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var o = raw ? JSON.parse(raw) : null;
      return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
    } catch (e) {
      return {};
    }
  }

  function writeIngested(map) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function norm(s) {
    return String(s == null ? "" : s).trim().toLowerCase();
  }

  function canon(s) {
    try {
      if (S && typeof S.canonicalName === "function") return S.canonicalName(s);
    } catch (e) {}
    // fallback básico
    var t = norm(s).replace(/\s*\([^)]*\)\s*/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ");
    t = t.replace(/\b(fc|cf|ac|afc|cd|sd|ud|rcd|sc|ca|cr)\b/g, " ");
    return t.replace(/\s+/g, " ").trim();
  }

  function keyFor(date, home, away) {
    return (date || "") + "|" + canon(home) + "|" + canon(away);
  }

  function ensureTeam(name) {
    if (!S || !S.state) return null;
    if (!name) return null;
    var c = canon(name);
    // buscar por canonical aproximado
    for (var i = 0; i < S.state.teams.length; i++) {
      var t = S.state.teams[i];
      if (canon(t.name) === c) return t;
    }
    // crear equipo
    try {
      if (typeof S.addTeam === "function") {
        var nt = S.addTeam({ name: String(name).trim(), league: "", source: "live-ingest" });
        return nt || null;
      }
    } catch (e) {}
    // fallback directo
    var id = (S.uid ? S.uid() : ("live-" + Date.now().toString(36) + Math.random().toString(36).slice(2,6)));
    var team = { id: id, name: String(name).trim(), league: "", createdAt: Date.now(), source: "live-ingest" };
    S.state.teams.push(team);
    return team;
  }

  function persistSoon() {
    if (!S) return;
    try {
      if (typeof S.scheduleSave === "function") { S.scheduleSave(); return; }
      if (typeof S.persist === "function") { S.persist(); return; }
    } catch (e) {}
  }

  function ingest(opts) {
    opts = opts || {};
    var eventId = opts.eventId ? String(opts.eventId) : "";
    var date = opts.date || "";
    var competition = opts.competition || "";
    var league = opts.league || competition || "";
    var home = opts.home || "";
    var away = opts.away || "";
    var gh = opts.homeGoals;
    var ga = opts.awayGoals;

    if (!home || !away) return false;
    if (gh == null || ga == null) return false;
    gh = Number(gh); ga = Number(ga);
    if (!isFinite(gh) || !isFinite(ga)) return false;

    if (!S || !S.state) return false;

    var ing = readIngested();
    var lk = eventId ? ("ev:" + eventId) : ("k:" + keyFor(date, home, away));
    if (ing[lk]) return false;
    if (inFlight[lk]) return false;
    inFlight[lk] = true;

    try {
      // evitar duplicados por externalId
      if (eventId) {
        for (var i = 0; i < S.state.matches.length; i++) {
          var m = S.state.matches[i];
          if (m && m.externalId && String(m.externalId) === eventId) {
            ing[lk] = Date.now();
            writeIngested(ing);
            delete inFlight[lk];
            return false;
          }
        }
      }

      // evitar duplicados por clave
      var k2 = keyFor(date, home, away);
      for (var j = 0; j < S.state.matches.length; j++) {
        var mm = S.state.matches[j];
        if (!mm) continue;
        if (keyFor(mm.date, mm.homeName || getTeamName(mm.homeId), mm.awayName || getTeamName(mm.awayId)) === k2) {
          // si ya existe pero no tiene externalId y ahora lo tenemos, lo añadimos
          if (eventId && !mm.externalId) {
            try { mm.externalId = eventId; persistSoon(); } catch (e) {}
          }
          ing[lk] = Date.now();
          writeIngested(ing);
          delete inFlight[lk];
          return false;
        }
      }

      function getTeamName(id) {
        if (!id) return "";
        for (var x = 0; x < S.state.teams.length; x++) {
          if (S.state.teams[x].id === id) return S.state.teams[x].name;
        }
        return "";
      }

      var th = ensureTeam(home);
      var ta = ensureTeam(away);
      if (!th || !ta) {
        delete inFlight[lk];
        return false;
      }

      var match = {
        id: (S.uid ? S.uid() : ("m-live-" + Date.now().toString(36) + Math.random().toString(36).slice(2,8))),
        date: date || "",
        competition: competition || league || "",
        league: league || competition || "",
        homeId: th.id,
        awayId: ta.id,
        homeName: th.name,
        awayName: ta.name,
        homeGoals: gh,
        awayGoals: ga,
        homeCorners: null,
        awayCorners: null,
        homeCards: null,
        awayCards: null,
        homeYellow: null,
        awayYellow: null,
        homeRed: null,
        awayRed: null,
        referee: "",
        source: "live-ingest",
        externalId: eventId || null,
        ingestedAt: Date.now()
      };

      S.state.matches.push(match);

      ing[lk] = Date.now();
      // limpiar entradas viejas (> 30 días) para no crecer sin control
      var now = Date.now();
      var maxAge = 30 * 24 * 60 * 60 * 1000;
      var cleaned = {};
      for (var k in ing) {
        if (ing.hasOwnProperty(k)) {
          if ((now - ing[k]) < maxAge) cleaned[k] = ing[k];
        }
      }
      writeIngested(cleaned);

      persistSoon();
      try { if (typeof window.AD.app && typeof window.AD.app.renderAll === "function") window.AD.app.renderAll(); } catch (e) {}
      delete inFlight[lk];
      return true;
    } catch (e) {
      delete inFlight[lk];
      return false;
    }
  }

  function ingestFromEspn(info) {
    if (!info) return false;
    // intentar extraer fecha
    var date = info.date || info.gameDate || "";
    if (date && date.indexOf("T") >= 0) date = date.slice(0,10);
    return ingest({
      eventId: info.eventId,
      date: date,
      competition: info.competition || info.league || "",
      league: info.league || info.competition || "",
      home: info.home,
      away: info.away,
      homeGoals: info.homeGoals,
      awayGoals: info.awayGoals
    });
  }

  window.AD.liveIngest = {
    ingest: ingest,
    ingestFromEspn: ingestFromEspn,
    _read: readIngested
  };

})();
