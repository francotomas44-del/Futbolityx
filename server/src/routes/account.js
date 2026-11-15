import { clearSessionCookie, getSessionToken, serializeSessionCookie } from "../lib/accounts/cookies.js";

function joinUrl(base, path) {
  return String(base || "").replace(/\/+$/, "") + path;
}

function publicBase(request, config) {
  if (config.apiPublicUrl) {
    return String(config.apiPublicUrl).replace(/\/+$/, "");
  }

  var protocol = request.protocol || "http";
  var host = request.headers.host || "127.0.0.1:8787";
  return protocol + "://" + host;
}

export default async function accountRoutes(app, opts) {
  var config = opts.config;
  var accountService = opts.accountService;
  var requireSession = opts.requireSession;

  app.post("/v1/auth/magic-link", {
    schema: {
      body: {
        type: "object",
        required: ["email"],
        additionalProperties: false,
        properties: {
          email: { type: "string", maxLength: 254 }
        }
      }
    },
    config: {
      rateLimit: { max: 5, timeWindow: "1 hour" }
    }
  }, async function (request) {
    var callbackUrl = publicBase(request, config) + "/v1/auth/callback";
    var result = await accountService.requestMagicLink(request.body.email, {
      callbackUrl: callbackUrl,
      exposeDevLink: config.auth.devMode && !config.isProduction
    });

    return {
      ok: true,
      devLink: result.devLink || null
    };
  });

  app.get("/v1/auth/callback", {
    schema: {
      querystring: {
        type: "object",
        required: ["token"],
        additionalProperties: false,
        properties: {
          token: { type: "string", maxLength: 512 }
        }
      }
    }
  }, async function (request, reply) {
    try {
      var result = await accountService.consumeMagicLink(request.query.token, {
        ip: request.ip,
        userAgent: request.headers["user-agent"]
      });

      reply.header("set-cookie", serializeSessionCookie(result.sessionToken, {
        name: config.auth.sessionCookie,
        maxAge: config.auth.sessionDays * 24 * 60 * 60,
        secure: config.isProduction
      }));

      return reply.redirect(joinUrl(config.appUrl, "/?auth=ok"));
    } catch (error) {
      request.log.warn({ err: error }, "magic link invalido");
      return reply.redirect(joinUrl(config.appUrl, "/?auth=invalid"));
    }
  });

  app.post("/v1/auth/logout", async function (request, reply) {
    var token = getSessionToken(request.headers.cookie, config.auth.sessionCookie);
    await accountService.logout(token);

    reply.header("set-cookie", clearSessionCookie({
      name: config.auth.sessionCookie,
      secure: config.isProduction
    }));

    return { ok: true };
  });

  app.get("/v1/account", {
    preHandler: [requireSession]
  }, async function (request) {
    return accountService.getAccount(request.sessionToken);
  });
}
