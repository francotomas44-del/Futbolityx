import { requireApiKey } from "./_lib/auth.js";
import { applyCors, getIp, handleError, methodNotAllowed, sendJson } from "./_lib/http.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "OPTIONS"]);
  }

  try {
    var auth = await requireApiKey(req);
    sendJson(res, 200, {
      keyId: auth.keyId,
      scopes: auth.scopes,
      ip: getIp(req)
    });
  } catch (error) {
    handleError(res, error, "whoami");
  }
}
