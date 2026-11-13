import { config } from "../server/src/config.js";
import { applyCors, methodNotAllowed, sendJson } from "./_lib/http.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "OPTIONS"]);
  }

  sendJson(res, 200, {
    service: config.service,
    version: config.version,
    runtime: "vercel",
    auth: "api-key",
    features: ["analyze", "live-scoreboard", "live-summary"],
    limits: {
      maxMatches: config.analyze.maxMatches,
      maxTeams: config.analyze.maxTeams,
      rateLimit: config.rateLimit
    }
  });
}
