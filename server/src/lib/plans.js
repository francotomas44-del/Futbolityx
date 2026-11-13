function priceFromEnv(name, fallback) {
  var value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Catalogo de planes. Los precios son una PROPUESTA y se pueden cambiar por
 * variables de entorno sin tocar codigo. La app todavia no cobra: el estado
 * "planned" lo deja explicito.
 */
export function getPlans() {
  var proArsMonthly = priceFromEnv("PLAN_PRO_ARS_MONTHLY", 6900);
  var proArsYearly = priceFromEnv("PLAN_PRO_ARS_YEARLY", 59000);
  var proUsdMonthly = priceFromEnv("PLAN_PRO_USD_MONTHLY", 9);

  return [
    {
      id: "free",
      name: "Free",
      status: "available",
      price: {
        currency: "ARS",
        monthly: 0,
        yearly: 0
      },
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
      status: "planned",
      price: {
        currency: "ARS",
        monthly: proArsMonthly,
        yearly: proArsYearly
      },
      altPrice: {
        currency: "USD",
        monthly: proUsdMonthly
      },
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
      status: "planned",
      price: null,
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
