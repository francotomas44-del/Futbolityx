import { getAccountService } from "../_lib/auth.js";
import { verifyPaddleSignature } from "../../server/src/lib/payments/paddle.js";
import { HttpError } from "../../server/src/errors.js";

function json(body, status) {
  return Response.json(body, {
    status: status,
    headers: { "cache-control": "no-store" }
  });
}

export async function POST(request) {
  try {
    var secret = process.env.PADDLE_WEBHOOK_SECRET;
    if (!secret) {
      return json({
        error: { code: "webhook_not_configured", message: "El webhook de Paddle no esta configurado." }
      }, 503);
    }

    var raw = await request.text();
    var signature = request.headers.get("paddle-signature");

    if (!verifyPaddleSignature(raw, signature, secret)) {
      return json({
        error: { code: "invalid_signature", message: "Firma de Paddle invalida." }
      }, 401);
    }

    var event;
    try {
      event = JSON.parse(raw);
    } catch (error) {
      return json({
        error: { code: "invalid_json", message: "El cuerpo no es JSON valido." }
      }, 400);
    }

    var result = await getAccountService().processPaddleEvent(event);
    return json(result, 200);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({
        error: { code: error.code, message: error.message, details: error.details }
      }, error.statusCode);
    }

    console.error("paddle_webhook", error);
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
