import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * Reutiliza el mismo motor matematico del frontend (js/stats.js).
 * El archivo es una IIFE que publica window.AD.stats, asi que lo ejecutamos
 * con un `window` propio para no contaminar el global de Node.
 *
 * En Vercel el archivo se incluye con `includeFiles` y queda en
 * process.cwd()/js/stats.js; en Docker/local se resuelve por ruta relativa.
 */
function resolveEnginePath() {
  var candidates = [];

  if (process.env.STATS_ENGINE_PATH) {
    candidates.push(resolve(process.env.STATS_ENGINE_PATH));
  }

  candidates.push(resolve(process.cwd(), "js/stats.js"));
  candidates.push(fileURLToPath(new URL("../../../js/stats.js", import.meta.url)));

  for (var i = 0; i < candidates.length; i++) {
    if (existsSync(candidates[i])) return candidates[i];
  }

  throw new Error("No se encontro js/stats.js. Rutas probadas: " + candidates.join(", "));
}

function loadStats() {
  var enginePath = resolveEnginePath();

  var source;
  try {
    source = readFileSync(enginePath, "utf8");
  } catch (e) {
    throw new Error("No se pudo cargar el motor estadistico en " + enginePath + ": " + e.message);
  }

  var factory = new Function("window", source + "\nreturn window.AD.stats;");
  var stats = factory({});

  if (!stats || typeof stats.teamStats !== "function") {
    throw new Error("El motor estadistico no expone las funciones esperadas.");
  }

  return stats;
}

export var stats = loadStats();
