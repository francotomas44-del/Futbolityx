import { HttpError } from "../errors.js";

function numOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  var n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function requiredId(value, field, index) {
  var id = value === null || value === undefined ? "" : String(value).trim();
  if (!id) {
    throw new HttpError(400, "invalid_match", "Partido invalido: falta " + field + ".", { index: index, field: field });
  }
  if (id.length > 128) {
    throw new HttpError(400, "invalid_match", "Partido invalido: " + field + " es demasiado largo.", { index: index, field: field });
  }
  return id;
}

function requiredGoals(value, field, index) {
  var n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 99) {
    throw new HttpError(400, "invalid_match", "Partido invalido: " + field + " debe ser un numero entre 0 y 99.", { index: index, field: field });
  }
  return Math.floor(n);
}

export function normalizeTeam(team, index) {
  if (!team || typeof team !== "object") {
    throw new HttpError(400, "invalid_team", "Equipo invalido.", { index: index });
  }
  var id = team.id === null || team.id === undefined ? "" : String(team.id).trim();
  if (!id || id.length > 128) {
    throw new HttpError(400, "invalid_team", "Equipo invalido: id requerido.", { index: index });
  }
  return {
    id: id,
    name: String(team.name || id).trim().slice(0, 120) || id
  };
}

export function normalizeMatch(match, index) {
  if (!match || typeof match !== "object") {
    throw new HttpError(400, "invalid_match", "Partido invalido.", { index: index });
  }

  return {
    id: match.id === null || match.id === undefined ? "m" + index : String(match.id),
    date: String(match.date || ""),
    competition: String(match.competition || ""),
    competitionId: match.competitionId === null || match.competitionId === undefined ? null : String(match.competitionId),
    homeId: requiredId(match.homeId, "homeId", index),
    awayId: requiredId(match.awayId, "awayId", index),
    homeGoals: requiredGoals(match.homeGoals, "homeGoals", index),
    awayGoals: requiredGoals(match.awayGoals, "awayGoals", index),
    homeCorners: numOrNull(match.homeCorners),
    awayCorners: numOrNull(match.awayCorners),
    homeCards: numOrNull(match.homeCards),
    awayCards: numOrNull(match.awayCards),
    homeYellow: numOrNull(match.homeYellow),
    awayYellow: numOrNull(match.awayYellow),
    homeRed: numOrNull(match.homeRed),
    awayRed: numOrNull(match.awayRed),
    refereeId: match.refereeId === null || match.refereeId === undefined ? null : String(match.refereeId),
    refereeName: String(match.refereeName || ""),
    neutral: !!match.neutral,
    source: String(match.source || "api"),
    externalId: match.externalId === null || match.externalId === undefined ? null : String(match.externalId)
  };
}

export function validateAnalysisPayload(body, limits) {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_body", "El cuerpo debe ser un objeto JSON.");
  }

  var homeId = body.homeId === null || body.homeId === undefined ? "" : String(body.homeId).trim();
  var awayId = body.awayId === null || body.awayId === undefined ? "" : String(body.awayId).trim();
  if (!homeId || !awayId) {
    throw new HttpError(400, "invalid_body", "homeId y awayId son obligatorios.");
  }
  if (homeId === awayId) {
    throw new HttpError(400, "invalid_body", "homeId y awayId deben ser distintos.");
  }

  if (!Array.isArray(body.matches) || body.matches.length === 0) {
    throw new HttpError(400, "invalid_body", "matches debe ser un array con al menos un partido.");
  }
  if (body.matches.length > limits.maxMatches) {
    throw new HttpError(413, "payload_too_large", "Demasiados partidos: maximo " + limits.maxMatches + ".");
  }

  if (!Array.isArray(body.teams) || body.teams.length === 0) {
    throw new HttpError(400, "invalid_body", "teams debe ser un array con los equipos.");
  }
  if (body.teams.length > limits.maxTeams) {
    throw new HttpError(413, "payload_too_large", "Demasiados equipos: maximo " + limits.maxTeams + ".");
  }

  var teams = body.teams.map(normalizeTeam);
  var teamIds = {};
  teams.forEach(function (team) { teamIds[team.id] = true; });
  if (!teamIds[homeId] || !teamIds[awayId]) {
    throw new HttpError(400, "invalid_body", "teams debe incluir al local y al visitante.");
  }

  var matches = body.matches.map(normalizeMatch);

  return {
    matches: matches,
    teams: teams,
    cfg: {
      homeId: homeId,
      awayId: awayId,
      competition: body.competition ? String(body.competition).slice(0, 160) : "",
      kickoff: body.kickoff ? String(body.kickoff).slice(0, 80) : "",
      recency: numOrNull(body.recency),
      restHome: numOrNull(body.restHome),
      restAway: numOrNull(body.restAway),
      lineups: !!body.lineups,
      homeBajas: !!body.homeBajas,
      awayBajas: !!body.awayBajas,
      meteo: !!body.meteo
    }
  };
}
