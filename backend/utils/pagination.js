/**
 * Normaliza `limit`/`skip` del query string: ausente, vacío o no numérico
 * nunca debe llegar a CouchDB como valor inválido (ver `listByType`,
 * mismo motivo) — siempre cae a un default sensato en vez de fallar.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000; // app de un solo propietario; el frontend pide límites altos para no truncar tablas.

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
