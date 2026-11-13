import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.API_KEYS = JSON.stringify([
  { id: "vercel-dev", key: "vercel_dev_key", scopes: ["*"], ips: [] }
]);

const health = (await import("../../api/health.js")).default;
const plans = (await import("../../api/plans.js")).default;
const whoami = (await import("../../api/whoami.js")).default;
const analyze = (await import("../../api/analyze.js")).default;
const scoreboard = (await import("../../api/live/scoreboard.js")).default;
const summary = (await import("../../api/live/summary.js")).default;

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
  assert.deepEqual(body.providers, ["paddle", "mercadopago"]);
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
