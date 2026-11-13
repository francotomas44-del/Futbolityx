import { HttpError } from "../../errors.js";
import { hmacSha256Hex, parseSignatureHeader, timingSafeEqualHex } from "./signatures.js";

var DEFAULT_API_BASE = "https://api.paddle.com";

export function isPaddleConfigured() {
  return !!(process.env.PADDLE_API_KEY && process.env.PADDLE_WEBHOOK_SECRET);
}

/**
 * Verifica el header `Paddle-Signature`:
 *   ts=<timestamp>;h1=<hmac>
 * El HMAC se calcula sobre `${ts}:${rawBody}` con el secreto del webhook.
 */
export function verifyPaddleSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  var parsed = parseSignatureHeader(signatureHeader);
  if (!parsed.ts || !parsed.h1) return false;

  var expected = hmacSha256Hex(secret, parsed.ts + ":" + String(rawBody || ""));
  return timingSafeEqualHex(expected, parsed.h1);
}

/**
 * Crea una transaccion de Paddle Billing y devuelve la URL de checkout.
 * Requiere PADDLE_API_KEY y un price_id creado en el dashboard.
 *
 * Nota: la URL de exito se configura en Paddle (o se usa la default). El
 * webhook trae `custom_data.user_id` para vincular la compra con la cuenta.
 */
export async function createPaddleCheckout(options) {
  if (!process.env.PADDLE_API_KEY) {
    throw new HttpError(503, "paddle_not_configured", "Paddle no esta configurado.");
  }

  var base = String(process.env.PADDLE_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
  var body = {
    items: [{ price_id: options.priceId, quantity: 1 }],
    custom_data: { user_id: options.userId }
  };

  if (options.email) body.customer = { email: options.email };

  var response = await fetch(base + "/transactions", {
    method: "POST",
    headers: {
      authorization: "Bearer " + process.env.PADDLE_API_KEY,
      "content-type": "application/json",
      "paddle-version": "1"
    },
    body: JSON.stringify(body)
  });

  var payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new HttpError(
      502,
      "paddle_error",
      "Paddle rechazo la creacion del checkout.",
      payload && payload.error ? payload.error : undefined
    );
  }

  var data = payload && payload.data ? payload.data : {};
  return {
    id: data.id || null,
    checkoutUrl: data.checkout && data.checkout.url ? data.checkout.url : null,
    raw: data
  };
}
