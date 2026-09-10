/**
 * Servicio de CONFIGURACIÓN de precios y descuentos.
 *
 * Responsabilidad: entregar SIEMPRE una configuración válida y completa
 * al cálculo de préstamos, venga o no de la base:
 *   - Si el propietario ya hizo el PUT -> se usa el documento guardado.
 *   - Si no -> se usan los defaults del enunciado (pricing.js), marcando
 *     `persisted: false` para que quede claro en la respuesta.
 */

const configRepo = require('../repositories/configRepository');
const pricing = require('./pricing');
const { badRequest } = require('../utils/errors');

/** Configuración de precios efectiva (guardada o default). */
async function getPricing() {
  const doc = await configRepo.getPricing();
  if (doc) {
    return {
      persisted: true,
      price_by_days: doc.price_by_days,
      max_days: pricing.maxDaysFromTable(doc.price_by_days),
      updated_at: doc.updated_at,
    };
  }
  return {
    persisted: false,
    price_by_days: pricing.DEFAULT_PRICE_BY_DAYS,
    max_days: pricing.maxDaysFromTable(pricing.DEFAULT_PRICE_BY_DAYS),
  };
}

/** Configuración de descuentos efectiva (guardada o default). */
async function getDiscounts() {
  const doc = await configRepo.getDiscounts();
  if (doc) {
    return { persisted: true, tiers: doc.tiers, updated_at: doc.updated_at };
  }
  return { persisted: false, tiers: pricing.DEFAULT_DISCOUNT_TIERS };
}

/**
 * Guarda/actualiza los costos por día.
 * Valida que sea un mapa { dias: precio } con enteros >= 1 consecutivos
 * desde 1 y precios > 0 (así `max_days` = mayor clave tiene sentido).
 */
async function setPricing(body) {
  const map = body && body.price_by_days;
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    throw badRequest('Se espera `price_by_days` como objeto { dias: precio }.');
  }
  const days = Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b);
  if (days.length === 0) throw badRequest('`price_by_days` no puede estar vacío.');
  days.forEach((d, i) => {
    if (!Number.isInteger(d) || d !== i + 1) {
      throw badRequest(
        'Las claves de `price_by_days` deben ser 1,2,3,... sin huecos (1 día, 2 días, ...).'
      );
    }
    const price = map[d];
    if (typeof price !== 'number' || price <= 0) {
      throw badRequest(`El precio para ${d} día(s) debe ser un número > 0.`);
    }
  });
  const saved = await configRepo.savePricing({ price_by_days: map });
  return {
    persisted: true,
    price_by_days: saved.price_by_days,
    max_days: pricing.maxDaysFromTable(saved.price_by_days),
    updated_at: saved.updated_at,
  };
}

/**
 * Guarda/actualiza los tramos de descuento.
 * Cada tramo: { min_qty, max_qty (null = sin tope), percent }.
 */
async function setDiscounts(body) {
  const tiers = body && body.tiers;
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw badRequest('Se espera `tiers` como arreglo no vacío de tramos.');
  }
  tiers.forEach((t, i) => {
    if (!Number.isInteger(t.min_qty) || t.min_qty < 1) {
      throw badRequest(`Tramo ${i}: \`min_qty\` debe ser entero >= 1.`);
    }
    if (t.max_qty != null && (!Number.isInteger(t.max_qty) || t.max_qty < t.min_qty)) {
      throw badRequest(`Tramo ${i}: \`max_qty\` debe ser null o entero >= min_qty.`);
    }
    if (typeof t.percent !== 'number' || t.percent < 0 || t.percent > 100) {
      throw badRequest(`Tramo ${i}: \`percent\` debe estar entre 0 y 100.`);
    }
  });
  const saved = await configRepo.saveDiscounts({ tiers });
  return { persisted: true, tiers: saved.tiers, updated_at: saved.updated_at };
}

/**
 * Devuelve la configuración efectiva lista para `pricing.quote()`.
 * Un único punto de lectura para el servicio de préstamos.
 */
async function effectiveConfig() {
  const [p, d] = await Promise.all([getPricing(), getDiscounts()]);
  return {
    pricing: { price_by_days: p.price_by_days },
    discounts: { tiers: d.tiers },
    max_days: p.max_days,
  };
}

module.exports = {
  getPricing,
  getDiscounts,
  setPricing,
  setDiscounts,
  effectiveConfig,
};
