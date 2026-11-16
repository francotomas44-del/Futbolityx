import { test, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.AUTH_DEV_MODE = "true";
process.env.PRICING_STATUS = "approved";
process.env.PADDLE_WEBHOOK_SECRET = "paddle_test_secret";
process.env.MP_WEBHOOK_SECRET = "mp_test_secret";
process.env.PLAN_PADDLE_PRO_MONTHLY = "pri_test_pro";

const { buildServer } = await import("../src/index.js");
const { setStore, MemoryStore } = await import("../src/lib/accounts/store.js");
const { hmacSha256Hex } = await import("../src/lib/payments/signatures.js");

var store = new MemoryStore();
setStore(store);

var app;
var cookie = "";
var user = null;

function samplePayload() {
  var matches = [];
  for (var i = 0; i < 12; i++) {
    matches.push({
      id: "m" + i,
      date: "2026-01-" + String(i + 1).padStart(2, "0"),
      competition: "Liga Test",
      homeId: i % 2 === 0 ? "a" : "b",
      awayId: i % 2 === 0 ? "b" : "a",
      homeGoals: 2,
      awayGoals: 1,
      homeCorners: 5,
      awayCorners: 4,
      homeCards: 2,
      awayCards: 2
    });
  }

  return {
    homeId: "a",
    awayId: "b",
    competition: "Liga Test",
    lineups: true,
    matches: matches,
    teams: [
      { id: "a", name: "Equipo A" },
      { id: "b", name: "Equipo B" }
    ]
  };
}

function firstCookie(response) {
  var value = response.headers["set-cookie"];
  if (Array.isArray(value)) value = value[0];
  return String(value || "").split(";")[0];
}

before(async function () {
  app = await buildServer({
    env: "test",
    logLevel: "silent",
    corsOrigins: true,
    trustProxy: false,
    rateLimit: { max: 1000, timeWindow: "1 minute" },
    apiKeys: [{ id: "test", key: "test_key", scopes: ["*"], ips: [] }]
  });
  await app.ready();
});

after(async function () {
  if (app) await app.close();
});

test("flujo completo de cuenta, cuota y suscripcion", async function () {
  var magic = await app.inject({
    method: "POST",
    url: "/v1/auth/magic-link",
    payload: { email: "test@example.com" }
  });

  assert.equal(magic.statusCode, 200);
  var devLink = magic.json().devLink;
  assert.ok(devLink, "en modo dev debe devolver el link");

  var token = new URL(devLink).searchParams.get("token");
  assert.ok(token);

  var callback = await app.inject({
    method: "GET",
    url: "/v1/auth/callback?token=" + encodeURIComponent(token)
  });

  assert.equal(callback.statusCode, 302);
  assert.match(callback.headers.location, /auth=ok/);
  cookie = firstCookie(callback);
  assert.match(cookie, /^futbolityx_session=/);

  var account = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });

  assert.equal(account.statusCode, 200);
  var accountBody = account.json();
  user = accountBody.user;
  assert.equal(accountBody.plan, "free");
  assert.equal(accountBody.usage.analysesLast24h, 0);
  assert.equal(accountBody.usage.remaining, 10);

  var analysis = await app.inject({
    method: "POST",
    url: "/v1/analyze",
    headers: { cookie: cookie },
    payload: samplePayload()
  });

  assert.equal(analysis.statusCode, 200);

  var afterAnalysis = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });

  assert.equal(afterAnalysis.json().usage.analysesLast24h, 1);
  assert.equal(afterAnalysis.json().usage.remaining, 9);

  var freeLive = await app.inject({
    method: "GET",
    url: "/v1/live/scoreboard?league=../../x",
    headers: { cookie: cookie }
  });

  assert.equal(freeLive.statusCode, 403);
  assert.equal(freeLive.json().error.code, "upgrade_required");

  var checkout = await app.inject({
    method: "POST",
    url: "/v1/billing/checkout",
    headers: { cookie: cookie },
    payload: { plan: "pro", interval: "month", provider: "paddle" }
  });

  assert.equal(checkout.statusCode, 503);
  assert.equal(checkout.json().error.code, "paddle_not_configured");
});

test("checkout rechaza precios no aprobados", async function () {
  var previous = process.env.PRICING_STATUS;
  delete process.env.PRICING_STATUS;

  try {
    var res = await app.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      headers: { cookie: cookie },
      payload: { plan: "pro", interval: "month", provider: "paddle" }
    });

    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error.code, "pricing_not_approved");
  } finally {
    if (previous === undefined) delete process.env.PRICING_STATUS;
    else process.env.PRICING_STATUS = previous;
  }
});

test("webhook de Paddle activa el plan y es idempotente", async function () {
  assert.ok(user, "el usuario debe existir");

  var event = {
    event_id: "evt_test_1",
    event_type: "subscription.created",
    data: {
      id: "sub_test_1",
      status: "active",
      customer_id: "ctm_test_1",
      custom_data: { user_id: user.id },
      current_billing_period: {
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      items: [{ price: { id: "pri_test_pro" } }]
    }
  };

  var raw = JSON.stringify(event);
  var ts = String(Math.floor(Date.now() / 1000));
  var signature = "ts=" + ts + ";h1=" + hmacSha256Hex("paddle_test_secret", ts + ":" + raw);

  var response = await app.inject({
    method: "POST",
    url: "/v1/webhooks/paddle",
    headers: {
      "content-type": "application/json",
      "paddle-signature": signature
    },
    payload: raw
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().received, true);

  var account = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });

  assert.equal(account.json().plan, "pro");
  assert.equal(account.json().subscription.provider, "paddle");
  assert.equal(account.json().subscription.status, "active");

  await store.upsertSubscription({
    user_id: user.id,
    plan: "elite",
    status: "active",
    provider: "mercadopago",
    provider_subscription_id: "mp_test_elite",
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
  });

  var upgraded = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });

  assert.equal(upgraded.json().plan, "elite");

  await store.upsertSubscription({
    user_id: user.id,
    plan: "elite",
    status: "active",
    provider: "mercadopago",
    provider_subscription_id: "mp_test_elite",
    current_period_start: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    current_period_end: new Date(Date.now() - 1000).toISOString()
  });

  var afterEliteExpired = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });

  assert.equal(afterEliteExpired.json().plan, "pro");

  await store.upsertSubscription({
    user_id: user.id,
    plan: "elite",
    status: "canceled",
    provider: "mercadopago",
    provider_subscription_id: "mp_test_elite",
    current_period_start: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    current_period_end: null
  });

  var afterCanceledWithoutEnd = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });

  assert.equal(afterCanceledWithoutEnd.json().plan, "pro");

  var proLive = await app.inject({
    method: "GET",
    url: "/v1/live/scoreboard?league=../../x",
    headers: { cookie: cookie }
  });

  assert.equal(proLive.statusCode, 400);
  assert.equal(proLive.json().error.code, "invalid_league");

  var duplicate = await app.inject({
    method: "POST",
    url: "/v1/webhooks/paddle",
    headers: {
      "content-type": "application/json",
      "paddle-signature": signature
    },
    payload: raw
  });

  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.json().duplicate, true);
});

test("webhooks rechazan firmas invalidas", async function () {
  var paddle = await app.inject({
    method: "POST",
    url: "/v1/webhooks/paddle",
    headers: {
      "content-type": "application/json",
      "paddle-signature": "ts=1;h1=deadbeef"
    },
    payload: JSON.stringify({ event_id: "evt_bad", event_type: "subscription.created", data: {} })
  });

  assert.equal(paddle.statusCode, 401);
  assert.equal(paddle.json().error.code, "invalid_signature");

  var mercadoPago = await app.inject({
    method: "POST",
    url: "/v1/webhooks/mercadopago?data.id=123",
    headers: {
      "content-type": "application/json",
      "x-request-id": "req-1",
      "x-signature": "ts=1,v1=deadbeef"
    },
    payload: JSON.stringify({ type: "subscription_preapproval", data: { id: "123" } })
  });

  assert.equal(mercadoPago.statusCode, 401);
  assert.equal(mercadoPago.json().error.code, "invalid_signature");
});

test("webhook de Mercado Pago acepta pagos sin consultar preapproval", async function () {
  var ts = String(Math.floor(Date.now() / 1000));
  var manifest = "id:pay_123;request-id:req-payment;ts:" + ts + ";";
  var signature = "ts=" + ts + ",v1=" + hmacSha256Hex("mp_test_secret", manifest);

  var response = await app.inject({
    method: "POST",
    url: "/v1/webhooks/mercadopago?data.id=pay_123",
    headers: {
      "content-type": "application/json",
      "x-request-id": "req-payment",
      "x-signature": signature
    },
    payload: JSON.stringify({
      id: "notif_payment_1",
      type: "payment",
      data: { id: "pay_123" }
    })
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().received, true);
});

test("checkout rechaza una segunda suscripcion activa", async function () {
  var response = await app.inject({
    method: "POST",
    url: "/v1/billing/checkout",
    headers: { cookie: cookie },
    payload: { plan: "elite", interval: "month", provider: "paddle" }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "already_subscribed");
});

test("cancelar renovacion de Paddle mantiene el acceso hasta el periodo pagado", async function () {
  var previousKey = process.env.PADDLE_API_KEY;
  var originalFetch = globalThis.fetch;
  var calls = [];

  process.env.PADDLE_API_KEY = "paddle_test_key";
  globalThis.fetch = async function (url, options) {
    calls.push({ url: String(url), options: options });
    return new Response(JSON.stringify({
      data: { id: "sub_test_1", status: "active" }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    var response = await app.inject({
      method: "POST",
      url: "/v1/billing/cancel",
      headers: { cookie: cookie }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().cancelAtPeriodEnd, true);
    assert.match(calls[0].url, /\/subscriptions\/sub_test_1\/cancel$/);
    assert.equal(calls[0].options.method, "POST");
    assert.match(calls[0].options.body, /next_billing_period/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.PADDLE_API_KEY;
    else process.env.PADDLE_API_KEY = previousKey;
  }

  var account = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });

  assert.equal(account.json().plan, "pro");
  assert.equal(account.json().subscription.cancelAtPeriodEnd, true);
});

test("cancelar renovacion de Mercado Pago actualiza la suscripcion", async function () {
  await store.upsertSubscription({
    user_id: user.id,
    plan: "elite",
    status: "active",
    provider: "mercadopago",
    provider_subscription_id: "mp_cancel_test",
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
  });

  var previousToken = process.env.MP_ACCESS_TOKEN;
  var originalFetch = globalThis.fetch;
  var calls = [];

  process.env.MP_ACCESS_TOKEN = "mp_test_token";
  globalThis.fetch = async function (url, options) {
    calls.push({ url: String(url), options: options });
    return new Response(JSON.stringify({
      id: "mp_cancel_test",
      status: "cancelled"
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    var response = await app.inject({
      method: "POST",
      url: "/v1/billing/cancel",
      headers: { cookie: cookie }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().cancelAtPeriodEnd, true);
    assert.match(calls[0].url, /\/preapproval\/mp_cancel_test$/);
    assert.equal(calls[0].options.method, "PUT");
    assert.match(calls[0].options.body, /cancelled/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.MP_ACCESS_TOKEN;
    else process.env.MP_ACCESS_TOKEN = previousToken;
  }

  var account = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });

  assert.equal(account.json().plan, "elite");
  assert.equal(account.json().subscription.cancelAtPeriodEnd, true);
});

test("logout invalida la sesion y los links vencidos redirigen", async function () {
  var logout = await app.inject({
    method: "POST",
    url: "/v1/auth/logout",
    headers: { cookie: cookie }
  });

  assert.equal(logout.statusCode, 200);

  var afterLogout = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });

  assert.equal(afterLogout.statusCode, 401);
  assert.equal(afterLogout.json().error.code, "authentication_required");

  var invalid = await app.inject({
    method: "GET",
    url: "/v1/auth/callback?token=invalido"
  });

  assert.equal(invalid.statusCode, 302);
  assert.match(invalid.headers.location, /auth=invalid/);
});
