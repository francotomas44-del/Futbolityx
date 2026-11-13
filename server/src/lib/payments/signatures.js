import crypto from "node:crypto";

export function hmacSha256Hex(secret, payload) {
  return crypto.createHmac("sha256", String(secret)).update(String(payload)).digest("hex");
}

export function timingSafeEqualHex(left, right) {
  var a = Buffer.from(String(left || ""), "hex");
  var b = Buffer.from(String(right || ""), "hex");
  if (!a.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Convierte `ts=123;h1=abc` o `ts=123,v1=abc` en un objeto.
 * Los proveedores usan separadores distintos; aceptamos ambos.
 */
export function parseSignatureHeader(header) {
  var out = {};
  String(header || "")
    .split(/[;,]/)
    .forEach(function (part) {
      var index = part.indexOf("=");
      if (index <= 0) return;
      var key = part.slice(0, index).trim();
      var value = part.slice(index + 1).trim();
      if (key) out[key] = value;
    });
  return out;
}
