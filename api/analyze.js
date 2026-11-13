import { computeAnalysis } from "../server/src/lib/analysis.js";
import { validateAnalysisPayload } from "../server/src/lib/validate.js";
import { requireApiKey } from "./_lib/auth.js";
import { applyCors, handleError, methodNotAllowed, readJson, sendJson } from "./_lib/http.js";
import { rateLimit } from "./_lib/rate-limit.js";
import { config } from "../server/src/config.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST", "OPTIONS"]);
  }

  try {
    rateLimit(req, "analyze", 20, 60 * 1000);
    await requireApiKey(req, "analyze");

    var body = await readJson(req, config.bodyLimit);
    var payload = validateAnalysisPayload(body, config.analyze);
    var result = computeAnalysis(payload);

    sendJson(res, 200, result, { "cache-control": "no-store" });
  } catch (error) {
    handleError(res, error, "analyze");
  }
}
