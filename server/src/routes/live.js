import { createUpstream } from "../lib/upstream.js";
import { HttpError } from "../errors.js";
import { DATE, EVENT_ID, isAllowedLeague, scoreboardUrl, summaryUrl, today } from "../lib/live.js";

function cacheHeader(reply, result) {
  reply.header("x-cache", result.cached ? (result.stale ? "STALE" : "HIT") : "MISS");
}

export default async function liveRoutes(app, opts) {
  var config = opts.config;
  var authenticate = opts.authenticate;
  var requireScope = opts.requireScope;
  var requireFeature = opts.requireFeature;
  var upstream = createUpstream(config);

  app.get("/v1/live/scoreboard", {
    preHandler: [authenticate, requireScope("live"), requireFeature("live")],
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
    if (!isAllowedLeague(league)) {
      throw new HttpError(400, "invalid_league", "Liga no permitida.");
    }

    var date = request.query.date || today();
    if (!DATE.test(date)) {
      throw new HttpError(400, "invalid_date", "La fecha debe tener formato YYYY-MM-DD.");
    }

    var url = scoreboardUrl(league, date);
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
    preHandler: [authenticate, requireScope("live"), requireFeature("live")],
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
    if (!isAllowedLeague(league)) {
      throw new HttpError(400, "invalid_league", "Liga no permitida.");
    }

    var event = String(request.query.event || "");
    if (!EVENT_ID.test(event)) {
      throw new HttpError(400, "invalid_event", "Identificador de partido invalido.");
    }

    var url = summaryUrl(league, event);
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
