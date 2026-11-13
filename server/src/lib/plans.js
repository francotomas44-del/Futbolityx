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
 * Catalogo de planes. Los precios son una PROPUESTA y se pueden cambiar por
 * variables de entorno sin tocar codigo. La app todavia no cobra: el estado
 * "planned" lo deja explicito.
 */
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
      description: "Acceso inicial con analisis basico y limites diarios.",
      status: "available",
      recommended: false,
      price: {
        ars: { monthly: 0, yearly: 0 },
        usd: { monthly: 0, yearly: 0 }
      },
      providers: {},
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
      description: "Todas las herramientas de analisis, datos en vivo y exportacion.",
      status: "planned",
      recommended: true,
      price: {
        ars: { monthly: proArsMonthly, yearly: proArsYearly },
        usd: { monthly: proUsdMonthly, yearly: proUsdYearly }
      },
      providers: providerPrices("PLAN", "PRO"),
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
