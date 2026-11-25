import { buildAuthenticator, requireScope } from "../../server/src/auth.js";
import { config } from "../../server/src/config.js";
import { AccountService } from "../../server/src/lib/accounts/service.js";
import { createFirebaseVerifier } from "../../server/src/lib/firebase-auth.js";
import { getSessionToken } from "../../server/src/lib/accounts/cookies.js";
import { HttpError } from "../../server/src/errors.js";
import { getIp } from "./http.js";

var authenticate = buildAuthenticator(config);
var accountService = null;
var firebaseVerifier = null;

function service() {
  if (!accountService) {
    try {
      accountService = new AccountService();
    } catch (error) {
      throw new HttpError(503, "database_not_configured", "La base de datos no esta configurada.");
    }
  }
  return accountService;
}

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

/**
 * Acepta API key o sesion de usuario. Devuelve el contexto de autenticacion.
 */
export async function requireAnyAuth(req, scope) {
  if (req.headers["x-api-key"]) {
    var keyAuth = await requireApiKey(req, scope);
    return { kind: "api_key", auth: keyAuth, account: null, sessionToken: null };
  }

  var token = getSessionToken(req.headers.cookie, config.auth.sessionCookie);
  if (!token) {
    throw new HttpError(401, "missing_api_key", "Falta X-API-Key o una sesion.");
  }

  var session;
  try {
    session = await service().getSession(token);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "database_not_configured", "La base de datos no esta configurada.");
  }

  if (!session) {
    throw new HttpError(401, "authentication_required", "La sesion vencio. Inicia sesion de nuevo.");
  }

  return { kind: "session", auth: null, account: session, sessionToken: token };
}

export async function requireSession(req) {
  var token = getSessionToken(req.headers.cookie, config.auth.sessionCookie);
  if (!token) {
    throw new HttpError(401, "authentication_required", "Inicia sesion para continuar.");
  }

  var session;
  try {
    session = await service().getSession(token);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "database_not_configured", "La base de datos no esta configurada.");
  }

  if (!session) {
    throw new HttpError(401, "authentication_required", "La sesion vencio. Inicia sesion de nuevo.");
  }

  return { session: session, token: token };
}

export function requireFeature(auth, feature) {
  if (!auth || !auth.account) return;
  var features = auth.account.entitlements.features || {};
  if (features[feature]) return;
  throw new HttpError(403, "upgrade_required", "Esta funcion requiere un plan superior.");
}

export function getAccountService() {
  return service();
}

export function getFirebaseVerifier() {
  if (!firebaseVerifier) {
    firebaseVerifier = createFirebaseVerifier(config.firebase);
  }
  return firebaseVerifier;
}

export function setFirebaseVerifier(value) {
  firebaseVerifier = value;
}

export { config };
