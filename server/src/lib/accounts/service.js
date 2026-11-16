import crypto from "node:crypto";
import { HttpError } from "../../errors.js";
import { getBillingStatus, getPlan, getPlans } from "../plans.js";
import { cancelPaddleSubscription, createPaddleCheckout } from "../payments/paddle.js";
import {
  cancelMercadoPagoPreapproval,
  createMercadoPagoPreapproval,
  getMercadoPagoPreapproval
} from "../payments/mercadopago.js";
import { sendMagicLinkEmail } from "./email.js";
import { getStore } from "./store.js";

var MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
var USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function normalizeEmail(email) {
  var value = String(email || "").trim().toLowerCase();

  if (!value || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new HttpError(400, "invalid_email", "Ingresa un email valido.");
  }

  return value;
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function expiresIn(ms) {
  return new Date(Date.now() + ms);
}

export function planIdForSubscription(subscription) {
  if (!subscription) return "free";
  if (subscription.status === "expired") return "free";
  if (subscription.status === "canceled" && !subscription.current_period_end) return "free";

  if (subscription.current_period_end) {
    var end = new Date(subscription.current_period_end).getTime();
    if (Number.isFinite(end) && end <= Date.now()) return "free";
  }

  if (
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due" ||
    subscription.status === "canceled"
  ) {
    return subscription.plan || "free";
  }

  return "free";
}

export function getEntitlements(planId) {
  var plan = getPlan(planId);
  return {
    plan: plan.id,
    name: plan.name,
    features: plan.features,
    limits: plan.limits
  };
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: !!user.email_verified_at,
    displayName: user.display_name || null
  };
}

function publicSubscription(subscription) {
  if (!subscription) return null;

  return {
    plan: subscription.plan,
    status: subscription.status,
    provider: subscription.provider || null,
    currentPeriodEnd: subscription.current_period_end || null,
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end
  };
}

function planIdFromProviderId(provider, providerId) {
  if (!providerId) return null;

  var plans = getPlans();
  for (var i = 0; i < plans.length; i++) {
    var plan = plans[i];
    var providers = plan.providers || {};

    if (provider === "paddle" && providers.paddle) {
      if (
        providers.paddle.monthlyPriceId === providerId ||
        providers.paddle.yearlyPriceId === providerId
      ) {
        return plan.id;
      }
    }

    if (provider === "mercadopago" && providers.mercadopago) {
      if (
        providers.mercadopago.monthlyPlanId === providerId ||
        providers.mercadopago.yearlyPlanId === providerId
      ) {
        return plan.id;
      }
    }
  }

  return null;
}

function mapPaddleStatus(status) {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  if (status === "canceled") return "canceled";
  if (status === "paused") return "past_due";
  return "expired";
}

function mapMercadoPagoStatus(status) {
  if (status === "authorized") return "active";
  if (status === "paused") return "past_due";
  if (status === "cancelled") return "canceled";
  if (status === "finished") return "expired";
  return null;
}

export class AccountService {
  constructor(store) {
    this._store = store || null;
  }

  get store() {
    if (!this._store) {
      this._store = getStore();
    }
    return this._store;
  }

  async requestMagicLink(email, options) {
    options = options || {};

    if (!options.callbackUrl) {
      throw new Error("requestMagicLink necesita callbackUrl.");
    }

    var normalized = normalizeEmail(email);
    var user = await this.store.findOrCreateUser(normalized);
    var token = newToken();
    var expiresAt = expiresIn(MAGIC_LINK_TTL_MS);

    await this.store.createLoginToken(user.id, hashToken(token), expiresAt);

    var separator = options.callbackUrl.indexOf("?") === -1 ? "?" : "&";
    var link = options.callbackUrl + separator + "token=" + encodeURIComponent(token);
    var delivery = await sendMagicLinkEmail({ to: normalized, link: link });

    return {
      ok: true,
      devLink: delivery.dev && options.exposeDevLink ? link : null
    };
  }

  async consumeMagicLink(token, context) {
    if (!token) {
      throw new HttpError(400, "missing_token", "Falta el token de acceso.");
    }

    var userId = await this.store.consumeLoginToken(hashToken(token));
    if (!userId) {
      throw new HttpError(400, "invalid_token", "El enlace vencio o ya fue usado.");
    }

    await this.store.markEmailVerified(userId);

    var sessionToken = newToken();
    await this.store.createSession(
      userId,
      hashToken(sessionToken),
      expiresIn(SESSION_TTL_MS),
      context && context.ip,
      context && context.userAgent
    );

    return {
      sessionToken: sessionToken,
      user: await this.store.findUserById(userId)
    };
  }

  async getSession(sessionToken) {
    if (!sessionToken) return null;

    var found = await this.store.findSession(hashToken(sessionToken));
    if (!found) return null;

    var subscription = await this.store.findLatestSubscription(found.user.id);
    var planId = planIdForSubscription(subscription);

    return {
      user: found.user,
      session: found.session,
      subscription: subscription,
      planId: planId,
      entitlements: getEntitlements(planId)
    };
  }

  async getAccount(sessionToken) {
    var session = await this.getSession(sessionToken);
    if (!session) {
      throw new HttpError(401, "authentication_required", "Inicia sesion para continuar.");
    }

    return {
      user: publicUser(session.user),
      plan: session.planId,
      subscription: publicSubscription(session.subscription),
      entitlements: session.entitlements,
      usage: await this.getUsage(session)
    };
  }

  async getUsage(session) {
    var limit = session.entitlements.limits.analysesPerDay;
    var used = await this.store.countUsage(
      session.user.id,
      "analyze",
      new Date(Date.now() - USAGE_WINDOW_MS)
    );

    return {
      analysesLast24h: used,
      analysesPerDay: limit,
      remaining: limit === null ? null : Math.max(0, limit - used)
    };
  }

  async assertAnalyzeAllowed(session) {
    var limit = session.entitlements.limits.analysesPerDay;
    if (limit === null) return;

    var used = await this.store.countUsage(
      session.user.id,
      "analyze",
      new Date(Date.now() - USAGE_WINDOW_MS)
    );

    if (used >= limit) {
      throw new HttpError(
        429,
        "usage_limit",
        "Alcanzaste el limite de analisis de tu plan. Mejora el plan para seguir."
      );
    }
  }

  async recordAnalyze(session) {
    await this.store.recordUsage(session.user.id, "analyze");
  }

  async logout(sessionToken) {
    if (sessionToken) {
      await this.store.deleteSession(hashToken(sessionToken));
    }
  }

  async checkout(session, options) {
    var planId = String(options.planId || "");
    var interval = String(options.interval || "month");
    var provider = String(options.provider || "");

    if (planId !== "pro" && planId !== "elite") {
      throw new HttpError(400, "invalid_plan", "El plan elegido no esta disponible.");
    }

    if (interval !== "month" && interval !== "year") {
      throw new HttpError(400, "invalid_interval", "El periodo debe ser month o year.");
    }

    if (provider !== "paddle" && provider !== "mercadopago") {
      throw new HttpError(400, "invalid_provider", "El medio de pago no esta disponible.");
    }

    if (getBillingStatus().pricingStatus !== "approved") {
      throw new HttpError(503, "pricing_not_approved", "Los precios todavia no estan aprobados para el cobro.");
    }

    if (planIdForSubscription(session.subscription) !== "free") {
      throw new HttpError(
        409,
        "already_subscribed",
        "Ya tenes un plan activo. Para cambiar de plan, cancela la renovacion y espera el final del periodo."
      );
    }

    var plan = getPlan(planId);
    var providers = plan.providers || {};
    var providerConfig = providers[provider];

    if (!providerConfig) {
      throw new HttpError(503, "checkout_not_configured", "El cobro todavia no esta habilitado.");
    }

    if (provider === "paddle") {
      var priceId = interval === "year"
        ? providerConfig.yearlyPriceId
        : providerConfig.monthlyPriceId;

      if (!priceId) {
        throw new HttpError(503, "checkout_not_configured", "Paddle todavia no esta configurado.");
      }

      var paddle = await createPaddleCheckout({
        priceId: priceId,
        email: session.user.email,
        userId: session.user.id
      });

      if (!paddle.checkoutUrl) {
        throw new HttpError(502, "paddle_error", "Paddle no devolvio una URL de pago.");
      }

      return {
        provider: provider,
        plan: planId,
        interval: interval,
        url: paddle.checkoutUrl,
        id: paddle.id
      };
    }

    var planPriceId = interval === "year"
      ? providerConfig.yearlyPlanId
      : providerConfig.monthlyPlanId;

    if (!planPriceId) {
      throw new HttpError(503, "checkout_not_configured", "Mercado Pago todavia no esta configurado.");
    }

    var backUrl = String(
      options.returnUrl ||
      process.env.BILLING_RETURN_URL ||
      process.env.APP_URL ||
      "http://localhost:8766"
    ).replace(/\/+$/, "");

    if (backUrl.indexOf("?") === -1) {
      backUrl += "/?billing=return";
    }

    var mercadoPago = await createMercadoPagoPreapproval({
      planId: planPriceId,
      email: session.user.email,
      userId: session.user.id,
      backUrl: backUrl
    });

    if (!mercadoPago.initPoint) {
      throw new HttpError(502, "mercadopago_error", "Mercado Pago no devolvio una URL de pago.");
    }

    return {
      provider: provider,
      plan: planId,
      interval: interval,
      url: mercadoPago.initPoint,
      id: mercadoPago.id
    };
  }

  async cancelSubscription(session) {
    var subscription = session && session.subscription;

    if (!subscription || subscription.status === "expired") {
      throw new HttpError(404, "no_subscription", "No hay una suscripcion activa para cancelar.");
    }

    if (subscription.status === "canceled" || subscription.cancel_at_period_end) {
      return {
        ok: true,
        status: subscription.status,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.current_period_end || null
      };
    }

    if (!subscription.provider_subscription_id) {
      throw new HttpError(400, "subscription_not_cancelable", "La suscripcion no tiene un identificador del proveedor.");
    }

    if (subscription.provider === "paddle") {
      await cancelPaddleSubscription(subscription.provider_subscription_id);
    } else if (subscription.provider === "mercadopago") {
      await cancelMercadoPagoPreapproval(subscription.provider_subscription_id);
    } else {
      throw new HttpError(400, "subscription_not_cancelable", "La suscripcion no tiene un proveedor cancelable.");
    }

    await this.store.upsertSubscription({
      user_id: subscription.user_id,
      plan: subscription.plan,
      status: subscription.status,
      provider: subscription.provider,
      provider_subscription_id: subscription.provider_subscription_id,
      provider_customer_id: subscription.provider_customer_id || null,
      current_period_start: subscription.current_period_start || null,
      current_period_end: subscription.current_period_end || null,
      cancel_at_period_end: true
    });

    return {
      ok: true,
      status: subscription.status,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription.current_period_end || null
    };
  }

  async processPaddleEvent(event) {
    var eventId = String(event.event_id || event.id || "");
    var eventType = String(event.event_type || event.type || "unknown");

    if (!eventId) {
      throw new HttpError(400, "invalid_event", "El evento de Paddle no tiene id.");
    }

    var recorded = await this.store.recordPaymentEvent("paddle", eventId, eventType, event);
    if (recorded.duplicate && recorded.processed) {
      return { received: true, duplicate: true };
    }

    if (eventType.indexOf("subscription.") === 0) {
      await this.applyPaddleSubscription(event.data || {}, eventType);
    }

    if (recorded.id) {
      await this.store.markPaymentEventProcessed(recorded.id);
    }

    return { received: true, duplicate: recorded.duplicate };
  }

  async applyPaddleSubscription(data, eventType) {
    var subscriptionId = data.id;
    if (!subscriptionId) return;

    var existing = await this.store.findSubscriptionByProviderId("paddle", subscriptionId);
    var customData = data.custom_data || {};
    var userId = customData.user_id || customData.userId || (existing && existing.user_id);

    if (!userId) {
      console.warn("[billing] Evento de Paddle sin user_id", subscriptionId);
      return;
    }

    var item = data.items && data.items[0];
    var priceId = item && item.price ? item.price.id : null;
    var planId = planIdFromProviderId("paddle", priceId);

    if (!planId && !existing) {
      console.warn("[billing] Precio de Paddle desconocido", priceId);
      return;
    }

    var period = data.current_billing_period || {};
    var scheduled = data.scheduled_change || {};
    var status = mapPaddleStatus(data.status);

    if (eventType === "subscription.canceled" && status !== "canceled") {
      status = "canceled";
    }

    await this.store.upsertSubscription({
      user_id: userId,
      plan: planId || existing.plan,
      status: status,
      provider: "paddle",
      provider_subscription_id: subscriptionId,
      provider_customer_id: data.customer_id || null,
      current_period_start: period.starts_at || null,
      current_period_end: period.ends_at || null,
      cancel_at_period_end: scheduled.action === "cancel"
    });
  }

  async processMercadoPagoEvent(event) {
    var eventId = String(event.id || (event.data && event.data.id) || "");
    var eventType = String(event.type || event.action || "unknown");

    if (!eventId) {
      throw new HttpError(400, "invalid_event", "El evento de Mercado Pago no tiene id.");
    }

    var recorded = await this.store.recordPaymentEvent("mercadopago", eventId, eventType, event);
    if (recorded.duplicate && recorded.processed) {
      return { received: true, duplicate: true };
    }

    var isPreapprovalEvent =
      /^preapproval(\.|$)/i.test(eventType) ||
      /^subscription_preapproval(\.|$)/i.test(eventType);
    var preapprovalId = isPreapprovalEvent && event.data && event.data.id;

    if (preapprovalId) {
      var details = await getMercadoPagoPreapproval(preapprovalId);
      await this.applyMercadoPagoPreapproval(details);
    }

    if (recorded.id) {
      await this.store.markPaymentEventProcessed(recorded.id);
    }

    return { received: true, duplicate: recorded.duplicate };
  }

  async applyMercadoPagoPreapproval(details) {
    if (!details || !details.id) return;

    var status = mapMercadoPagoStatus(details.status);
    if (!status) return;

    var existing = await this.store.findSubscriptionByProviderId("mercadopago", details.id);
    var userId = details.external_reference || (existing && existing.user_id);

    if (!userId) {
      console.warn("[billing] Preapproval de Mercado Pago sin external_reference", details.id);
      return;
    }

    var planId = planIdFromProviderId("mercadopago", details.preapproval_plan_id);
    if (!planId && !existing) {
      console.warn("[billing] Plan de Mercado Pago desconocido", details.preapproval_plan_id);
      return;
    }

    var auto = details.auto_recurring || {};
    var periodEnd = auto.end_date || details.next_payment_date || null;

    await this.store.upsertSubscription({
      user_id: userId,
      plan: planId || existing.plan,
      status: status,
      provider: "mercadopago",
      provider_subscription_id: details.id,
      provider_customer_id: details.payer_id ? String(details.payer_id) : null,
      current_period_start: details.date_created || null,
      current_period_end: periodEnd,
      cancel_at_period_end: status === "canceled"
    });
  }
}
