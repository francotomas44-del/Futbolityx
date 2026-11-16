import net from "node:net";
import { HttpError } from "../../server/src/errors.js";

function allowedOrigins() {
  return String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map(function (value) { return value.trim(); })
    .filter(Boolean);
}

/**
 * CORS para Vercel. En produccion el frontend y la API comparten origen, asi
 * que esto solo hace falta si la app se sirve desde GitHub Pages u otro dominio.
 */
export function applyCors(req, res) {
  var origin = req.headers.origin;
  var allowed = allowedOrigins();

  if (origin && (allowed.indexOf("*") !== -1 || allowed.indexOf(origin) !== -1)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-API-Key,Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function sendJson(res, status, body, headers) {
  if (headers) {
    Object.keys(headers).forEach(function (key) {
      res.setHeader(key, headers[key]);
    });
  }

  res.statusCode = status;

  if (status === 204 || body === undefined) {
    res.end();
    return;
  }

  var payload = JSON.stringify(body);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, {
    error: {
      code: "method_not_allowed",
      message: "Metodo no permitido."
    }
  });
}

export function getIp(req) {
  var forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    var first = String(forwarded).split(",")[0].trim();
    if (net.isIP(first)) return first;
  }

  var remote = req.socket && req.socket.remoteAddress;
  return remote && net.isIP(remote) ? remote : "";
}

export function getUrl(req) {
  return new URL(req.url || "/", "http://localhost");
}

export async function readJson(req, maxBytes) {
  var limit = maxBytes || Number(process.env.BODY_LIMIT_BYTES) || 4500000;

  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) {
      return parseJson(req.body.toString("utf8"));
    }
    if (typeof req.body === "string") {
      return parseJson(req.body);
    }
    return req.body;
  }

  return new Promise(function (resolve, reject) {
    var raw = "";
    var size = 0;

    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, "payload_too_large", "El cuerpo de la solicitud es demasiado grande."));
        req.destroy();
        return;
      }
      raw += chunk;
    });

    req.on("end", function () {
      try {
        resolve(parseJson(raw));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", function () {
      reject(new HttpError(400, "invalid_body", "No se pudo leer el cuerpo de la solicitud."));
    });
  });
}

function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new HttpError(400, "invalid_json", "El cuerpo no es JSON valido.");
  }
}

export function handleError(res, error, context) {
  if (error instanceof HttpError) {
    sendJson(res, error.statusCode, {
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    }, { "cache-control": "no-store" });
    return;
  }

  console.error(context || "api_error", error);
  sendJson(res, 500, {
    error: {
      code: "internal_error",
      message: "Error interno del servidor."
    }
  }, { "cache-control": "no-store" });
}
