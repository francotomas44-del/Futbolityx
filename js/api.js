/* api.js - cliente del backend de Futbolityx.
   ---------------------------------------------------------------
   La app sigue funcionando sin backend. Cuando exista una URL, estas
   funciones permiten usar cuentas, planes, el motor y los datos en vivo
   desde el servidor.

   Configuracion (antes de cargar este script):
     window.FUTBOLITYX_API = {
       base: "https://api.futbolityx.com",
       key: "futbolityx_web_...",   // opcional, solo server-to-server
       timeoutMs: 15000
     };

   La key del navegador es publica. Para usuarios finales se usa la cookie
   de sesion creada por el magic link; el backend resuelve el plan y las
   cuotas. La key queda para integraciones server-to-server.
*/
(function () {
  "use strict";

  window.AD = window.AD || {};

  var config = window.FUTBOLITYX_API || {};
  var base = String(config.base || "").replace(/\/+$/, "");
  var key = String(config.key || "");
  var timeoutMs = Number(config.timeoutMs || 15000);

  function isConfigured() {
    return !!base;
  }

  function hasKey() {
    return !!key;
  }

  function apiError(message, code, status) {
    var error = new Error(message);
    error.code = code || "api_error";
    error.status = status || 0;
    return error;
  }

  async function request(path, options) {
    options = options || {};

    if (!isConfigured()) {
      throw apiError("El backend no esta configurado.", "api_not_configured", 0);
    }

    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    var headers = {};
    if (key) headers["X-API-Key"] = key;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    try {
      var response = await fetch(base + path, {
        method: options.method || "GET",
        headers: headers,
        credentials: "include",
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      });

      var data = null;
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }

      if (!response.ok) {
        var payload = data && data.error ? data.error : {};
        throw apiError(
          payload.message || ("HTTP " + response.status),
          payload.code || "http_error",
          response.status
        );
      }

      return data;
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw apiError("El backend tardo demasiado en responder.", "timeout", 0);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  window.AD.api = {
    version: "0.2.0",
    isConfigured: isConfigured,
    hasKey: hasKey,
    base: function () {
      return base;
    },
    config: function () {
      return { base: base, timeoutMs: timeoutMs, hasKey: !!key };
    },
    configure: function (next) {
      next = next || {};
      if (next.base !== undefined) base = String(next.base || "").replace(/\/+$/, "");
      if (next.key !== undefined) key = String(next.key || "");
      if (next.timeoutMs !== undefined) timeoutMs = Number(next.timeoutMs || 15000);
      return { base: base, timeoutMs: timeoutMs, hasKey: !!key };
    },
    health: function () {
      return request("/v1/health");
    },
    meta: function () {
      return request("/v1/meta");
    },
    plans: function () {
      return request("/v1/plans");
    },
    analyze: function (payload) {
      return request("/v1/analyze", { method: "POST", body: payload });
    },
    liveScoreboard: function (league, date) {
      var query = "league=" + encodeURIComponent(league);
      if (date) query += "&date=" + encodeURIComponent(date);
      return request("/v1/live/scoreboard?" + query);
    },
    liveSummary: function (league, event) {
      return request(
        "/v1/live/summary?league=" + encodeURIComponent(league) + "&event=" + encodeURIComponent(event)
      );
    },
    requestMagicLink: function (email) {
      return request("/v1/auth/magic-link", { method: "POST", body: { email: email } });
    },
    logout: function () {
      return request("/v1/auth/logout", { method: "POST" });
    },
    account: function () {
      return request("/v1/account");
    },
    checkout: function (payload) {
      return request("/v1/billing/checkout", { method: "POST", body: payload });
    },
    cancelSubscription: function () {
      return request("/v1/billing/cancel", { method: "POST" });
    }
  };
})();
