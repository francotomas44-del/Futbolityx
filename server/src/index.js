import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { pathToFileURL } from "node:url";

import { config as baseConfig } from "./config.js";
import { buildAuthenticator, requireScope } from "./auth.js";
import { registerErrorHandler } from "./errors.js";
import { createFirebaseVerifier } from "./lib/firebase-auth.js";
import { AccountService } from "./lib/accounts/service.js";
import { buildAuthenticateAny, buildRequireSession, requireFeature } from "./lib/accounts/middleware.js";
import healthRoutes from "./routes/health.js";
import analyzeRoutes from "./routes/analyze.js";
import liveRoutes from "./routes/live.js";
import accountRoutes from "./routes/account.js";
import billingRoutes from "./routes/billing.js";

export async function buildServer(overrides) {
  var config = Object.assign({}, baseConfig, overrides || {});

  var app = Fastify({
    logger: config.env === "test"
      ? false
      : {
          level: config.logLevel,
          redact: ["req.headers.authorization", 'req.headers["x-api-key"]']
        },
    trustProxy: config.trustProxy,
    bodyLimit: config.bodyLimit
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
  });

  // Guardamos el cuerpo crudo para verificar firmas de webhooks.
  app.addContentTypeParser("application/json", { parseAs: "string" }, function (request, body, done) {
    request.rawBody = body;
    try {
      done(null, body ? JSON.parse(body) : {});
    } catch (error) {
      done(error);
    }
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-API-Key", "Authorization"],
    exposedHeaders: ["X-Cache"],
    maxAge: 86400
  });

  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    keyGenerator: function (request) {
      return request.ip;
    }
  });

  registerErrorHandler(app);

  var authenticate = buildAuthenticator(config);
  var accountService = new AccountService();
  var requireSession = buildRequireSession(config, accountService);
  var authenticateAny = buildAuthenticateAny(config, authenticate, accountService);
  var firebaseVerifier = overrides && overrides.firebaseVerifier
    ? overrides.firebaseVerifier
    : createFirebaseVerifier(config.firebase);

  app.get("/", async function () {
    return {
      service: config.service,
      version: config.version,
      docs: "/v1/meta",
      health: "/v1/health",
      plans: "/v1/plans"
    };
  });

  app.get("/v1/whoami", { preHandler: [authenticate] }, async function (request) {
    return {
      keyId: request.auth.keyId,
      scopes: request.auth.scopes,
      ip: request.ip
    };
  });

  await app.register(healthRoutes, { config: config });
  await app.register(accountRoutes, {
    config: config,
    accountService: accountService,
    requireSession: requireSession,
    firebaseVerifier: firebaseVerifier
  });
  await app.register(billingRoutes, {
    config: config,
    accountService: accountService,
    requireSession: requireSession
  });
  await app.register(analyzeRoutes, {
    config: config,
    authenticate: authenticateAny,
    requireScope: requireScope,
    accountService: accountService
  });
  await app.register(liveRoutes, {
    config: config,
    authenticate: authenticateAny,
    requireScope: requireScope,
    requireFeature: requireFeature
  });

  if (!config.apiKeys || !config.apiKeys.length) {
    app.log.warn("API_KEYS esta vacio: las rutas protegidas rechazaran todas las requests.");
  }

  return app;
}

var isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  var app = await buildServer();

  try {
    await app.listen({ port: baseConfig.port, host: baseConfig.host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  ["SIGINT", "SIGTERM"].forEach(function (signal) {
    process.on(signal, async function () {
      try {
        await app.close();
        process.exit(0);
      } catch (error) {
        process.exit(1);
      }
    });
  });
}
