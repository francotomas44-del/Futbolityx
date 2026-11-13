import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildServer } from "../src/index.js";

var app;
var hashedKey = "test_hashed_key";
var hashedKeyHash = crypto.createHash("sha256").update(hashedKey).digest("hex");

var testConfig = {
  env: "test",
  logLevel: "silent",
  corsOrigins: true,
  trustProxy: false,
  rateLimit: { max: 1000, timeWindow: "1 minute" },
  apiKeys: [
    { id: "full", key: "test_full_key", scopes: ["*"], ips: [] },
    { id: "hashed", keyHash: hashedKeyHash, scopes: ["*"], ips: [] },
    { id: "live-only", key: "test_live_key", scopes: ["live"], ips: [] },
    { id: "ip-blocked", key: "test_ip_key", scopes: ["*"], ips: ["10.0.0.0/8"] }
  ]
};

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

before(async function () {
  app = await buildServer(testConfig);
  await app.ready();
});

after(async function () {
  if (app) await app.close();
});

test("GET /v1/health responde 200", async function () {
  var response = await app.inject({ method: "GET", url: "/v1/health" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().ok, true);
});

test("GET /v1/plans devuelve el catalogo propuesto", async function () {
  var response = await app.inject({ method: "GET", url: "/v1/plans" });
  assert.equal(response.statusCode, 200);
  var body = response.json();
  assert.equal(body.billing, "not_available");
  assert.equal(body.plans.length, 3);
  assert.equal(body.plans[0].id, "free");
  assert.equal(body.plans[1].id, "pro");
  assert.equal(body.plans[2].id, "elite");
});

test("GET /v1/whoami devuelve la key y sus scopes", async function () {
  var response = await app.inject({
    method: "GET",
    url: "/v1/whoami",
    headers: { "x-api-key": "test_full_key" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().keyId, "full");
  assert.deepEqual(response.json().scopes, ["*"]);
});

test("POST /v1/analyze sin API key responde 401", async function () {
  var response = await app.inject({
    method: "POST",
    url: "/v1/analyze",
    payload: samplePayload()
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "missing_api_key");
});

test("POST /v1/analyze con API key valida calcula el analisis", async function () {
  var response = await app.inject({
    method: "POST",
    url: "/v1/analyze",
    headers: { "x-api-key": "test_full_key" },
    payload: samplePayload()
  });

  assert.equal(response.statusCode, 200);
  var body = response.json();
  assert.equal(body.input.homeId, "a");
  assert.equal(body.input.awayId, "b");
  assert.ok(body.output.markets.homeWin >= 0 && body.output.markets.homeWin <= 1);
  assert.ok(body.output.markets.draw >= 0 && body.output.markets.draw <= 1);
  assert.ok(body.output.markets.awayWin >= 0 && body.output.markets.awayWin <= 1);
  var total = body.output.markets.homeWin + body.output.markets.draw + body.output.markets.awayWin;
  assert.ok(Math.abs(total - 1) < 0.001);
  assert.ok(body.output.expectedHome > 0);
  assert.ok(body.output.expectedAway > 0);
});

test("POST /v1/analyze acepta API key configurada por hash", async function () {
  var response = await app.inject({
    method: "POST",
    url: "/v1/analyze",
    headers: { "x-api-key": hashedKey },
    payload: samplePayload()
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.json().output.markets.homeWin > 0);
});

test("POST /v1/analyze con scope insuficiente responde 403", async function () {
  var response = await app.inject({
    method: "POST",
    url: "/v1/analyze",
    headers: { "x-api-key": "test_live_key" },
    payload: samplePayload()
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "insufficient_scope");
});

test("POST /v1/analyze respeta la allowlist de IP por API key", async function () {
  var response = await app.inject({
    method: "POST",
    url: "/v1/analyze",
    headers: { "x-api-key": "test_ip_key" },
    payload: samplePayload()
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "ip_not_allowed");
});

test("POST /v1/analyze rechaza local y visitante iguales", async function () {
  var payload = samplePayload();
  payload.awayId = "a";

  var response = await app.inject({
    method: "POST",
    url: "/v1/analyze",
    headers: { "x-api-key": "test_full_key" },
    payload: payload
  });

  assert.equal(response.statusCode, 400);
});

test("GET /v1/live/scoreboard rechaza ligas fuera de la allowlist", async function () {
  var response = await app.inject({
    method: "GET",
    url: "/v1/live/scoreboard?league=../../etc/passwd",
    headers: { "x-api-key": "test_live_key" }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "invalid_league");
});

test("GET /v1/live/summary valida el identificador del partido", async function () {
  var response = await app.inject({
    method: "GET",
    url: "/v1/live/summary?league=arg.1&event=../../x",
    headers: { "x-api-key": "test_live_key" }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "invalid_event");
});
