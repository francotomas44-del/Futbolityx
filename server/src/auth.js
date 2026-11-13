import crypto from "node:crypto";
import ipaddr from "ipaddr.js";
import { HttpError } from "./errors.js";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function safeEqualHex(a, b) {
  var left = Buffer.from(String(a), "hex");
  var right = Buffer.from(String(b), "hex");
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function normalizeIp(value) {
  try {
    return ipaddr.process(String(value || ""));
  } catch (e) {
    return null;
  }
}

export function ipMatchesAllowlist(ip, cidrs) {
  if (!cidrs || !cidrs.length) return true;
  var address = normalizeIp(ip);
  if (!address) return false;

  return cidrs.some(function (cidr) {
    try {
      return address.match(ipaddr.parseCIDR(String(cidr)));
    } catch (e) {
      return false;
    }
  });
}

/**
 * Construye el preHandler de autenticacion.
 *
 * La API key identifica al cliente. Si la key viaja en el navegador NO es un
 * secreto: cualquiera puede copiarla. Sirve para rate limiting, revocacion y
 * trazabilidad. La autorizacion real de usuarios/suscripciones se agrega mas
 * adelante con sesiones (JWT) y entitlements.
 */
export function buildAuthenticator(config) {
  var keys = (config.apiKeys || []).map(function (entry) {
    return {
      id: entry.id,
      hash: entry.keyHash || sha256(entry.key),
      scopes: entry.scopes || ["*"],
      ips: entry.ips || []
    };
  });

  return async function authenticate(request, reply) {
    var provided = request.headers["x-api-key"];
    if (!provided) {
      throw new HttpError(401, "missing_api_key", "Falta el encabezado X-API-Key.");
    }

    var hash = sha256(provided);
    var key = null;
    for (var i = 0; i < keys.length; i++) {
      if (safeEqualHex(keys[i].hash, hash)) {
        key = keys[i];
        break;
      }
    }

    if (!key) {
      throw new HttpError(401, "invalid_api_key", "API key invalida.");
    }

    if (key.ips.length && !ipMatchesAllowlist(request.ip, key.ips)) {
      throw new HttpError(403, "ip_not_allowed", "La IP no esta autorizada para esta API key.");
    }

    if (config.ipAllowlist && config.ipAllowlist.length && !ipMatchesAllowlist(request.ip, config.ipAllowlist)) {
      throw new HttpError(403, "ip_not_allowed", "La IP no esta autorizada.");
    }

    request.auth = {
      keyId: key.id,
      scopes: key.scopes
    };
  };
}

export function requireScope(scope) {
  return async function checkScope(request) {
    var scopes = (request.auth && request.auth.scopes) || [];
    if (scopes.indexOf("*") !== -1 || scopes.indexOf(scope) !== -1) return;
    throw new HttpError(403, "insufficient_scope", 'La API key no tiene el permiso "' + scope + '".');
  };
}
