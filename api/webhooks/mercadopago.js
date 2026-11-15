import { getAccountService } from "../_lib/auth.js";
import { verifyMercadoPagoSignature } from "../../server/src/lib/payments/mercadopago.js";
import { HttpError } from "../../server/src/errors.js";

function json(body, status) {
  return Response.json(body, {
    status: status,
    headers: { "cache-control": "no-store" }
  });
}

export async function POST(request) {
  try {
    var secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      return json({
        error: { code: "webhook_not_configured", message: "El webhook de Mercado Pago no esta configurado." }
      }, 503);
    }

    var raw = await request.text();
    var event;
    try {
      event = JSON.parse(raw);
    } catch (error) {
      return json({
        error: { code: "invalid_json", message: "El cuerpo no es JSON valido." }
      }, 400);
    }

    var url = new URL(request.url);
    var dataId = url.searchParams.get("data.id") ||
      url.searchParams.get("data_id") ||
      (event.data && event.data.id);

    var valid = verifyMercadoPagoSignature({
      dataId: dataId,
      requestId: request.headers.get("x-request-id"),
      signatureHeader: request.headers.get("x-signature"),
      secret: secret
    });

    if (!valid) {
      return json({
        error: { code: "invalid_signature", message: "Firma de Mercado Pago invalida." }
      }, 401);
    }

    var result = await getAccountService().processMercadoPagoEvent(event);
    return json(result, 200);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({
        error: { code: error.code, message: error.message, details: error.details }
      }, error.statusCode);
    }

    console.error("mercadopago_webhook", error);
    return json({
      error: { code: "internal_error", message: "Error interno." }
    }, 500);
  }
}

export async function GET() {
  return json({
    error: { code: "method_not_allowed", message: "Metodo no permitido." }
  }, 405);
}
