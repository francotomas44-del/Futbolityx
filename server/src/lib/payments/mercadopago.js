import { HttpError } from "../../errors.js";
import { hmacSha256Hex, parseSignatureHeader, timingSafeEqualHex } from "./signatures.js";

var DEFAULT_API_BASE = "https://api.mercadopago.com";

export function isMercadoPagoConfigured() {
  return !!(process.env.MP_ACCESS_TOKEN && process.env.MP_WEBHOOK_SECRET);
}

/**
 * Verifica el header `x-signature` de Mercado Pago:
 *   ts=<timestamp>,v1=<hmac>
 * Manifiesto: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * Si el data.id es alfanumerico, Mercado Pago lo envia en minusculas.
 */
export function verifyMercadoPagoSignature(options) {
  if (!options || !options.signatureHeader || !options.secret) return false;

  var parsed = parseSignatureHeader(options.signatureHeader);
  if (!parsed.ts || !parsed.v1) return false;

  var dataId = String(options.dataId || "").toLowerCase();
  var requestId = String(options.requestId || "");
  var manifest = "id:" + dataId + ";request-id:" + requestId + ";ts:" + parsed.ts + ";";
  var expected = hmacSha256Hex(options.secret, manifest);

  return timingSafeEqualHex(expected, parsed.v1);
}

/**
 * Obtiene el detalle de una suscripcion (preapproval). Los webhooks de
 * Mercado Pago solo envian el id; hay que consultar la API para saber el
 * estado real y el plan.
 */
export async function getMercadoPagoPreapproval(id) {
  if (!process.env.MP_ACCESS_TOKEN) {
    throw new HttpError(503, "mercadopago_not_configured", "Mercado Pago no esta configurado.");
  }

  var base = String(process.env.MP_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
  var response = await fetch(base + "/preapproval/" + encodeURIComponent(id), {
    headers: {
      authorization: "Bearer " + process.env.MP_ACCESS_TOKEN
    }
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
      "mercadopago_error",
      "Mercado Pago rechazo la consulta de la suscripcion.",
      payload && payload.message ? { message: payload.message } : undefined
    );
  }

  return payload;
}

/**
 * Crea una suscripcion (preapproval) a partir de un plan creado en Mercado Pago.
 * Devuelve el `init_point` para redirigir al usuario.
 */
export async function createMercadoPagoPreapproval(options) {
  if (!process.env.MP_ACCESS_TOKEN) {
    throw new HttpError(503, "mercadopago_not_configured", "Mercado Pago no esta configurado.");
  }

  var base = String(process.env.MP_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
  var body = {
    preapproval_plan_id: options.planId,
    payer_email: options.email,
    back_url: options.backUrl,
    external_reference: options.userId,
    status: "pending"
  };

  var response = await fetch(base + "/preapproval", {
    method: "POST",
    headers: {
      authorization: "Bearer " + process.env.MP_ACCESS_TOKEN,
      "content-type": "application/json"
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
      "mercadopago_error",
      "Mercado Pago rechazo la creacion de la suscripcion.",
      payload && payload.message ? { message: payload.message } : undefined
    );
  }

  return {
    id: payload.id || null,
    initPoint: payload.init_point || null,
    raw: payload
  };
}

/**
 * Cancela una suscripcion (preapproval) de Mercado Pago. El acceso local se
 * mantiene hasta current_period_end segun la politica de Futbolityx.
 */
export async function cancelMercadoPagoPreapproval(id) {
  if (!process.env.MP_ACCESS_TOKEN) {
    throw new HttpError(503, "mercadopago_not_configured", "Mercado Pago no esta configurado.");
  }

  var base = String(process.env.MP_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
  var response = await fetch(base + "/preapproval/" + encodeURIComponent(id), {
    method: "PUT",
    headers: {
      authorization: "Bearer " + process.env.MP_ACCESS_TOKEN,
      "content-type": "application/json"
    },
    body: JSON.stringify({ status: "cancelled" })
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
      "mercadopago_error",
      "Mercado Pago rechazo la cancelacion de la suscripcion.",
      payload && payload.message ? { message: payload.message } : undefined
    );
  }

  return payload || {};
}
