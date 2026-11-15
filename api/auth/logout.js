import { config } from "../../server/src/config.js";
import { getAccountService } from "../_lib/auth.js";
import { clearSessionCookie, getSessionToken } from "../../server/src/lib/accounts/cookies.js";
import { applyCors, handleError, methodNotAllowed, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST", "OPTIONS"]);
  }

  try {
    var token = getSessionToken(req.headers.cookie, config.auth.sessionCookie);
    await getAccountService().logout(token);

    res.setHeader("set-cookie", clearSessionCookie({
      name: config.auth.sessionCookie,
      secure: config.isProduction
    }));

    sendJson(res, 200, { ok: true });
  } catch (error) {
    handleError(res, error, "auth-logout");
  }
}
