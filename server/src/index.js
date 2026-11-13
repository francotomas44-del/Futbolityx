import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { pathToFileURL } from "node:url";

import { config as baseConfig } from "./config.js";
import { buildAuthenticator, requireScope } from "./auth.js";
import { registerErrorHandler } from "./errors.js";
import healthRoutes from "./routes/health.js";
import analyzeRoutes from "./routes/analyze.js";
import liveRoutes from "./routes/live.js";

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

  await app.register(cors, {
    origin: config.corsOrigins,
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
  await app.register(analyzeRoutes, { config: config, authenticate: authenticate, requireScope: requireScope });
  await app.register(liveRoutes, { config: config, authenticate: authenticate, requireScope: requireScope });

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
