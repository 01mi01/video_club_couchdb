/**
 * Reglas de negocio de precios y descuentos (funciones puras, no tocan
 * CouchDB). Defaults del enunciado: 1-5 días = 2..6 Bs; 3-5 películas =
 * 5% descuento, más de 5 = 10%. `configService` los combina con lo que el
 * propietario haya guardado vía PUT.
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

/** Tarifa del día MÁS ALTO configurado en la tabla (dinámico: si la tabla
 *  cambia vía `PUT /api/config/pricing`, esto se recalcula solo, nunca es
 *  un valor fijo en código). */
function maxDayRate(priceByDays) {
  return priceByDays[maxDaysFromTable(priceByDays)];
}

/** Arma el desglose común (monto base + descuento) a partir de un precio
 *  por película ya resuelto. Compartido por `quote()` y `quoteReturn()`. */
function buildBreakdown(perMovie, moviesCount, priceByDays, discountsCfg) {
  if (!Number.isInteger(moviesCount) || moviesCount < 1) {
    const e = new Error('El préstamo debe incluir al menos una película.');
    e.statusCode = 422;
    throw e;
  }
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
 * Importe al registrar/cotizar un préstamo. Aquí aplica el tope de días
 * configurado (`assertDaysAllowed`) — es una regla de aceptación del plazo
 * pedido, no se reutiliza para capear el cobro de una devolución tardía
 * real (ver `quoteReturn`).
 */
function quote(days, moviesCount, pricingCfg, discountsCfg) {
  const priceByDays = pricingCfg.price_by_days;
  assertDaysAllowed(days, priceByDays);
  const perMovie = pricePerMovie(days, priceByDays);
  return buildBreakdown(perMovie, moviesCount, priceByDays, discountsCfg);
}

/** Importe en la devolución real, con `actualDays` sin capear al máximo configurado. */
function quoteReturn(actualDays, moviesCount, pricingCfg, discountsCfg) {
  const priceByDays = pricingCfg.price_by_days;
  if (!Number.isInteger(actualDays) || actualDays < 1) {
    const e = new Error('Los días reales de préstamo deben ser un entero >= 1.');
    e.statusCode = 422;
    throw e;
  }
  const maxDays = maxDaysFromTable(priceByDays);
  const overdue = actualDays > maxDays;
  const rate = maxDayRate(priceByDays);
  const perMovie = overdue ? rate * actualDays : pricePerMovie(actualDays, priceByDays);
  const breakdown = buildBreakdown(perMovie, moviesCount, priceByDays, discountsCfg);
  return { ...breakdown, overdue, max_days: maxDays, max_day_rate: rate };
}

/** Días entre dos fechas ISO, redondeando hacia arriba (cualquier fracción
 *  cuenta como día completo). Mínimo 1. Usado para el atraso real. */
function daysBetween(fromISO, toISO) {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return Math.max(1, d);
}

/** Día de calendario (UTC) de una fecha ISO, como entero — para comparar
 *  fechas ignorando la hora del día. */
function calendarDayIndex(iso) {
  const d = new Date(iso);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / (24 * 60 * 60 * 1000));
}

/**
 * Días entre la fecha del préstamo y una fecha de devolución PACTADA,
 * contados por calendario (no por milisegundos), para que "lunes ->
 * jueves" sea siempre 3 días sin importar la hora exacta del registro.
 * Mínimo 1: devolver el mismo día se factura como 1 día.
 */
function calendarDaysBetween(fromISO, toISO) {
  return Math.max(1, calendarDayIndex(toISO) - calendarDayIndex(fromISO));
}

module.exports = {
  DEFAULT_PRICE_BY_DAYS,
  DEFAULT_DISCOUNT_TIERS,
  maxDaysFromTable,
  maxDayRate,
  assertDaysAllowed,
  discountPercentFor,
  quote,
  quoteReturn,
  daysBetween,
  calendarDayIndex,
  calendarDaysBetween,
  round2,
};
