import { getAccountService, requireSession } from "../_lib/auth.js";
import { applyCors, handleError, methodNotAllowed, sendJson } from "../_lib/http.js";
import { rateLimit } from "../_lib/rate-limit.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST", "OPTIONS"]);
  }

  try {
    rateLimit(req, "billing-cancel", 5, 60 * 1000);

    var auth = await requireSession(req);
    var result = await getAccountService().cancelSubscription(auth.session);

    sendJson(res, 200, result, { "cache-control": "no-store" });
  } catch (error) {
    handleError(res, error, "billing-cancel");
  }
}
