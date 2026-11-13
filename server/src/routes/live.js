import { createUpstream } from "../lib/upstream.js";
import { HttpError } from "../errors.js";

var LEAGUES = new Set([
  "eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "ned.1", "por.1", "aut.1",
  "bel.1", "sui.1", "gre.1", "tur.1", "sco.1", "rus.1", "mex.1", "arg.1",
  "bra.1", "cze.1", "chn.1", "jpn.1", "aus.1", "col.1", "chi.1", "uru.1",
  "per.1", "bol.1", "ven.1", "usa.1",
  "uefa.champions", "uefa.europa", "uefa.europa.conf",
  "conmebol.libertadores", "conmebol.sudamericana", "conmebol.america",
  "fifa.worldq.conmebol"
]);

var EVENT_ID = /^[A-Za-z0-9_-]{1,80}$/;
var DATE = /^\d{4}-\d{2}-\d{2}$/;

function upstreamBase(league) {
  return "https://site.api.espn.com/apis/site/v2/sports/soccer/" + league;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function cacheHeader(reply, result) {
  reply.header("x-cache", result.cached ? (result.stale ? "STALE" : "HIT") : "MISS");
}

export default async function liveRoutes(app, opts) {
  var config = opts.config;
  var authenticate = opts.authenticate;
  var requireScope = opts.requireScope;
  var upstream = createUpstream(config);

  app.get("/v1/live/scoreboard", {
    preHandler: [authenticate, requireScope("live")],
    schema: {
      querystring: {
        type: "object",
        required: ["league"],
        additionalProperties: false,
        properties: {
          league: { type: "string", maxLength: 64 },
          date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }
        }
      }
    },
    config: {
      rateLimit: { max: 40, timeWindow: "1 minute" }
    }
  }, async function (request, reply) {
    var league = String(request.query.league || "");
    if (!LEAGUES.has(league)) {
      throw new HttpError(400, "invalid_league", "Liga no permitida.");
    }

    var date = request.query.date || today();
    if (!DATE.test(date)) {
      throw new HttpError(400, "invalid_date", "La fecha debe tener formato YYYY-MM-DD.");
    }

    var url = upstreamBase(league) + "/scoreboard?dates=" + date.replace(/-/g, "") + "&limit=200";
    var result = await upstream.fetchJson(url, 30000);

    cacheHeader(reply, result);
    reply.header("cache-control", "public, max-age=30");
    return {
      league: league,
      date: date,
      cached: result.cached,
      stale: result.stale,
      data: result.data
    };
  });

  app.get("/v1/live/summary", {
    preHandler: [authenticate, requireScope("live")],
    schema: {
      querystring: {
        type: "object",
        required: ["league", "event"],
        additionalProperties: false,
        properties: {
          league: { type: "string", maxLength: 64 },
          event: { type: "string", maxLength: 80 }
        }
      }
    },
    config: {
      rateLimit: { max: 40, timeWindow: "1 minute" }
    }
  }, async function (request, reply) {
    var league = String(request.query.league || "");
    if (!LEAGUES.has(league)) {
      throw new HttpError(400, "invalid_league", "Liga no permitida.");
    }

    var event = String(request.query.event || "");
    if (!EVENT_ID.test(event)) {
      throw new HttpError(400, "invalid_event", "Identificador de partido invalido.");
    }

    var url = upstreamBase(league) + "/summary?event=" + encodeURIComponent(event);
    var result = await upstream.fetchJson(url, 20000);

    cacheHeader(reply, result);
    reply.header("cache-control", "public, max-age=20");
    return {
      league: league,
      event: event,
      cached: result.cached,
      stale: result.stale,
      data: result.data
    };
  });
}
