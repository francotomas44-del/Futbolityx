import "dotenv/config";

function splitList(value) {
  return String(value || "")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

function parseApiKeys(raw) {
  if (!raw) return [];

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error("API_KEYS debe ser JSON valido.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("API_KEYS debe ser un array de objetos.");
  }

  return parsed.map(function (entry, index) {
    if (!entry || typeof entry !== "object") {
      throw new Error("API_KEYS[" + index + "] debe ser un objeto.");
    }
    if (!entry.id || typeof entry.id !== "string") {
      throw new Error("API_KEYS[" + index + "] necesita un id.");
    }
    if (!entry.key && !entry.keyHash) {
      throw new Error("API_KEYS[" + index + "] necesita key o keyHash.");
    }
    if (entry.keyHash && !/^[a-f0-9]{64}$/i.test(String(entry.keyHash))) {
      throw new Error("API_KEYS[" + index + "].keyHash debe ser SHA-256 en hexadecimal.");
    }

    var scopes = Array.isArray(entry.scopes) && entry.scopes.length
      ? entry.scopes.map(String)
      : ["*"];
    var ips = Array.isArray(entry.ips) ? entry.ips.map(String) : [];

    return {
      id: String(entry.id),
      key: entry.key ? String(entry.key) : null,
      keyHash: entry.keyHash ? String(entry.keyHash).toLowerCase() : null,
      scopes: scopes,
      ips: ips
    };
  });
}

function parseTrustProxy(value) {
  if (!value || value === "false" || value === "0") return false;
  if (value === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

function positiveInt(value, fallback) {
  var n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

var nodeEnv = process.env.NODE_ENV || "development";
var isProduction = nodeEnv === "production" || process.env.VERCEL === "1";

export var config = {
  service: "futbolityx-api",
  version: "0.1.0",
  env: nodeEnv,
  isProduction: isProduction,
  appUrl: process.env.APP_URL || "http://localhost:8766",
  apiPublicUrl: process.env.API_PUBLIC_URL || "",
  host: process.env.HOST || "0.0.0.0",
  port: positiveInt(process.env.PORT, 8787),
  logLevel: process.env.LOG_LEVEL || "info",
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  corsOrigins: splitList(
    process.env.CORS_ORIGINS ||
      "https://francotomas44-del.github.io,http://localhost:8766,http://127.0.0.1:8766"
  ),

  apiKeys: parseApiKeys(process.env.API_KEYS),
  ipAllowlist: splitList(process.env.IP_ALLOWLIST),

  bodyLimit: positiveInt(process.env.BODY_LIMIT_BYTES, 4500000),

  rateLimit: {
    max: positiveInt(process.env.RATE_LIMIT_MAX, 60),
    timeWindow: process.env.RATE_LIMIT_WINDOW || "1 minute"
  },

  analyze: {
    maxMatches: positiveInt(process.env.ANALYZE_MAX_MATCHES, 50000),
    maxTeams: positiveInt(process.env.ANALYZE_MAX_TEAMS, 20000)
  },

  upstream: {
    timeoutMs: positiveInt(process.env.UPSTREAM_TIMEOUT_MS, 8000),
    cacheMs: positiveInt(process.env.UPSTREAM_CACHE_MS, 30000)
  },

  auth: {
    sessionCookie: process.env.SESSION_COOKIE_NAME || "futbolityx_session",
    sessionDays: positiveInt(process.env.SESSION_DAYS, 30),
    magicLinkMinutes: positiveInt(process.env.MAGIC_LINK_MINUTES, 15),
    devMode: process.env.AUTH_DEV_MODE === "true"
  },

  email: {
    from: process.env.EMAIL_FROM || "",
    resendApiKey: process.env.RESEND_API_KEY || ""
  },

  billing: {
    returnUrl: process.env.BILLING_RETURN_URL || ""
  }
};
