import { getBillingStatus, getPlans } from "../lib/plans.js";

export default async function healthRoutes(app, opts) {
  var config = opts.config;

  app.get("/v1/health", async function () {
    return {
      ok: true,
      service: config.service,
      version: config.version,
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString()
    };
  });

  app.get("/v1/meta", async function () {
    return {
      service: config.service,
      version: config.version,
      auth: "api-key",
      features: ["analyze", "live-scoreboard", "live-summary"],
      limits: {
        maxMatches: config.analyze.maxMatches,
        maxTeams: config.analyze.maxTeams,
        rateLimit: config.rateLimit
      }
    };
  });

  app.get("/v1/plans", async function () {
    var status = getBillingStatus();
    return {
      pricingStatus: status.pricingStatus,
      billing: status.billing,
      providers: status.providers,
      note: status.billing === "available"
        ? "Los pagos estan habilitados segun el proveedor configurado."
        : "Todavia no se procesan pagos. Los precios son una propuesta.",
      plans: getPlans()
    };
  });
}
