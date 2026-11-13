import { HttpError } from "../errors.js";

/**
 * Cliente minimo para las fuentes publicas de datos en vivo.
 * - Cache en memoria con TTL (evita golpear upstream en cada request).
 * - Timeout con AbortController.
 * - Si upstream falla, devuelve la ultima copia cacheada (stale) si existe.
 */
export function createUpstream(config) {
  var cache = new Map();
  var MAX_ENTRIES = 500;

  function read(key) {
    var entry = cache.get(key);
    if (!entry) return null;
    return {
      value: entry.value,
      stale: Date.now() > entry.expires
    };
  }

  function write(key, value, ttlMs) {
    cache.set(key, {
      value: value,
      expires: Date.now() + (ttlMs || config.upstream.cacheMs)
    });

    if (cache.size > MAX_ENTRIES) {
      var oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
  }

  async function fetchJson(url, ttlMs) {
    var cached = read(url);
    if (cached && !cached.stale) {
      return { data: cached.value, cached: true, stale: false };
    }

    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, config.upstream.timeoutMs);

    var response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "user-agent": "FutbolityxAPI/" + config.version
        }
      });
    } catch (error) {
      if (cached) {
        return { data: cached.value, cached: true, stale: true };
      }
      throw new HttpError(502, "upstream_unavailable", "No se pudo consultar la fuente de datos.");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      if (cached) {
        return { data: cached.value, cached: true, stale: true };
      }
      throw new HttpError(502, "upstream_error", "La fuente de datos respondio " + response.status + ".");
    }

    var data;
    try {
      data = await response.json();
    } catch (error) {
      if (cached) {
        return { data: cached.value, cached: true, stale: true };
      }
      throw new HttpError(502, "upstream_invalid", "La fuente de datos devolvio una respuesta invalida.");
    }

    write(url, data, ttlMs);
    return { data: data, cached: false, stale: false };
  }

  return {
    fetchJson: fetchJson
  };
}
