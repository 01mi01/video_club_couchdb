/**
 * ============================================================================
 * REGLAS DE NEGOCIO DE PRECIOS Y DESCUENTOS  (funciones puras)
 * ============================================================================
 *
 * Aquí NO se toca CouchDB. Son funciones puras y testeables a mano que
 * concentran las reglas del enunciado:
 *
 *   - Costos por día de préstamo (configurable):
 *       1 día = 2 Bs | 2 días = 3 Bs | 3 días = 4 Bs | 4 días = 5 Bs | 5 días = 6 Bs
 *     => "No deben permitirse préstamos mayores a los días configurados".
 *
 *   - Descuentos por cantidad de películas (configurable):
 *       3 a 5 películas  => 5%
 *       más de 5         => 10%
 *
 * Los DEFAULTS del enunciado viven como constantes (no como datos semilla
 * en la base). `configService` los mezcla con lo que el propietario haya
 * guardado vía PUT.
 * ============================================================================
 */

// Costo total por película para un préstamo de N días (según tabla).
// La clave es el nº de días; el valor, el precio en Bs para ESE plazo.
const DEFAULT_PRICE_BY_DAYS = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };

// Tramos de descuento. `max_qty: null` == sin tope superior.
const DEFAULT_DISCOUNT_TIERS = [
  { min_qty: 3, max_qty: 5, percent: 5 },
  { min_qty: 6, max_qty: null, percent: 10 },
];

/** Máximo de días permitido = mayor clave presente en la tabla de precios. */
function maxDaysFromTable(priceByDays) {
  return Math.max(...Object.keys(priceByDays).map(Number));
}

/**
 * Valida que el plazo pedido sea entero, >= 1 y <= máximo configurado.
 * Lanza un objeto { statusCode, message } que el servicio convierte en 422.
 */
function assertDaysAllowed(days, priceByDays) {
  const max = maxDaysFromTable(priceByDays);
  if (!Number.isInteger(days) || days < 1) {
    const e = new Error('El número de días de préstamo debe ser un entero >= 1.');
    e.statusCode = 422;
    throw e;
  }
  if (days > max) {
    const e = new Error(
      `No se permiten préstamos de más de ${max} días (plazo pedido: ${days}).`
    );
    e.statusCode = 422;
    throw e;
  }
}

/** Precio por película para el plazo dado. */
function pricePerMovie(days, priceByDays) {
  return priceByDays[days];
}

/** Porcentaje de descuento aplicable según cuántas películas lleva. */
function discountPercentFor(moviesCount, tiers) {
  const tier = tiers.find(
    (t) =>
      moviesCount >= t.min_qty && (t.max_qty == null || moviesCount <= t.max_qty)
  );
  return tier ? tier.percent : 0;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Cálculo completo del importe de un préstamo.
 *
 * @param {number} days           Días de préstamo.
 * @param {number} moviesCount    Cantidad de películas.
 * @param {object} pricingCfg     { price_by_days, ... }
 * @param {object} discountsCfg   { tiers }
 * @returns desglose para guardar en `loan.pricing` y para la factura.
 */
function quote(days, moviesCount, pricingCfg, discountsCfg) {
  const priceByDays = pricingCfg.price_by_days;
  assertDaysAllowed(days, priceByDays);

  if (!Number.isInteger(moviesCount) || moviesCount < 1) {
    const e = new Error('El préstamo debe incluir al menos una película.');
    e.statusCode = 422;
    throw e;
  }

  const perMovie = pricePerMovie(days, priceByDays);
  const baseAmount = round2(perMovie * moviesCount);
  const discountPercent = discountPercentFor(moviesCount, discountsCfg.tiers);
  const discountAmount = round2((baseAmount * discountPercent) / 100);
  const totalAmount = round2(baseAmount - discountAmount);

  return {
    price_per_day: priceByDays[1], // referencia (tarifa de 1 día)
    price_per_movie: perMovie,
    movies_count: moviesCount,
    base_amount: baseAmount,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    total_amount: totalAmount,
  };
}

/**
 * Días transcurridos entre dos fechas ISO, redondeando hacia arriba
 * (cualquier fracción de día cuenta como día completo). Mínimo 1.
 */
function daysBetween(fromISO, toISO) {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return Math.max(1, d);
}

module.exports = {
  DEFAULT_PRICE_BY_DAYS,
  DEFAULT_DISCOUNT_TIERS,
  maxDaysFromTable,
  assertDaysAllowed,
  discountPercentFor,
  quote,
  daysBetween,
  round2,
};
