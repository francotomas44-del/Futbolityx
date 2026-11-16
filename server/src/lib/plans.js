import { isMercadoPagoConfigured } from "./payments/mercadopago.js";
import { isPaddleConfigured } from "./payments/paddle.js";

function numberFromEnv(name, fallback) {
  var value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function stringFromEnv(name) {
  var value = String(process.env[name] || "").trim();
  return value || null;
}

function providerPrices(prefix, plan) {
  return {
    paddle: {
      monthlyPriceId: stringFromEnv(prefix + "_PADDLE_" + plan + "_MONTHLY"),
      yearlyPriceId: stringFromEnv(prefix + "_PADDLE_" + plan + "_YEARLY")
    },
    mercadopago: {
      monthlyPlanId: stringFromEnv(prefix + "_MP_" + plan + "_MONTHLY"),
      yearlyPlanId: stringFromEnv(prefix + "_MP_" + plan + "_YEARLY")
    }
  };
}

/**
 * Estado del catalogo y de los cobros. `pricingStatus` queda en "proposed"
 * hasta que se aprueben los precios. `billing` solo pasa a "available" cuando
 * los precios estan aprobados Y al menos un proveedor tiene credenciales y
 * price/plan IDs configurados. `providers` refleja la configuracion de cada
 * proveedor por separado.
 */
export function getBillingStatus() {
  var plans = getPlans();
  var pricingApproved = process.env.PRICING_STATUS === "approved";
  var paddleConfigured = isPaddleConfigured() && plans.some(function (plan) {
    return plan.providers.paddle &&
      (plan.providers.paddle.monthlyPriceId || plan.providers.paddle.yearlyPriceId);
  });
  var mercadoPagoConfigured = isMercadoPagoConfigured() && plans.some(function (plan) {
    return plan.providers.mercadopago &&
      (plan.providers.mercadopago.monthlyPlanId || plan.providers.mercadopago.yearlyPlanId);
  });

  var billingAvailable = pricingApproved && (paddleConfigured || mercadoPagoConfigured);
  var note = billingAvailable
    ? "Los pagos estan habilitados segun el proveedor configurado."
    : pricingApproved
      ? "Los precios estan aprobados, pero falta configurar un proveedor de pagos."
      : "Los precios aun no estan aprobados; los cobros estan deshabilitados.";

  return {
    pricingStatus: pricingApproved ? "approved" : "proposed",
    billing: billingAvailable ? "available" : "not_available",
    note: note,
    providers: {
      paddle: paddleConfigured,
      mercadopago: mercadoPagoConfigured
    }
  };
}

export function getPlan(planId) {
  var plans = getPlans();
  for (var i = 0; i < plans.length; i++) {
    if (plans[i].id === planId) return plans[i];
  }
  return plans[0];
}

export function getPlans() {
  var proArsMonthly = numberFromEnv("PLAN_PRO_ARS_MONTHLY", 6900);
  var proArsYearly = numberFromEnv("PLAN_PRO_ARS_YEARLY", 59000);
  var proUsdMonthly = numberFromEnv("PLAN_PRO_USD_MONTHLY", 9);
  var proUsdYearly = numberFromEnv("PLAN_PRO_USD_YEARLY", 90);

  var eliteArsMonthly = numberFromEnv("PLAN_ELITE_ARS_MONTHLY", 14900);
  var eliteArsYearly = numberFromEnv("PLAN_ELITE_ARS_YEARLY", 129000);
  var eliteUsdMonthly = numberFromEnv("PLAN_ELITE_USD_MONTHLY", 19);
  var eliteUsdYearly = numberFromEnv("PLAN_ELITE_USD_YEARLY", 190);

  return [
    {
      id: "free",
      name: "Free",
      description: "Acceso inicial con análisis básico y límites diarios.",
      status: "available",
      recommended: false,
      price: {
        ars: { monthly: 0, yearly: 0 },
        usd: { monthly: 0, yearly: 0 }
      },
      providers: {},
      highlights: [
        "10 análisis por día",
        "Hoy y análisis básico",
        "Historial de 30 días"
      ],
      limits: {
        analysesPerDay: 10,
        historyDays: 30,
        exports: false
      },
      features: {
        hoy: true,
        analisisBasico: true,
        evaluacion: false,
        rendimiento: false,
        informe: false,
        datos: false,
        live: false,
        noticias: false,
        exportar: false,
        backtesting: false,
        evKelly: false
      }
    },
    {
      id: "pro",
      name: "Pro",
      description: "Todas las herramientas de análisis, datos en vivo y exportación.",
      status: "planned",
      recommended: true,
      price: {
        ars: { monthly: proArsMonthly, yearly: proArsYearly },
        usd: { monthly: proUsdMonthly, yearly: proUsdYearly }
      },
      providers: providerPrices("PLAN", "PRO"),
      highlights: [
        "Análisis ilimitado",
        "Datos en vivo",
        "Evaluación y rendimiento",
        "Informe y exportación"
      ],
      limits: {
        analysesPerDay: 1000,
        historyDays: null,
        exports: true
      },
      features: {
        hoy: true,
        analisisBasico: true,
        evaluacion: true,
        rendimiento: true,
        informe: true,
        datos: true,
        live: true,
        noticias: true,
        exportar: true,
        backtesting: true,
        evKelly: true
      }
    },
    {
      id: "elite",
      name: "Elite",
      description: "Alertas, modelos configurables, API y soporte prioritario.",
      status: "planned",
      recommended: false,
      price: {
        ars: { monthly: eliteArsMonthly, yearly: eliteArsYearly },
        usd: { monthly: eliteUsdMonthly, yearly: eliteUsdYearly }
      },
      providers: providerPrices("PLAN", "ELITE"),
      highlights: [
        "Todo lo de Pro",
        "Alertas y modelos configurables",
        "API y soporte prioritario"
      ],
      limits: {
        analysesPerDay: null,
        historyDays: null,
        exports: true
      },
      features: {
        hoy: true,
        analisisBasico: true,
        evaluacion: true,
        rendimiento: true,
        informe: true,
        datos: true,
        live: true,
        noticias: true,
        exportar: true,
        backtesting: true,
        evKelly: true,
        alertas: true,
        modelosConfigurables: true,
        api: true,
        soportePrioritario: true
      }
    }
  ];
}
