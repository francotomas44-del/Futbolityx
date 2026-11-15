export function parseCookies(header) {
  var out = {};

  String(header || "")
    .split(";")
    .forEach(function (part) {
      var index = part.indexOf("=");
      if (index <= 0) return;
      var key = part.slice(0, index).trim();
      var value = part.slice(index + 1).trim();
      if (!key) return;
      try {
        out[key] = decodeURIComponent(value);
      } catch (error) {
        out[key] = value;
      }
    });

  return out;
}

export function getSessionToken(cookieHeader, cookieName) {
  var cookies = parseCookies(cookieHeader);
  return cookies[cookieName] || null;
}

export function serializeSessionCookie(token, options) {
  options = options || {};
  var parts = [
    options.name + "=" + encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=" + String(options.maxAge || 0)
  ];

  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(options) {
  options = options || {};
  var parts = [
    options.name + "=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}
