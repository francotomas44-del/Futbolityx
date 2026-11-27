import { HttpError } from "../errors.js";
import { isAdminEmail } from "./admin.js";

/**
 * Modo de prueba cerrada.
 *
 * BETA_MODE=closed limita el acceso a los emails de BETA_ALLOWED_EMAILS.
 * BETA_TEST_PLAN otorga ese plan a los invitados sin pasar por un proveedor.
 * BETA_DISABLE_CHECKOUT=false permite probar el checkout sandbox, si se quiere.
 *
 * La app publica sigue funcionando: solo se bloquean cuentas, no el análisis
 * local ni los datos historicos.
 */
var ENABLED_VALUES = ["closed", "private", "beta", "true", "1"];
var VALID_PLANS = ["free", "pro", "elite"];

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeEmail(email) {
  return clean(email).toLowerCase();
}

function listFromEnv(value) {
  return String(value || "")
    .split(",")
    .map(function (entry) { return normalizeEmail(entry); })
    .filter(Boolean);
}

export function getBetaConfig() {
  var mode = clean(process.env.BETA_MODE).toLowerCase();
  var enabled = ENABLED_VALUES.indexOf(mode) !== -1;
  var testPlan = clean(process.env.BETA_TEST_PLAN).toLowerCase() || "pro";
  if (VALID_PLANS.indexOf(testPlan) === -1) testPlan = "pro";

  var label = clean(process.env.BETA_LABEL) || "Prueba cerrada";
  var disableCheckout = clean(process.env.BETA_DISABLE_CHECKOUT).toLowerCase() !== "false";

  return {
    enabled: enabled,
    mode: enabled ? "closed" : "off",
    label: label,
    allowedEmails: listFromEnv(process.env.BETA_ALLOWED_EMAILS || process.env.BETA_EMAILS),
    testPlan: testPlan,
    disableCheckout: disableCheckout
  };
}

export function isBetaEnabled() {
  return getBetaConfig().enabled;
}

export function isBetaTester(email) {
  var config = getBetaConfig();
  if (!config.enabled || !config.allowedEmails.length) return false;
  return config.allowedEmails.indexOf(normalizeEmail(email)) !== -1;
}

export function assertBetaAccess(email) {
  if (isAdminEmail(email)) return;
  if (!getBetaConfig().enabled || isBetaTester(email)) return;

  throw new HttpError(
    403,
    "beta_invite_required",
    "Esta es una prueba cerrada. Tu email no esta en la lista de invitados."
  );
}

/** Datos de beta que se exponen en /v1/account. */
export function getBetaForUser(email) {
  var config = getBetaConfig();
  var invited = isBetaTester(email);

  return {
    enabled: config.enabled,
    mode: config.mode,
    label: config.label,
    invited: invited,
    testPlan: invited ? config.testPlan : null,
    checkoutDisabled: config.enabled && config.disableCheckout
  };
}

/** Datos publicos de beta que se exponen en /v1/plans y /v1/meta. */
export function getBetaStatus() {
  var config = getBetaConfig();

  return {
    enabled: config.enabled,
    mode: config.mode,
    label: config.label,
    inviteRequired: config.enabled,
    checkoutDisabled: config.enabled && config.disableCheckout,
    testPlan: config.enabled ? config.testPlan : null,
    invitedCount: config.allowedEmails.length
  };
}
