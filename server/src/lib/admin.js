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

export function roleForEmail(email) {
  return isAdminEmail(email) ? "admin" : "user";
}
