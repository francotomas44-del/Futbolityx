import { config } from "../../server/src/config.js";
import { getAccountService } from "../_lib/auth.js";
import { applyCors, handleError, methodNotAllowed, readJson, sendJson } from "../_lib/http.js";
import { rateLimit } from "../_lib/rate-limit.js";

function publicBase(req) {
  if (config.apiPublicUrl) return String(config.apiPublicUrl).replace(/\/+$/, "");
  var proto = req.headers["x-forwarded-proto"] || "https";
  var host = req.headers.host || "localhost";
  return proto + "://" + host;
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST", "OPTIONS"]);
  }

  try {
    rateLimit(req, "auth-magic-link", 5, 60 * 60 * 1000);

    var body = await readJson(req);
    var email = String(body.email || "").trim();
    if (!email) {
      return sendJson(res, 400, {
        error: { code: "invalid_email", message: "Ingresa un email valido." }
      });
    }

    var result = await getAccountService().requestMagicLink(email, {
      callbackUrl: publicBase(req) + "/api/auth/callback",
      exposeDevLink: config.auth.devMode && !config.isProduction
    });

    sendJson(res, 200, { ok: true, devLink: result.devLink || null });
  } catch (error) {
    handleError(res, error, "auth-magic-link");
  }
}
