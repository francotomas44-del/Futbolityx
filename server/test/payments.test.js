import { test } from "node:test";
import assert from "node:assert/strict";
import { hmacSha256Hex } from "../src/lib/payments/signatures.js";
import { verifyPaddleSignature } from "../src/lib/payments/paddle.js";
import { verifyMercadoPagoSignature } from "../src/lib/payments/mercadopago.js";

test("firma de webhook de Paddle", function () {
  var secret = "paddle_test_secret";
  var body = '{"event_type":"subscription.created"}';
  var ts = "1700000000";
  var h1 = hmacSha256Hex(secret, ts + ":" + body);

  assert.equal(verifyPaddleSignature(body, "ts=" + ts + ";h1=" + h1, secret), true);
  assert.equal(verifyPaddleSignature(body + "x", "ts=" + ts + ";h1=" + h1, secret), false);
  assert.equal(verifyPaddleSignature(body, "ts=" + ts + ";h1=" + h1, ""), false);
});

test("firma de webhook de Mercado Pago", function () {
  var secret = "mp_test_secret";
  var dataId = "ABC123";
  var requestId = "req-1";
  var ts = "1700000000";
  var manifest = "id:" + dataId.toLowerCase() + ";request-id:" + requestId + ";ts:" + ts + ";";
  var v1 = hmacSha256Hex(secret, manifest);

  assert.equal(verifyMercadoPagoSignature({
    dataId: dataId,
    requestId: requestId,
    signatureHeader: "ts=" + ts + ",v1=" + v1,
    secret: secret
  }), true);

  assert.equal(verifyMercadoPagoSignature({
    dataId: "otro",
    requestId: requestId,
    signatureHeader: "ts=" + ts + ",v1=" + v1,
    secret: secret
  }), false);
});
