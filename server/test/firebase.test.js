import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.NODE_ENV = "test";
process.env.AUTH_DEV_MODE = "true";
process.env.PRICING_STATUS = "approved";
process.env.FIREBASE_PROJECT_ID = "test-project";

const { buildServer } = await import("../src/index.js");
const { setStore, MemoryStore } = await import("../src/lib/accounts/store.js");
const { createFirebaseVerifier } = await import("../src/lib/firebase-auth.js");

var keyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
var otherKeyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

function publicJwk(keyPair, kid) {
  var jwk = keyPair.publicKey.export({ format: "jwk" });
  jwk.kid = kid || "test-key";
  jwk.alg = "RS256";
  jwk.use = "sig";
  return jwk;
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signToken(payload, options) {
  options = options || {};
  var header = Object.assign({ alg: "RS256", typ: "JWT", kid: "test-key" }, options.header || {});
  var signingInput = base64url(header) + "." + base64url(payload);
  var key = options.key || keyPair.privateKey;
  var signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), key).toString("base64url");
  return signingInput + "." + signature;
}

function validClaims(overrides) {
  var now = Math.floor(Date.now() / 1000);
  return Object.assign({
    aud: "test-project",
    iss: "https://securetoken.google.com/test-project",
    sub: "firebase-uid-1",
    email: "Invited@Example.com",
    email_verified: true,
    name: "Tester Firebase",
    iat: now,
    auth_time: now,
    exp: now + 3600,
    firebase: { sign_in_provider: "password" }
  }, overrides || {});
}

function firstCookie(response) {
  var value = response.headers["set-cookie"];
  if (Array.isArray(value)) value = value[0];
  return String(value || "").split(";")[0];
}

test("verifica un ID token real firmado con la clave publica", async function () {
  var verifier = createFirebaseVerifier({
    projectId: "test-project",
    keysLoader: async function () { return [publicJwk(keyPair)]; }
  });

  var claims = await verifier.verify(signToken(validClaims()));
  assert.equal(claims.uid, "firebase-uid-1");
  assert.equal(claims.email, "invited@example.com");
  assert.equal(claims.emailVerified, true);
  assert.equal(claims.displayName, "Tester Firebase");
  assert.equal(claims.provider, "password");
});

test("rechaza audiencia, emisor, vencimiento, verification y firma invalidos", async function () {
  var verifier = createFirebaseVerifier({
    projectId: "test-project",
    keysLoader: async function () { return [publicJwk(keyPair)]; }
  });

  var cases = [
    [signToken(validClaims({ aud: "otro-proyecto" })), "invalid_firebase_token"],
    [signToken(validClaims({ iss: "https://securetoken.google.com/otro" })), "invalid_firebase_token"],
    [signToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 10 })), "invalid_firebase_token"],
    [signToken(validClaims({ email_verified: false })), "firebase_email_unverified"],
    [signToken(validClaims(), { key: otherKeyPair.privateKey }), "invalid_firebase_token"],
    ["no.es.un.token", "invalid_firebase_token"]
  ];

  for (var item of cases) {
    try {
      await verifier.verify(item[0]);
      assert.fail("debia rechazar el token");
    } catch (error) {
      assert.equal(error.code, item[1]);
    }
  }
});

test("refresca las claves cuando cambia el kid", async function () {
  var calls = 0;
  var verifier = createFirebaseVerifier({
    projectId: "test-project",
    keysLoader: async function (force) {
      calls += 1;
      return force ? [publicJwk(keyPair, "nueva-clave")] : [];
    }
  });

  var token = signToken(validClaims(), { header: { kid: "nueva-clave" } });
  var claims = await verifier.verify(token);
  assert.equal(claims.uid, "firebase-uid-1");
  assert.equal(calls, 2);
});

var BETA_ENV = ["BETA_MODE", "BETA_ALLOWED_EMAILS", "BETA_TEST_PLAN", "BETA_DISABLE_CHECKOUT", "BETA_LABEL"];
var savedBeta = {};
var store = new MemoryStore();
var app;

function saveBeta() {
  var saved = {};
  BETA_ENV.forEach(function (name) { saved[name] = process.env[name]; });
  return saved;
}

function clearBeta() {
  BETA_ENV.forEach(function (name) { delete process.env[name]; });
}

function restoreBeta(saved) {
  BETA_ENV.forEach(function (name) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  });
}

function mockVerifier(claimsByToken) {
  return {
    configured: true,
    projectId: "test-project",
    async verify(token) {
      var claims = claimsByToken[token];
      if (!claims) {
        var error = new Error("Token invalido");
        error.code = "invalid_firebase_token";
        error.statusCode = 401;
        throw error;
      }
      return {
        uid: claims.sub,
        email: claims.email,
        emailVerified: claims.email_verified,
        displayName: claims.name || null,
        provider: claims.firebase ? claims.firebase.sign_in_provider : null
      };
    }
  };
}

async function login(app, token) {
  return app.inject({
    method: "POST",
    url: "/v1/auth/firebase",
    payload: { idToken: token }
  });
}

before(async function () {
  BETA_ENV.forEach(function (name) { savedBeta[name] = process.env[name]; });
  clearBeta();
  setStore(store);
  app = await buildServer({
    env: "test",
    logLevel: "silent",
    corsOrigins: true,
    trustProxy: false,
    rateLimit: { max: 1000, timeWindow: "1 minute" },
    apiKeys: [{ id: "test", key: "test_key", scopes: ["*"], ips: [] }],
    firebaseVerifier: mockVerifier({
      "google-token": validClaims({
        email: "invited@example.com",
        name: "Invitado Google",
        firebase: { sign_in_provider: "google.com" }
      }),
      "outsider-token": validClaims({ email: "outsider@example.com", sub: "uid-outsider" }),
      "banned-token": validClaims({ email: "banned@example.com", sub: "uid-banned" })
    })
  });
  await app.ready();
});

after(async function () {
  if (app) await app.close();
  restoreBeta(savedBeta);
});

test("Firebase sin projectId devuelve firebase_not_configured", async function () {
  var verifier = createFirebaseVerifier({ projectId: "" });
  try {
    await verifier.verify("cualquier.token.aqui");
    assert.fail("debia fallar");
  } catch (error) {
    assert.equal(error.code, "firebase_not_configured");
    assert.equal(error.statusCode, 503);
  }
});

test("ID token invalido no crea sesion", async function () {
  var response = await login(app, "token-desconocido");
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "invalid_firebase_token");
});

test("beta cerrada: invitado obtiene sesion, plan de prueba y nombre", async function () {
  process.env.BETA_MODE = "closed";
  process.env.BETA_ALLOWED_EMAILS = "invited@example.com,banned@example.com";
  process.env.BETA_TEST_PLAN = "elite";
  process.env.BETA_DISABLE_CHECKOUT = "true";

  var response = await login(app, "google-token");
  assert.equal(response.statusCode, 200);
  assert.ok(firstCookie(response).startsWith("futbolityx_session="));

  var body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.user.email, "invited@example.com");
  assert.equal(body.user.emailVerified, true);
  assert.equal(body.user.displayName, "Invitado Google");
  assert.equal(body.plan, "elite");
  assert.equal(body.subscription, null);
  assert.equal(body.beta.invited, true);
  assert.equal(body.entitlements.features.live, true);

  var denied = await login(app, "outsider-token");
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().error.code, "beta_invite_required");
});

test("sacar un email de la lista invalida su sesion de Firebase", async function () {
  var response = await login(app, "banned-token");
  assert.equal(response.statusCode, 200);
  var cookie = firstCookie(response);

  var account = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });
  assert.equal(account.statusCode, 200);

  process.env.BETA_ALLOWED_EMAILS = "invited@example.com";

  var afterRevoke = await app.inject({
    method: "GET",
    url: "/v1/account",
    headers: { cookie: cookie }
  });
  assert.equal(afterRevoke.statusCode, 401);
});

test("logout cierra la sesion creada con Firebase", async function () {
  var response = await login(app, "google-token");
  var cookie = firstCookie(response);

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
});
