import { getAccountService, requireSession } from "./_lib/auth.js";
import { applyCors, handleError, methodNotAllowed, sendJson } from "./_lib/http.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "OPTIONS"]);
  }

  try {
    var auth = await requireSession(req);
    var account = await getAccountService().getAccount(auth.token);
    sendJson(res, 200, account, { "cache-control": "no-store" });
  } catch (error) {
    handleError(res, error, "account");
  }
}
