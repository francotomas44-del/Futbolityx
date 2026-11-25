import { config, getAccountService, getFirebaseVerifier } from "../_lib/auth.js";
import { serializeSessionCookie } from "../../server/src/lib/accounts/cookies.js";
import { applyCors, getIp, handleError, methodNotAllowed, readJson, sendJson } from "../_lib/http.js";
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
    rateLimit(req, "auth-firebase", 10, 15 * 60 * 1000);

    var body = await readJson(req);
    var idToken = String(body.idToken || "").trim();
    if (!idToken) {
      return sendJson(res, 400, {
        error: { code: "missing_id_token", message: "Falta el token de Firebase." }
      });
    }

    var claims = await getFirebaseVerifier().verify(idToken);
    var result = await getAccountService().authenticateWithFirebase(claims, {
      ip: getIp(req),
      userAgent: req.headers["user-agent"]
    });

    res.setHeader("set-cookie", serializeSessionCookie(result.sessionToken, {
      name: config.auth.sessionCookie,
      maxAge: config.auth.sessionDays * 24 * 60 * 60,
      secure: config.isProduction
    }));

    var account = await getAccountService().getAccount(result.sessionToken);
    sendJson(res, 200, Object.assign({ ok: true }, account), { "cache-control": "no-store" });
  } catch (error) {
    handleError(res, error, "auth-firebase");
  }
}
