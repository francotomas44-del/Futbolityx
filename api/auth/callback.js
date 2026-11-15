import { config } from "../../server/src/config.js";
import { getAccountService } from "../_lib/auth.js";
import { serializeSessionCookie } from "../../server/src/lib/accounts/cookies.js";
import { applyCors, getIp, getUrl, handleError, methodNotAllowed, sendJson } from "../_lib/http.js";

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("location", location);
  res.setHeader("cache-control", "no-store");
  res.end();
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "OPTIONS"]);
  }

  try {
    var token = getUrl(req).searchParams.get("token");
    var result = await getAccountService().consumeMagicLink(token, {
      ip: getIp(req),
      userAgent: req.headers["user-agent"]
    });

    res.setHeader("set-cookie", serializeSessionCookie(result.sessionToken, {
      name: config.auth.sessionCookie,
      maxAge: config.auth.sessionDays * 24 * 60 * 60,
      secure: config.isProduction
    }));

    redirect(res, String(config.appUrl).replace(/\/+$/, "") + "/?auth=ok");
  } catch (error) {
    console.warn("[auth] callback invalido", error && error.message);
    redirect(res, String(config.appUrl).replace(/\/+$/, "") + "/?auth=invalid");
  }
}
