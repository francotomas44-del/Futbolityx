export var LEAGUES = new Set([
  "eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "ned.1", "por.1", "aut.1",
  "bel.1", "sui.1", "gre.1", "tur.1", "sco.1", "rus.1", "mex.1", "arg.1",
  "bra.1", "cze.1", "chn.1", "jpn.1", "aus.1", "col.1", "chi.1", "uru.1",
  "per.1", "bol.1", "ven.1", "usa.1",
  "uefa.champions", "uefa.europa", "uefa.europa.conf",
  "conmebol.libertadores", "conmebol.sudamericana", "conmebol.america",
  "fifa.worldq.conmebol"
]);

export var EVENT_ID = /^[A-Za-z0-9_-]{1,80}$/;
export var DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isAllowedLeague(league) {
  return LEAGUES.has(String(league || ""));
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

function upstreamBase(league) {
  return "https://site.api.espn.com/apis/site/v2/sports/soccer/" + league;
}

export function scoreboardUrl(league, date) {
  return upstreamBase(league) + "/scoreboard?dates=" + date.replace(/-/g, "") + "&limit=200";
}

export function summaryUrl(league, event) {
  return upstreamBase(league) + "/summary?event=" + encodeURIComponent(event);
}
