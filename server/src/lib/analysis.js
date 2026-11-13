import { stats as ST } from "./stats.js";

function num2(value) {
  return Number(value).toFixed(2);
}

/**
 * Misma cadena de calculo que usa el frontend (js/app.js computeAnalysis),
 * pero con los partidos y equipos recibidos por la API. Mantener esta funcion
 * en el servidor permite mover el motor a un entorno controlado y, mas
 * adelante, alimentarlo con datos que el cliente no recibe.
 */
export function computeAnalysis(input) {
  var matches = input.matches;
  var cfg = input.cfg;
  var home = null;
  var away = null;

  (input.teams || []).forEach(function (team) {
    if (team.id === cfg.homeId) home = team;
    if (team.id === cfg.awayId) away = team;
  });

  // Localia: si el usuario indico una competicion y la localia por competicion
  // esta activa, se usa esa base; si no, la global.
  var perComp = !!(ST.config.compHomeAdv && cfg.competition);
  var base = perComp ? ST.competitionBaseline(matches, cfg.competition) : ST.leagueBaselines(matches);

  var compLow2 = String(cfg.competition || "").toLowerCase();
  var isArg2 = compLow2.indexOf("arg") >= 0 || compLow2.indexOf("profesional") >= 0 || compLow2.indexOf("superliga") >= 0;
  var recencyUse = cfg.recency;
  if (isArg2 && (recencyUse == null || recencyUse === "")) {
    // En Argentina damos un poco mas de peso a la forma reciente por defecto.
    recencyUse = Math.max(recencyUse || 0, 0.42);
  } else if (isArg2 && typeof recencyUse === "number") {
    recencyUse = Math.min(0.6, Math.max(0.35, recencyUse + 0.07));
  }

  var hs = ST.teamStats(cfg.homeId, matches, recencyUse);
  var as = ST.teamStats(cfg.awayId, matches, recencyUse);

  var eg = ST.expectedGoals(hs, as, base);
  var lh = eg.home;
  var la = eg.away;

  var adjustments = [];
  if (cfg.homeBajas) { lh *= 0.94; adjustments.push("Bajas importantes del local: -6% en su ataque esperado."); }
  if (cfg.awayBajas) { la *= 0.94; adjustments.push("Bajas importantes del visitante: -6% en su ataque esperado."); }
  if (cfg.meteo) { lh *= 0.96; la *= 0.96; adjustments.push("Clima adverso previsto: -4% en los goles esperados de ambos."); }
  var restDiff = (cfg.restHome || 0) - (cfg.restAway || 0);
  if (restDiff >= 3) {
    lh *= 1.02;
    adjustments.push("El local descanso " + restDiff + " dias mas: +2% en su ataque esperado.");
  } else if (restDiff <= -3) {
    lh *= 0.98;
    adjustments.push("El local descanso " + Math.abs(restDiff) + " dias menos: -2% en su ataque esperado.");
  }

  lh = ST.clamp(lh, 0.05, 6);
  la = ST.clamp(la, 0.05, 6);

  var matrix = ST.scoreMatrix(lh, la);
  var d = ST.derived(matrix, lh, la);

  // Ensamble con Elo (identico al del backtesting): ajusta las probabilidades 1X2.
  var eloUsed = !!(ST.config.elo && ST.config.elo.weight > 0);
  if (eloUsed) {
    var ratings = ST.eloRatings(matches);
    d.markets = ST.blendElo(d.markets, ratings[cfg.homeId], ratings[cfg.awayId]);
  }

  // Ajuste conservador por Liga Argentina: tiende mas al empate cuando esta parejo.
  try {
    var compLow = String(cfg.competition || "").toLowerCase();
    var isArg = compLow.indexOf("arg") >= 0 || compLow.indexOf("profesional") >= 0 || compLow.indexOf("superliga") >= 0;
    if (isArg && d && d.markets) {
      var mk = d.markets;
      var diff12 = Math.abs(mk.homeWin - mk.awayWin);
      if (diff12 < 0.10 && mk.draw >= 0.24) {
        var shift = Math.min(0.028, (mk.homeWin + mk.awayWin) * 0.07);
        if (mk.draw + shift > 0.36) shift = Math.max(0, 0.36 - mk.draw);
        if (shift > 0.008) {
          mk.homeWin -= shift / 2;
          mk.awayWin -= shift / 2;
          mk.draw += shift;
          var nsArg = mk.homeWin + mk.draw + mk.awayWin;
          if (nsArg > 0) {
            mk.homeWin /= nsArg;
            mk.draw /= nsArg;
            mk.awayWin /= nsArg;
          }
          if (adjustments.indexOf("Ajuste por Liga Profesional Argentina: ligero sesgo hacia empate.") === -1) {
            adjustments.push("Ajuste por Liga Profesional Argentina: ligero sesgo hacia empate.");
          }
        }
      }
    }
  } catch (e) {}

  var sp = ST.setPieces(hs, as, base);
  var sim = ST.simulate(lh, la, 10000, { redCardProb: 0.06 });
  var markov = ST.markovForm(matches, cfg.homeId, cfg.awayId, { recency: cfg.recency });
  var h2h = ST.headToHead(matches, cfg.homeId, cfg.awayId);

  var conf = ST.confidence({
    homeStats: hs,
    awayStats: as,
    hasCornersData: sp.corners.hasData,
    hasCardsData: sp.cards.hasData,
    lineupsConfirmed: cfg.lineups,
    homeBajas: cfg.homeBajas,
    awayBajas: cfg.awayBajas,
    meteo: cfg.meteo
  });

  var notes = [];
  if (hs.matches < 4) notes.push({ warn: true, text: "El local tiene pocos partidos registrados (" + hs.matches + "): estimacion poco fiable." });
  if (as.matches < 4) notes.push({ warn: true, text: "El visitante tiene pocos partidos registrados (" + as.matches + "): estimacion poco fiable." });
  if (perComp) {
    notes.push({
      warn: false,
      text: "Localia ajustada por la competicion «" + cfg.competition + "» (" + base.matches.toLocaleString("es") +
        " partidos de esa competicion): casa " + num2(base.homeGoals) + " goles, visita " + num2(base.awayGoals) + "."
    });
  }
  if (eloUsed) {
    notes.push({
      warn: false,
      text: "Resultado final (1X2): ensamble del modelo de goles con un rating Elo (peso " +
        Math.round(ST.config.elo.weight * 100) + "%). Los demas mercados derivan del modelo de goles."
    });
  }
  if (!sp.corners.hasData) notes.push({ warn: true, text: "Sin datos de corners: se usan valores de referencia de la liga." });
  if (!sp.cards.hasData) notes.push({ warn: true, text: "Sin datos de tarjetas: se usan valores de referencia de la liga." });
  if (!cfg.lineups) notes.push({ warn: false, text: "Alineaciones no confirmadas: la confianza es menor." });
  if (matches.length < 10) notes.push({ warn: true, text: "Pocos partidos en la liga (" + matches.length + "): los promedios base son fragiles." });
  if (h2h.total) {
    notes.push({
      warn: false,
      text: "Cruces directos registrados: " + h2h.total + " (" + h2h.aWins + " para " + (home ? home.name : "el local") + ", " +
        h2h.draws + " empates, " + h2h.bWins + " para " + (away ? away.name : "el visitante") + ")."
    });
  } else {
    notes.push({ warn: true, text: "Sin cruces directos registrados entre estos equipos: el historial de enfrentamientos no aporta informacion." });
  }
  if (!markov.home.reliable || !markov.away.reliable) {
    notes.push({
      warn: true,
      text: "Cadena de Markov con pocos resultados por equipo (" + markov.home.samples + " del local, " +
        markov.away.samples + " del visitante): la proyeccion de la racha es poco fiable."
    });
  } else if (markov.home.streak.n >= 4 || markov.away.streak.n >= 4) {
    notes.push({
      warn: false,
      text: "Rachas en curso — " + (home ? home.name : "local") + ": " + markov.home.streak.n +
        " partidos; " + (away ? away.name : "visitante") + ": " + markov.away.streak.n + " partidos."
    });
  }

  return {
    input: {
      homeId: cfg.homeId,
      awayId: cfg.awayId,
      homeName: home ? home.name : "Local",
      awayName: away ? away.name : "Visitante",
      kickoff: cfg.kickoff || "",
      competition: cfg.competition || "",
      restHome: cfg.restHome,
      restAway: cfg.restAway,
      recency: cfg.recency,
      lineups: cfg.lineups,
      homeBajas: cfg.homeBajas,
      awayBajas: cfg.awayBajas,
      meteo: cfg.meteo,
      generatedAt: new Date().toISOString()
    },
    output: {
      expectedHome: lh,
      expectedAway: la,
      expectedTotal: lh + la,
      markets: d.markets,
      overLines: d.overLines,
      noGoals: d.noGoals,
      firstGoalHome: d.firstGoalHome,
      firstGoalAway: d.firstGoalAway,
      firstGoalNone: d.firstGoalNone,
      setPieces: sp,
      simulation: sim,
      markov: markov
    },
    homeStats: hs,
    awayStats: as,
    baseline: base,
    confidence: conf,
    headToHead: h2h,
    adjustments: adjustments,
    notes: notes
  };
}
