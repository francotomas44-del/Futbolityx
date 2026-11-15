import { HttpError } from "../../errors.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Envia el magic link con Resend. Sin RESEND_API_KEY, en desarrollo imprime el
 * link en consola para poder probar el flujo sin proveedor de email.
 */
export async function sendMagicLinkEmail(options) {
  var apiKey = process.env.RESEND_API_KEY;
  var from = process.env.EMAIL_FROM;
  var link = options.link;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
      throw new HttpError(503, "email_not_configured", "El envio de emails no esta configurado.");
    }

    console.log("[auth] Magic link para " + options.to + ": " + link);
    return { delivered: false, dev: true };
  }

  var text = [
    "Entra a Futbolityx con este enlace:",
    link,
    "",
    "El enlace vence en 15 minutos y se puede usar una sola vez.",
    "Si no pediste este acceso, ignora este mensaje."
  ].join("\n");

  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">',
    "<h1 style=\"font-size:22px\">Futbolityx</h1>",
    "<p>Entra a tu cuenta con este enlace:</p>",
    '<p><a href="' + escapeHtml(link) + '" style="display:inline-block;background:#0b7a4b;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Entrar a Futbolityx</a></p>',
    "<p>El enlace vence en 15 minutos y se puede usar una sola vez.</p>",
    "<p>Si no pediste este acceso, ignora este mensaje.</p>",
    "</div>"
  ].join("");

  var response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: "Bearer " + apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: from,
      to: [options.to],
      subject: "Tu acceso a Futbolityx",
      text: text,
      html: html
    })
  });

  if (!response.ok) {
    var detail = null;
    try {
      detail = await response.json();
    } catch (error) {
      detail = null;
    }
    throw new HttpError(
      502,
      "email_error",
      "No se pudo enviar el email de acceso.",
      detail && detail.message ? { message: detail.message } : undefined
    );
  }

  return { delivered: true, dev: false };
}
