import { test } from "node:test";
import assert from "node:assert/strict";

import { getBillingStatus } from "../src/lib/plans.js";

var ENV_NAMES = [
  "PRICING_STATUS",
  "PADDLE_API_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "PLAN_PADDLE_PRO_MONTHLY",
  "MP_ACCESS_TOKEN",
  "MP_WEBHOOK_SECRET",
  "PLAN_MP_PRO_MONTHLY"
];

function clearBillingEnv() {
  ENV_NAMES.forEach(function (name) {
    delete process.env[name];
  });
}

test("billing requiere precios aprobados y proveedor completo", function () {
  var saved = {};
  ENV_NAMES.forEach(function (name) {
    saved[name] = process.env[name];
  });

  try {
    clearBillingEnv();

    var status = getBillingStatus();
    assert.equal(status.pricingStatus, "proposed");
    assert.equal(status.billing, "not_available");
    assert.equal(status.providers.paddle, false);
    assert.equal(status.providers.mercadopago, false);

    process.env.PRICING_STATUS = "approved";
    process.env.PADDLE_API_KEY = "paddle_test_key";
    process.env.PLAN_PADDLE_PRO_MONTHLY = "pri_test_pro";

    status = getBillingStatus();
    assert.equal(status.providers.paddle, false, "falta el webhook secret");
    assert.equal(status.billing, "not_available");

    process.env.PADDLE_WEBHOOK_SECRET = "paddle_test_secret";

    status = getBillingStatus();
    assert.equal(status.providers.paddle, true);
    assert.equal(status.billing, "available");
    assert.match(status.note, /habilitados/i);
  } finally {
    ENV_NAMES.forEach(function (name) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    });
  }
});

test("Mercado Pago tambien exige token, secret y plan ID", function () {
  var saved = {};
  ENV_NAMES.forEach(function (name) {
    saved[name] = process.env[name];
  });

  try {
    clearBillingEnv();
    process.env.PRICING_STATUS = "approved";
    process.env.MP_ACCESS_TOKEN = "mp_test_token";
    process.env.PLAN_MP_PRO_MONTHLY = "plan_test_pro";

    var status = getBillingStatus();
    assert.equal(status.providers.mercadopago, false, "falta el webhook secret");
    assert.equal(status.billing, "not_available");

    process.env.MP_WEBHOOK_SECRET = "mp_test_secret";

    status = getBillingStatus();
    assert.equal(status.providers.mercadopago, true);
    assert.equal(status.billing, "available");
  } finally {
    ENV_NAMES.forEach(function (name) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    });
  }
});
