import crypto from "node:crypto";
import { HttpError } from "../errors.js";

/**
 * Verificacion de Firebase ID tokens sin firebase-admin.
 *
 * Firebase firma los ID tokens con RS256 y publica las claves publicas en el
 * endpoint de Google service_accounts. Aca solo necesitamos el projectId del
 * proyecto Firebase (el `aud` del token), no una service account.
 *
 * El backend no confia en el email que manda el navegador: lo toma del token
 * ya verificado y recien ahi aplica la beta cerrada y crea la sesion propia.
 */
var DEFAULT_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;
var CLOCK_SKEW_SECONDS = 60;

function invalid(message) {
  return new HttpError(401, "invalid_firebase_token", message || "El token de Firebase no es valido.");
}

function decodePart(part) {
  try {
    return JSON.parse(Buffer.from(String(part), "base64url").toString("utf8"));
  } catch (error) {
    throw invalid("El token de Firebase esta mal formado.");
  }
}

function cacheMaxAge(response, fallback) {
  var header = response && response.headers && response.headers.get
    ? response.headers.get("cache-control")
    : "";
  var match = /max-age=(\d+)/i.exec(String(header || ""));
  var seconds = match ? Number(match[1]) : 0;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : fallback;
}

export function createFirebaseVerifier(options) {
  options = options || {};

  var projectId = String(options.projectId || "").trim();
  var jwksUrl = String(options.jwksUrl || DEFAULT_JWKS_URL);
  var fetchFn = typeof options.fetch === "function" ? options.fetch : globalThis.fetch;
  var keysLoader = typeof options.keysLoader === "function" ? options.keysLoader : null;
  var now = typeof options.now === "function" ? options.now : function () { return Date.now(); };

  var state = {
    keys: null,
    expiresAt: 0
  };

  async function loadKeys(force) {
    if (!keysLoader && !fetchFn) {
      throw new HttpError(503, "firebase_not_configured", "Firebase no esta configurado en el servidor.");
    }

    if (!force && state.keys && now() < state.expiresAt) return state.keys;

    var keys;
    var maxAge = DEFAULT_MAX_AGE_MS;

    if (keysLoader) {
      keys = await keysLoader(force);
    } else {
      var response = await fetchFn(jwksUrl, {
        headers: { accept: "application/json" }
      });

      if (!response || !response.ok) {
        throw new HttpError(503, "firebase_keys_unavailable", "No pudimos verificar el token de Firebase.");
      }

      maxAge = cacheMaxAge(response, DEFAULT_MAX_AGE_MS);
      var body = await response.json();
      keys = body && Array.isArray(body.keys) ? body.keys : [];
    }

    state.keys = (keys || []).filter(function (key) {
      return key && key.kty === "RSA" && key.alg === "RS256" && key.kid && key.n && key.e;
    });
    state.expiresAt = now() + maxAge;
    return state.keys;
  }

  function findKey(keys, kid) {
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].kid === kid) return keys[i];
    }
    return null;
  }

  function validateClaims(payload) {
    var current = Math.floor(now() / 1000);
    var audience = payload.aud;

    if (Array.isArray(audience)) {
      if (audience.indexOf(projectId) === -1) throw invalid("El token no pertenece a este proyecto Firebase.");
    } else if (audience !== projectId) {
      throw invalid("El token no pertenece a este proyecto Firebase.");
    }

    if (payload.iss !== "https://securetoken.google.com/" + projectId) {
      throw invalid("El emisor del token no es Firebase.");
    }

    if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) {
      throw invalid("El token no tiene un usuario valido.");
    }

    var exp = Number(payload.exp);
    var iat = Number(payload.iat);
    var authTime = payload.auth_time === undefined ? iat : Number(payload.auth_time);

    if (!Number.isFinite(exp) || exp <= current) {
      throw invalid("El token vencio. Volve a ingresar.");
    }

    if (!Number.isFinite(iat) || iat > current + CLOCK_SKEW_SECONDS) {
      throw invalid("El token todavia no es valido.");
    }

    if (!Number.isFinite(authTime) || authTime > current + CLOCK_SKEW_SECONDS) {
      throw invalid("El token todavia no es valido.");
    }

    if (exp - iat > 60 * 60 + CLOCK_SKEW_SECONDS) {
      throw invalid("El token tiene una vigencia invalida.");
    }

    if (typeof payload.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      throw invalid("El token no tiene un email valido.");
    }

    if (payload.email_verified !== true) {
      throw new HttpError(
        403,
        "firebase_email_unverified",
        "Verificá tu email antes de continuar. Te enviamos un mensaje al correo de tu cuenta."
      );
    }

    return {
      uid: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified: true,
      displayName: typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim().slice(0, 120)
        : null,
      provider: payload.firebase && payload.firebase.sign_in_provider
        ? String(payload.firebase.sign_in_provider)
        : null
    };
  }

  return {
    configured: !!projectId,
    projectId: projectId,

    async verify(idToken) {
      if (!projectId) {
        throw new HttpError(503, "firebase_not_configured", "Firebase no esta configurado en el servidor.");
      }

      var parts = String(idToken || "").split(".");
      if (parts.length !== 3) throw invalid();

      var header = decodePart(parts[0]);
      var payload = decodePart(parts[1]);

      if (header.alg !== "RS256" || !header.kid) {
        throw invalid("El token no usa la firma esperada.");
      }

      var claims = validateClaims(payload);
      var keys = await loadKeys(false);
      var key = findKey(keys, header.kid);

      if (!key) {
        keys = await loadKeys(true);
        key = findKey(keys, header.kid);
      }

      if (!key) throw invalid("No encontramos la clave que firmo el token.");

      var publicKey;
      try {
        publicKey = crypto.createPublicKey({ key: key, format: "jwk" });
      } catch (error) {
        throw invalid("La clave publica de Firebase no es valida.");
      }

      var signature;
      try {
        signature = Buffer.from(parts[2], "base64url");
      } catch (error) {
        throw invalid();
      }

      var valid = crypto.verify(
        "RSA-SHA256",
        Buffer.from(parts[0] + "." + parts[1], "utf8"),
        publicKey,
        signature
      );

      if (!valid) throw invalid("La firma del token no es valida.");

      return claims;
    }
  };
}

var defaultVerifier = null;

export function getDefaultFirebaseVerifier(config) {
  if (!defaultVerifier) {
    defaultVerifier = createFirebaseVerifier(config && config.firebase ? config.firebase : {});
  }
  return defaultVerifier;
}

export function setDefaultFirebaseVerifier(value) {
  defaultVerifier = value;
}
