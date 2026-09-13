/** Manejo de conflictos `_rev` (HTTP 409): concurrencia optimista de CouchDB. */

/** Distingue un conflicto real de `_rev` de un `AppError` de negocio que también usa 409. */
function isConflict(err) {
  if (!err) return false;
  if (err.name === 'AppError') return false;
  return err.error === 'conflict' || err.statusCode === 409 || err.status === 409;
}

/**
 * Ejecuta `operation` (el ciclo leer-modificar-escribir completo — debe
 * releer el documento en cada intento, o repetiría el mismo 409) y la
 * reintenta si CouchDB devuelve 409.
 */
async function withConflictRetry(operation, opts = {}) {
  const retries = opts.retries ?? 5;
  const label = opts.label || 'operación';

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation(attempt);
    } catch (err) {
      if (!isConflict(err)) throw err; // Cualquier otro error se propaga tal cual.
      lastError = err;
      // Backoff mínimo y creciente para no golpear en caliente.
      await sleep(20 * (attempt + 1));
    }
  }

  const wrapped = new Error(
    `Conflicto de versión (_rev) persistente en ${label} tras ${retries} reintentos. ` +
      `Otro proceso está modificando los mismos documentos simultáneamente.`
  );
  wrapped.statusCode = 409;
  wrapped.cause = lastError;
  throw wrapped;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { withConflictRetry, isConflict };
