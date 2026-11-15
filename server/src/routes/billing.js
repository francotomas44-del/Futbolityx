import { HttpError } from "../errors.js";
import { verifyPaddleSignature } from "../lib/payments/paddle.js";
import { verifyMercadoPagoSignature } from "../lib/payments/mercadopago.js";

export default async function billingRoutes(app, opts) {
  var config = opts.config;
  var accountService = opts.accountService;
  var requireSession = opts.requireSession;

  app.post("/v1/billing/checkout", {
    preHandler: [requireSession],
    schema: {
      body: {
        type: "object",
        required: ["plan", "interval", "provider"],
        additionalProperties: false,
        properties: {
          plan: { type: "string", enum: ["pro", "elite"] },
          interval: { type: "string", enum: ["month", "year"] },
          provider: { type: "string", enum: ["paddle", "mercadopago"] }
        }
      }
    },
    config: {
      rateLimit: { max: 10, timeWindow: "1 minute" }
    }
  }, async function (request) {
    return accountService.checkout(request.account, {
      planId: request.body.plan,
      interval: request.body.interval,
      provider: request.body.provider,
      returnUrl: config.billing.returnUrl || config.appUrl
    });
  });

  app.post("/v1/webhooks/paddle", {
    config: {
      rateLimit: { max: 300, timeWindow: "1 minute" }
    }
  }, async function (request, reply) {
    var secret = process.env.PADDLE_WEBHOOK_SECRET;
    if (!secret) {
      throw new HttpError(503, "webhook_not_configured", "El webhook de Paddle no esta configurado.");
    }

    var signature = request.headers["paddle-signature"];
    if (!verifyPaddleSignature(request.rawBody || "", signature, secret)) {
      throw new HttpError(401, "invalid_signature", "Firma de Paddle invalida.");
    }

    var result = await accountService.processPaddleEvent(request.body || {});
    reply.header("cache-control", "no-store");
    return result;
  });

  app.post("/v1/webhooks/mercadopago", {
    config: {
      rateLimit: { max: 300, timeWindow: "1 minute" }
    }
  }, async function (request, reply) {
    var secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      throw new HttpError(503, "webhook_not_configured", "El webhook de Mercado Pago no esta configurado.");
    }

    var query = request.query || {};
    var dataId = query["data.id"] ||
      (query.data && query.data.id) ||
      (request.body && request.body.data && request.body.data.id);

    var valid = verifyMercadoPagoSignature({
      dataId: dataId,
      requestId: request.headers["x-request-id"],
      signatureHeader: request.headers["x-signature"],
      secret: secret
    });

    if (!valid) {
      throw new HttpError(401, "invalid_signature", "Firma de Mercado Pago invalida.");
    }

    var result = await accountService.processMercadoPagoEvent(request.body || {});
    reply.header("cache-control", "no-store");
    return result;
  });
}
