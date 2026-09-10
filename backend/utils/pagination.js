/**
 * ============================================================================
 * PAGINACIÓN — normalización de `limit` / `skip` del query string
 * ============================================================================
 *
 * REGLA CENTRAL: un parámetro numérico opcional AUSENTE, vacío
 * (`?limit=`) o no numérico NUNCA debe provocar un error. Se cae a un
 * valor por defecto sensato. Solo se rechaza implícitamente (usando el
 * default) cuando el valor recibido no tiene sentido.
 *
 * Motivo concreto del bug que esto corrige:
 * `nano` v11 arma el querystring con `new URLSearchParams(qs)`, que
 * convierte cada valor con `String(valor)`. Si una capa superior pasaba
 * `limit: undefined`, se enviaba literalmente `?limit=undefined` y
 * CouchDB respondía `400 - Invalid value for integer: undefined`.
 * Centralizando el parseo aquí, las capas superiores solo manejan
 * números ya validados o el default.
 *
 *   limit -> por defecto DEFAULT_LIMIT; nunca por encima de MAX_LIMIT.
 *   skip  -> por defecto 0.
 *
 * DEFAULT_LIMIT = 50: es una app de un solo propietario con volúmenes
 * modestos; 50 documentos por página es suficiente para el uso normal y
 * evita traer toda la base sin querer. Se puede subir con `?limit=` hasta
 * MAX_LIMIT.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function isBlank(raw) {
  return raw === undefined || raw === null || String(raw).trim() === '';
}

/** Devuelve un `limit` entero en el rango [1, MAX_LIMIT], o el default. */
function parseLimit(raw) {
  if (isBlank(raw)) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

/** Devuelve un `skip` entero >= 0, o 0. */
function parseSkip(raw) {
  if (isBlank(raw)) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Normaliza `req.query` a `{ limit, skip }` siempre con números válidos.
 * Pensado para pasarse tal cual a `listByType`.
 */
function parsePagination(query = {}) {
  return { limit: parseLimit(query.limit), skip: parseSkip(query.skip) };
}

module.exports = { parsePagination, parseLimit, parseSkip, DEFAULT_LIMIT, MAX_LIMIT };
