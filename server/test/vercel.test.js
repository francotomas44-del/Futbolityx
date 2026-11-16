import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.AUTH_DEV_MODE = "true";
process.env.PRICING_STATUS = "approved";
process.env.PADDLE_WEBHOOK_SECRET = "paddle_test_secret";
process.env.MP_WEBHOOK_SECRET = "mp_test_secret";
process.env.PLAN_PADDLE_PRO_MONTHLY = "pri_test_pro";
process.env.API_KEYS = JSON.stringify([
  { id: "vercel-dev", key: "vercel_dev_key", scopes: ["*"], ips: [] }
]);

const { setStore, MemoryStore } = await import("../src/lib/accounts/store.js");
const { hmacSha256Hex } = await import("../src/lib/payments/signatures.js");

setStore(new MemoryStore());

const health = (await import("../../api/health.js")).default;
const plans = (await import("../../api/plans.js")).default;
const whoami = (await import("../../api/whoami.js")).default;
const analyze = (await import("../../api/analyze.js")).default;
const scoreboard = (await import("../../api/live/scoreboard.js")).default;
const summary = (await import("../../api/live/summary.js")).default;
const magicLink = (await import("../../api/auth/magic-link.js")).default;
const callback = (await import("../../api/auth/callback.js")).default;
const account = (await import("../../api/account.js")).default;
const checkout = (await import("../../api/billing/checkout.js")).default;
const cancel = (await import("../../api/billing/cancel.js")).default;
const paddleWebhook = await import("../../api/webhooks/paddle.js");
const mercadoPagoWebhook = await import("../../api/webhooks/mercadopago.js");

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(value) {
      this.body = value === undefined ? "" : String(value);
    }
  };
}

function mockReq(options) {
  options = options || {};
  return {
    method: options.method || "GET",
    url: options.url || "/",
    headers: options.headers || {},
    body: options.body,
    socket: { remoteAddress: "127.0.0.1" }
  };
}

function samplePayload() {
  var teams = [
    { id: "a", name: "Equipo A" },
    { id: "b", name: "Equipo B" }
  ];
  var matches = [];

  for (var i = 0; i < 12; i++) {
    var home = i % 2 === 0 ? "a" : "b";
    var away = i % 2 === 0 ? "b" : "a";
    matches.push({
      id: "m" + i,
      date: "2026-01-" + String(i + 1).padStart(2, "0"),
      competition: "Liga Test",
      homeId: home,
      awayId: away,
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
    teams: teams
  };
}

test("Vercel /api/health responde 200", async function () {
  var res = mockRes();
  await health(mockReq({ method: "GET", url: "/api/health" }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).runtime, "vercel");
});

test("Vercel /api/plans devuelve Free, Pro y Elite", async function () {
  var res = mockRes();
  await plans(mockReq({ method: "GET", url: "/api/plans" }), res);
  assert.equal(res.statusCode, 200);
  var body = JSON.parse(res.body);
  assert.equal(body.plans.length, 3);
  assert.deepEqual(body.providers, { paddle: false, mercadopago: false });
  assert.equal(body.billing, "not_available");
});

test("Vercel /api/whoami valida la API key", async function () {
  var res = mockRes();
  await whoami(mockReq({
    method: "GET",
    url: "/api/whoami",
    headers: { "x-api-key": "vercel_dev_key" }
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).keyId, "vercel-dev");
});

test("Vercel /api/analyze sin key responde 401", async function () {
  var res = mockRes();
  await analyze(mockReq({
    method: "POST",
    url: "/api/analyze",
    body: samplePayload()
  }), res);

  assert.equal(res.statusCode, 401);
});

test("Vercel /api/analyze con key calcula el analisis", async function () {
  var res = mockRes();
  await analyze(mockReq({
    method: "POST",
    url: "/api/analyze",
    headers: { "x-api-key": "vercel_dev_key" },
    body: samplePayload()
  }), res);

  assert.equal(res.statusCode, 200);
  var body = JSON.parse(res.body);
  assert.ok(body.output.markets.homeWin > 0);
  assert.ok(body.output.markets.homeWin <= 1);
});

test("Vercel /api/live/scoreboard valida la liga", async function () {
  var res = mockRes();
  await scoreboard(mockReq({
    method: "GET",
    url: "/api/live/scoreboard?league=../../etc/passwd",
    headers: { "x-api-key": "vercel_dev_key" }
  }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error.code, "invalid_league");
});

test("Vercel /api/live/summary valida el evento", async function () {
  var res = mockRes();
  await summary(mockReq({
    method: "GET",
    url: "/api/live/summary?league=arg.1&event=../../x",
    headers: { "x-api-key": "vercel_dev_key" }
  }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error.code, "invalid_event");
});

test("Vercel auth, cuenta, checkout y webhook de Paddle", async function () {
  var magicRes = mockRes();
  await magicLink(mockReq({
    method: "POST",
    url: "/api/auth/magic-link",
    headers: { host: "localhost", "x-forwarded-proto": "https" },
    body: { email: "vercel@example.com" }
  }), magicRes);

  assert.equal(magicRes.statusCode, 200);
  var devLink = JSON.parse(magicRes.body).devLink;
  assert.ok(devLink);

  var token = new URL(devLink).searchParams.get("token");
  var callbackRes = mockRes();
  await callback(mockReq({
    method: "GET",
    url: "/api/auth/callback?token=" + encodeURIComponent(token),
    headers: {}
  }), callbackRes);

  assert.equal(callbackRes.statusCode, 302);
  assert.match(callbackRes.headers.location, /auth=ok/);
  var cookie = String(callbackRes.headers["set-cookie"]).split(";")[0];

  var accountRes = mockRes();
  await account(mockReq({
    method: "GET",
    url: "/api/account",
    headers: { cookie: cookie }
  }), accountRes);

  assert.equal(accountRes.statusCode, 200);
  var accountBody = JSON.parse(accountRes.body);
  assert.equal(accountBody.plan, "free");

  var freeLiveRes = mockRes();
  await scoreboard(mockReq({
    method: "GET",
    url: "/api/live/scoreboard?league=../../x",
    headers: { cookie: cookie }
  }), freeLiveRes);

  assert.equal(freeLiveRes.statusCode, 403);
  assert.equal(JSON.parse(freeLiveRes.body).error.code, "upgrade_required");

  var checkoutRes = mockRes();
  await checkout(mockReq({
    method: "POST",
    url: "/api/billing/checkout",
    headers: { cookie: cookie },
    body: { plan: "pro", interval: "month", provider: "paddle" }
  }), checkoutRes);

  assert.equal(checkoutRes.statusCode, 503);
  assert.equal(JSON.parse(checkoutRes.body).error.code, "paddle_not_configured");

  var event = {
    event_id: "evt_vercel_1",
    event_type: "subscription.created",
    data: {
      id: "sub_vercel_1",
      status: "active",
      custom_data: { user_id: accountBody.user.id },
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

  var webhookResponse = await paddleWebhook.POST(new Request("https://example.com/api/webhooks/paddle", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "paddle-signature": signature
    },
    body: raw
  }));

  assert.equal(webhookResponse.status, 200);

  var proAccountRes = mockRes();
  await account(mockReq({
    method: "GET",
    url: "/api/account",
    headers: { cookie: cookie }
  }), proAccountRes);

  assert.equal(JSON.parse(proAccountRes.body).plan, "pro");

  var secondCheckoutRes = mockRes();
  await checkout(mockReq({
    method: "POST",
    url: "/api/billing/checkout",
    headers: { cookie: cookie },
    body: { plan: "elite", interval: "month", provider: "paddle" }
  }), secondCheckoutRes);

  assert.equal(secondCheckoutRes.statusCode, 409);
  assert.equal(JSON.parse(secondCheckoutRes.body).error.code, "already_subscribed");

  var proLiveRes = mockRes();
  await scoreboard(mockReq({
    method: "GET",
    url: "/api/live/scoreboard?league=../../x",
    headers: { cookie: cookie }
  }), proLiveRes);

  assert.equal(proLiveRes.statusCode, 400);
  assert.equal(JSON.parse(proLiveRes.body).error.code, "invalid_league");

  var previousKey = process.env.PADDLE_API_KEY;
  var originalFetch = globalThis.fetch;

  process.env.PADDLE_API_KEY = "paddle_test_key";
  globalThis.fetch = async function () {
    return new Response(JSON.stringify({
      data: { id: "sub_vercel_1", status: "active" }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    var cancelRes = mockRes();
    await cancel(mockReq({
      method: "POST",
      url: "/api/billing/cancel",
      headers: { cookie: cookie }
    }), cancelRes);

    assert.equal(cancelRes.statusCode, 200);
    assert.equal(JSON.parse(cancelRes.body).cancelAtPeriodEnd, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.PADDLE_API_KEY;
    else process.env.PADDLE_API_KEY = previousKey;
  }

  var canceledAccountRes = mockRes();
  await account(mockReq({
    method: "GET",
    url: "/api/account",
    headers: { cookie: cookie }
  }), canceledAccountRes);

  assert.equal(JSON.parse(canceledAccountRes.body).subscription.cancelAtPeriodEnd, true);
});

test("Vercel webhook de Mercado Pago rechaza firma invalida", async function () {
  var response = await mercadoPagoWebhook.POST(new Request("https://example.com/api/webhooks/mercadopago?data.id=123", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": "req-1",
      "x-signature": "ts=1,v1=deadbeef"
    },
    body: JSON.stringify({ type: "subscription_preapproval", data: { id: "123" } })
  }));

  assert.equal(response.status, 401);
  var body = await response.json();
  assert.equal(body.error.code, "invalid_signature");
});
