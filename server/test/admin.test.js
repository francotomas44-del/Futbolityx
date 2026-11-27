import { test, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.AUTH_DEV_MODE = "true";
process.env.ADMIN_EMAILS = "Admin@Example.com";

const { buildServer } = await import("../src/index.js");
const { setStore, MemoryStore } = await import("../src/lib/accounts/store.js");

var ENV_NAMES = [
  "BETA_MODE",
  "BETA_ALLOWED_EMAILS",
  "BETA_EMAILS",
  "BETA_TEST_PLAN",
  "BETA_DISABLE_CHECKOUT",
  "BETA_LABEL"
];

var savedEnv = {};

function clearBeta() {
  ENV_NAMES.forEach(function (name) {
    delete process.env[name];
  });
}

function saveBeta() {
  var saved = {};
  ENV_NAMES.forEach(function (name) {
    saved[name] = process.env[name];
  });
  return saved;
}

function restoreBeta(saved) {
  ENV_NAMES.forEach(function (name) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  });
}

function firstCookie(response) {
  var value = response.headers["set-cookie"];
  if (Array.isArray(value)) value = value[0];
  return String(value || "").split(";")[0];
}

var store = new MemoryStore();
setStore(store);

var app;

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

async function login(email) {
  var magic = await app.inject({
    method: "POST",
    url: "/v1/auth/magic-link",
    payload: { email: email }
  });

  if (magic.statusCode !== 200) return { magic: magic, cookie: null };

  var token = new URL(magic.json().devLink).searchParams.get("token");
  var callback = await app.inject({
    method: "GET",
    url: "/v1/auth/callback?token=" + encodeURIComponent(token)
  });

  return { magic: magic, callback: callback, cookie: firstCookie(callback) };
}

async function accountFor(cookie) {
  return app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });
}

test("admin entra con beta cerrada y obtiene Elite, todos los features y cuota ilimitada", async function () {
  var saved = saveBeta();
  clearBeta();

  try {
    process.env.BETA_MODE = "closed";
    process.env.BETA_ALLOWED_EMAILS = "invited@example.com";
    process.env.BETA_TEST_PLAN = "pro";

    var denied = await login("outsider@example.com");
    assert.equal(denied.magic.statusCode, 403);
    assert.equal(denied.magic.json().error.code, "beta_invite_required");

    var session = await login("ADMIN@example.com");
    assert.equal(session.magic.statusCode, 200);

    var response = await accountFor(session.cookie);
    assert.equal(response.statusCode, 200);

    var account = response.json();
    assert.equal(account.user.email, "admin@example.com");
    assert.equal(account.role, "admin");
    assert.equal(account.isAdmin, true);
    assert.equal(account.plan, "elite");
    assert.equal(account.entitlements.plan, "elite");
    assert.equal(account.entitlements.limits.analysesPerDay, null);
    assert.equal(account.entitlements.limits.exports, true);
    assert.equal(account.usage.analysesPerDay, null);
    assert.equal(account.usage.remaining, null);
    assert.equal(account.beta.enabled, true);
    assert.equal(account.beta.invited, false);

    var features = account.entitlements.features;
    Object.keys(features).forEach(function (feature) {
      assert.equal(features[feature], true, "feature " + feature + " deberia estar habilitado");
    });
  } finally {
    restoreBeta(saved);
  }
});

test("usuario normal conserva plan Free y rol user", async function () {
  var saved = saveBeta();
  clearBeta();

  try {
    var session = await login("normal@example.com");
    assert.equal(session.magic.statusCode, 200);

    var response = await accountFor(session.cookie);
    assert.equal(response.statusCode, 200);

    var account = response.json();
    assert.equal(account.role, "user");
    assert.equal(account.isAdmin, false);
    assert.equal(account.plan, "free");
    assert.equal(account.entitlements.features.live, false);
    assert.equal(account.usage.analysesPerDay, 10);
  } finally {
    restoreBeta(saved);
  }
});
