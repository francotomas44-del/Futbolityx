/**
 * Roles de administrador definidos en el servidor.
 *
 * ADMIN_EMAILS acepta una lista de emails separados por coma. El email se
 * toma siempre del ID token verificado de Firebase (o del magic link), nunca
 * del navegador. Los administradores tienen acceso completo a los servicios
 * y no quedan trabados por la beta cerrada.
 */
function normalizeEmail(email) {
  return String(email == null ? "" : email).trim().toLowerCase();
}

function listFromEnv(value) {
  return String(value || "")
    .split(",")
    .map(function (entry) { return normalizeEmail(entry); })
    .filter(Boolean);
}

export function getAdminEmails() {
  return listFromEnv(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL);
}

export function isAdminEmail(email) {
  var normalized = normalizeEmail(email);
  return normalized ? getAdminEmails().indexOf(normalized) !== -1 : false;
}

/**
 * Roles de la app:
 * - admin: emails de ADMIN_EMAILS, siempre plan Elite.
 * - guest: cualquier cuenta verificada de Firebase sin plan de pago; plan Free.
 * - member: cuenta con plan superior (beta o suscripcion).
 */
export function roleFor(email, planId) {
  if (isAdminEmail(email)) return "admin";
  if (planId && planId !== "free") return "member";
  return "guest";
}
