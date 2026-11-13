import { computeAnalysis } from "../lib/analysis.js";
import { validateAnalysisPayload } from "../lib/validate.js";

export default async function analyzeRoutes(app, opts) {
  var config = opts.config;
  var authenticate = opts.authenticate;
  var requireScope = opts.requireScope;

  var bodySchema = {
    type: "object",
    required: ["homeId", "awayId", "matches", "teams"],
    additionalProperties: false,
    properties: {
      homeId: { type: "string", minLength: 1, maxLength: 128 },
      awayId: { type: "string", minLength: 1, maxLength: 128 },
      matches: {
        type: "array",
        minItems: 1,
        maxItems: config.analyze.maxMatches,
        items: {
          type: "object",
          required: ["homeId", "awayId", "homeGoals", "awayGoals"],
          additionalProperties: true,
          properties: {
            homeId: { type: "string" },
            awayId: { type: "string" },
            homeGoals: { type: "number" },
            awayGoals: { type: "number" }
          }
        }
      },
      teams: {
        type: "array",
        minItems: 1,
        maxItems: config.analyze.maxTeams,
        items: {
          type: "object",
          required: ["id"],
          additionalProperties: true,
          properties: {
            id: { type: "string" },
            name: { type: "string" }
          }
        }
      },
      competition: { type: "string", maxLength: 160 },
      kickoff: { type: "string", maxLength: 80 },
      recency: { type: ["number", "null"], minimum: 0, maximum: 1 },
      restHome: { type: ["number", "null"], minimum: 0, maximum: 60 },
      restAway: { type: ["number", "null"], minimum: 0, maximum: 60 },
      lineups: { type: "boolean" },
      homeBajas: { type: "boolean" },
      awayBajas: { type: "boolean" },
      meteo: { type: "boolean" }
    }
  };

  app.post("/v1/analyze", {
    preHandler: [authenticate, requireScope("analyze")],
    schema: { body: bodySchema },
    config: {
      rateLimit: { max: 20, timeWindow: "1 minute" }
    }
  }, async function (request, reply) {
    var payload = validateAnalysisPayload(request.body, config.analyze);

    request.log.info({
      keyId: request.auth.keyId,
      homeId: payload.cfg.homeId,
      awayId: payload.cfg.awayId,
      matches: payload.matches.length,
      teams: payload.teams.length
    }, "analyze");

    var result = computeAnalysis(payload);
    reply.header("cache-control", "no-store");
    return result;
  });
}
