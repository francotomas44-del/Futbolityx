import { getBillingStatus, getPlans } from "../server/src/lib/plans.js";
import { applyCors, methodNotAllowed, sendJson } from "./_lib/http.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "OPTIONS"]);
  }

  var status = getBillingStatus();
  sendJson(res, 200, {
    pricingStatus: status.pricingStatus,
    billing: status.billing,
    providers: status.providers,
    note: status.billing === "available"
      ? "Los pagos estan habilitados segun el proveedor configurado."
      : "Todavia no se procesan pagos. Los precios son una propuesta.",
    plans: getPlans()
  });
}
