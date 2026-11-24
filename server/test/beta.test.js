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

var BETA_ENV = [
  "BETA_MODE",
  "BETA_ALLOWED_EMAILS",
  "BETA_EMAILS",
  "BETA_TEST_PLAN",
  "BETA_DISABLE_CHECKOUT",
  "BETA_LABEL"
];

var store = new MemoryStore();
setStore(store);

var app;

function saveBeta() {
  var saved = {};
  BETA_ENV.forEach(function (name) {
    saved[name] = process.env[name];
  });
  return saved;
}

function clearBeta() {
  BETA_ENV.forEach(function (name) {
    delete process.env[name];
  });
}

function restoreBeta(saved) {
  BETA_ENV.forEach(function (name) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  });
}

function firstCookie(response) {
  var value = response.headers["set-cookie"];
  if (Array.isArray(value)) value = value[0];
  return String(value || "").split(";")[0];
}

async function login(email) {
  var magic = await app.inject({
    method: "POST",
    url: "/v1/auth/magic-link",
    payload: { email: email }
  });

  if (magic.statusCode !== 200) {
    return { magic: magic, cookie: null };
  }

  var link = magic.json().devLink;
  var token = new URL(link).searchParams.get("token");
  var callback = await app.inject({
    method: "GET",
    url: "/v1/auth/callback?token=" + encodeURIComponent(token)
  });

  return { magic: magic, callback: callback, cookie: firstCookie(callback) };
}

before(async function () {
  clearBeta();
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
  clearBeta();
});

test("beta apagada: acceso normal y plan Free", async function () {
  var saved = saveBeta();
  clearBeta();

  try {
    var session = await login("beta-off@example.com");
    assert.equal(session.magic.statusCode, 200);

    var account = await app.inject({
      method: "GET",
      url: "/v1/account",
      headers: { cookie: session.cookie }
    });

    assert.equal(account.statusCode, 200);
    assert.equal(account.json().plan, "free");
    assert.equal(account.json().beta.enabled, false);

    var plans = await app.inject({ method: "GET", url: "/v1/plans" });
    assert.equal(plans.json().beta.enabled, false);
  } finally {
    restoreBeta(saved);
  }
});

test("beta cerrada: invitados, plan de prueba y checkout bloqueado", async function () {
  var saved = saveBeta();
  clearBeta();

  try {
    process.env.BETA_MODE = "closed";
    process.env.BETA_ALLOWED_EMAILS = "Invited@Example.com, other@example.com";
    process.env.BETA_TEST_PLAN = "elite";
    process.env.BETA_DISABLE_CHECKOUT = "true";
    process.env.BETA_LABEL = "Ronda 1";

    var denied = await app.inject({
      method: "POST",
      url: "/v1/auth/magic-link",
      payload: { email: "outsider@example.com" }
    });

    assert.equal(denied.statusCode, 403);
    assert.equal(denied.json().error.code, "beta_invite_required");

    var session = await login("invited@example.com");
    assert.equal(session.magic.statusCode, 200);
    assert.ok(session.cookie);

    var account = await app.inject({
      method: "GET",
      url: "/v1/account",
      headers: { cookie: session.cookie }
    });

    assert.equal(account.statusCode, 200);
    var body = account.json();
    assert.equal(body.plan, "elite");
    assert.equal(body.subscription, null);
    assert.equal(body.beta.enabled, true);
    assert.equal(body.beta.invited, true);
    assert.equal(body.beta.testPlan, "elite");
    assert.equal(body.beta.checkoutDisabled, true);
    assert.equal(body.usage.remaining, null);
    assert.equal(body.entitlements.features.live, true);

    var checkout = await app.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      headers: { cookie: session.cookie },
      payload: { plan: "pro", interval: "month", provider: "paddle" }
    });

    assert.equal(checkout.statusCode, 403);
    assert.equal(checkout.json().error.code, "beta_checkout_disabled");

    var plans = await app.inject({ method: "GET", url: "/v1/plans" });
    var plansBody = plans.json();
    assert.equal(plansBody.beta.enabled, true);
    assert.equal(plansBody.beta.mode, "closed");
    assert.equal(plansBody.beta.label, "Ronda 1");
    assert.equal(plansBody.beta.checkoutDisabled, true);
    assert.equal(plansBody.beta.invitedCount, 2);
    assert.equal(plansBody.billing, "not_available");
    assert.match(plansBody.note, /Prueba cerrada/i);
  } finally {
    restoreBeta(saved);
  }
});

test("sacar un email de la lista cierra su sesion", async function () {
  var saved = saveBeta();
  clearBeta();

  try {
    process.env.BETA_MODE = "closed";
    process.env.BETA_ALLOWED_EMAILS = "revoked@example.com";
    process.env.BETA_TEST_PLAN = "pro";

    var session = await login("revoked@example.com");
    assert.equal(session.magic.statusCode, 200);

    var before = await app.inject({
      method: "GET",
      url: "/v1/account",
      headers: { cookie: session.cookie }
    });
    assert.equal(before.statusCode, 200);
    assert.equal(before.json().plan, "pro");

    process.env.BETA_ALLOWED_EMAILS = "";

    var afterRevoke = await app.inject({
      method: "GET",
      url: "/v1/account",
      headers: { cookie: session.cookie }
    });
    assert.equal(afterRevoke.statusCode, 401);
    assert.equal(afterRevoke.json().error.code, "authentication_required");
  } finally {
    restoreBeta(saved);
  }
});

test("checkout sandbox se puede habilitar explicitamente", async function () {
  var saved = saveBeta();
  clearBeta();

  try {
    process.env.BETA_MODE = "closed";
    process.env.BETA_ALLOWED_EMAILS = "sandbox@example.com";
    process.env.BETA_TEST_PLAN = "free";
    process.env.BETA_DISABLE_CHECKOUT = "false";

    var session = await login("sandbox@example.com");
    assert.equal(session.magic.statusCode, 200);

    var checkout = await app.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      headers: { cookie: session.cookie },
      payload: { plan: "pro", interval: "month", provider: "paddle" }
    });

    assert.notEqual(checkout.json().error.code, "beta_checkout_disabled");
    assert.equal(checkout.statusCode, 503);
    assert.equal(checkout.json().error.code, "paddle_not_configured");
  } finally {
    restoreBeta(saved);
  }
});
