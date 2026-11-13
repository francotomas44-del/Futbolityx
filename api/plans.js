import { getPlans } from "../server/src/lib/plans.js";
import { applyCors, methodNotAllowed, sendJson } from "./_lib/http.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204);
  }

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "OPTIONS"]);
  }

  sendJson(res, 200, {
    pricingStatus: "proposed",
    billing: "not_available",
    providers: ["paddle", "mercadopago"],
    note: "Todavia no se procesan pagos. Los precios son una propuesta.",
    plans: getPlans()
  });
}
