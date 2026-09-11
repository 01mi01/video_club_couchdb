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
 * Cálculo del importe al REGISTRAR/COTIZAR un préstamo.
 *
 * Aquí SÍ aplica el tope del enunciado ("no se permiten préstamos mayores
 * a los días configurados"): es una regla de ACEPTACIÓN del plazo pedido,
 * ver `assertDaysAllowed`. Este tope es EXCLUSIVO de este momento — NO se
 * reutiliza para capear el monto que se termina cobrando en una
 * devolución real tardía (ver `quoteReturn` más abajo).
 *
 * @param {number} days           Días de préstamo PACTADOS.
 * @param {number} moviesCount    Cantidad de películas.
 * @param {object} pricingCfg     { price_by_days, ... }
 * @param {object} discountsCfg   { tiers }
 * @returns desglose para guardar en `loan.pricing` y para la factura.
 */
function quote(days, moviesCount, pricingCfg, discountsCfg) {
  const priceByDays = pricingCfg.price_by_days;
  assertDaysAllowed(days, priceByDays);
  const perMovie = pricePerMovie(days, priceByDays);
  return buildBreakdown(perMovie, moviesCount, priceByDays, discountsCfg);
}

/**
 * Cálculo del importe en la DEVOLUCIÓN real, con `actualDays` SIN capear.
 *
 * El tope de `max_days` ("no se permiten préstamos mayores a los días
 * configurados") es una regla de admisión al CREAR/COTIZAR el préstamo
 * (ver `quote` arriba) — NO es un techo silencioso al monto que se cobra
 * cuando la devolución real termina excediendo ese límite. Dos casos:
 *
 *   - `actualDays <= max_days`  -> tarifa PLANA normal de la tabla para
 *     ese plazo, igual que en `quote` (`price_by_days[actualDays]`).
 *   - `actualDays >  max_days`  -> ya no hay una tarifa plana definida
 *     para un plazo tan largo (la tabla no llega tan lejos), así que se
 *     cobra la tarifa del día MÁS ALTO configurado (`maxDayRate`) POR
 *     CADA día real, incluidos los que exceden el máximo. Ej.: si
 *     max_days=5 (5 días = 6 Bs) y la devolución real fue a los 7 días,
 *     se cobra 7 × 6 Bs, no 5 × 6 Bs. Es dinámico: si se reconfigura la
 *     tabla de precios, la tarifa excedente se recalcula sola.
 *
 * @param {number} actualDays     Días REALES transcurridos (sin capear).
 */
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

/**
 * Días transcurridos entre dos fechas ISO, redondeando hacia arriba
 * (cualquier fracción de día cuenta como día completo). Mínimo 1.
 *
 * Se usa para el CÁLCULO DE ATRASO en la devolución real: si el cliente
 * tuvo la copia 12 días y 3 horas, cuenta como 13.
 */
function daysBetween(fromISO, toISO) {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return Math.max(1, d);
}

/**
 * Número de día de calendario (en UTC) de una fecha ISO, como entero.
 * Sirve para comparar y restar fechas ignorando la hora del día.
 * (Limitación honesta: se usa UTC; para una app de un solo propietario en
 * una zona horaria fija es suficiente.)
 */
function calendarDayIndex(iso) {
  const d = new Date(iso);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / (24 * 60 * 60 * 1000));
}

/**
 * Días de préstamo entre la fecha del préstamo y una FECHA DE DEVOLUCIÓN
 * PACTADA, contados como días de CALENDARIO (se ignora la hora del día).
 *
 * Motivo: al registrar el préstamo el propietario elige una fecha ("el
 * cliente devuelve el jueves"). Si se contara por milisegundos con `ceil`,
 * la misma fecha podría facturarse como 3 o 4 días según la hora exacta en
 * que se registra el préstamo — poco predecible en la pantalla "por
 * fecha". Contando por calendario: lunes -> jueves = 3 días, siempre.
 *
 * MÍNIMO 1: devolver EL MISMO DÍA del préstamo es válido y se factura como
 * 1 día (el mínimo de la tabla de precios).
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
