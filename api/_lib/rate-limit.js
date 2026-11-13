import { HttpError } from "../../server/src/errors.js";
import { getIp } from "./http.js";

var buckets = new Map();
var MAX_BUCKETS = 10000;

/**
 * Rate limiting best-effort en memoria. En Vercel cada instancia tiene su
 * propia memoria, asi que no reemplaza a un limitador distribuido (Upstash,
 * Vercel KV o Redis). Sirve para frenar abuso basico mientras se configura uno.
 */
export function rateLimit(req, route, max, windowMs) {
  var now = Date.now();
  var key = route + ":" + getIp(req);
  var bucket = buckets.get(key);

  if (!bucket || now >= bucket.reset) {
    bucket = { count: 0, reset: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (buckets.size > MAX_BUCKETS) {
    buckets.clear();
  }

  if (bucket.count > max) {
    throw new HttpError(429, "rate_limited", "Demasiadas solicitudes. Intenta de nuevo en unos segundos.");
  }
}
