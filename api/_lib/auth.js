import { buildAuthenticator, requireScope } from "../../server/src/auth.js";
import { config } from "../../server/src/config.js";
import { getIp } from "./http.js";

var authenticate = buildAuthenticator(config);

/**
 * Adapta el preHandler de Fastify a una request Node de Vercel.
 * La API key se valida con el mismo codigo que usa el servidor local.
 */
export async function requireApiKey(req, scope) {
  var fakeRequest = {
    headers: req.headers,
    ip: getIp(req),
    auth: null
  };

  await authenticate(fakeRequest);

  if (scope) {
    await requireScope(scope)(fakeRequest);
  }

  return fakeRequest.auth;
}

export { config };
