import { HttpError } from "../../errors.js";
import { getSessionToken } from "./cookies.js";

export function buildRequireSession(config, accountService) {
  return async function requireSession(request) {
    var token = getSessionToken(request.headers.cookie, config.auth.sessionCookie);
    var session = await accountService.getSession(token);

    if (!session) {
      throw new HttpError(401, "authentication_required", "Inicia sesion para continuar.");
    }

    request.account = session;
    request.sessionToken = token;
    request.auth = {
      kind: "session",
      userId: session.user.id,
      scopes: ["analyze", "live"],
      plan: session.planId,
      role: session.role,
      admin: session.isAdmin
    };
  };
}

/**
 * Acepta una API key (clientes server-to-server) o una sesion de usuario.
 * Las API keys conservan sus scopes y no consumen la cuota del plan.
 */
export function buildAuthenticateAny(config, apiAuthenticate, accountService) {
  return async function authenticateAny(request, reply) {
    if (request.headers["x-api-key"]) {
      await apiAuthenticate(request, reply);
      request.auth.kind = "api_key";
      return;
    }

    var token = getSessionToken(request.headers.cookie, config.auth.sessionCookie);

    if (!token) {
      throw new HttpError(401, "missing_api_key", "Falta X-API-Key o una sesion.");
    }

    var session = await accountService.getSession(token);

    if (!session) {
      throw new HttpError(401, "authentication_required", "La sesion vencio. Inicia sesion de nuevo.");
    }

    request.account = session;
    request.sessionToken = token;
    request.auth = {
      kind: "session",
      userId: session.user.id,
      scopes: ["analyze", "live"],
      plan: session.planId,
      role: session.role,
      admin: session.isAdmin
    };
  };
}

export function requireFeature(feature) {
  return async function checkFeature(request) {
    if (!request.account) return;
    var features = request.account.entitlements.features || {};
    if (features[feature]) return;
    throw new HttpError(
      403,
      "upgrade_required",
      "Esta funcion requiere un plan superior."
    );
  };
}
