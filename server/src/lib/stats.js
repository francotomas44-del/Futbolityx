import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * Reutiliza el mismo motor matematico del frontend (js/stats.js).
 * El archivo es una IIFE que publica window.AD.stats, asi que lo ejecutamos
 * con un `window` propio para no contaminar el global de Node.
 */
function loadStats() {
  var enginePath = process.env.STATS_ENGINE_PATH
    ? resolve(process.env.STATS_ENGINE_PATH)
    : fileURLToPath(new URL("../../../js/stats.js", import.meta.url));

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
