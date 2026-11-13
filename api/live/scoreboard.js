import { config } from "../../server/src/config.js";
import { createUpstream } from "../../server/src/lib/upstream.js";
import { DATE, isAllowedLeague, scoreboardUrl, today } from "../../server/src/lib/live.js";
import { requireApiKey } from "../_lib/auth.js";
import { applyCors, getUrl, handleError, methodNotAllowed, sendJson } from "../_lib/http.js";
import { rateLimit } from "../_lib/rate-limit.js";
import { HttpError } from "../../server/src/errors.js";

var upstream = createUpstream(config);

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "OPTIONS"]);
  }

  try {
    rateLimit(req, "live-scoreboard", 40, 60 * 1000);
    await requireApiKey(req, "live");

    var params = getUrl(req).searchParams;
    var league = String(params.get("league") || "");
    if (!isAllowedLeague(league)) {
      throw new HttpError(400, "invalid_league", "Liga no permitida.");
    }

    var date = params.get("date") || today();
    if (!DATE.test(date)) {
      throw new HttpError(400, "invalid_date", "La fecha debe tener formato YYYY-MM-DD.");
    }

    var result = await upstream.fetchJson(scoreboardUrl(league, date), 30000);

    sendJson(res, 200, {
      league: league,
      date: date,
      cached: result.cached,
      stale: result.stale,
      data: result.data
    }, {
      "x-cache": result.cached ? (result.stale ? "STALE" : "HIT") : "MISS",
      "cache-control": "public, max-age=30"
    });
  } catch (error) {
    handleError(res, error, "live-scoreboard");
  }
}
