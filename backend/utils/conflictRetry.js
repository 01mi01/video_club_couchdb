/**
 * ============================================================================
 * MANEJO DE CONFLICTOS _rev (HTTP 409) EN COUCHDB  —  MVCC
 * ============================================================================
 *
 * CONCEPTO (Parte A de la evaluación: Aislamiento / Bloqueos):
 *
 * CouchDB NO usa locks. Usa MVCC (Multi-Version Concurrency Control):
 * cada documento tiene un campo `_rev`. Para actualizar un documento hay
 * que enviar el `_rev` que se leyó. Si otro proceso ya escribió una
 * versión nueva mientras tanto, el `_rev` que tenemos quedó viejo y
 * CouchDB responde **409 Conflict** en lugar de bloquear o sobrescribir.
 *
 * Es control de concurrencia OPTIMISTA: no se previene el conflicto, se
 * detecta y se resuelve. La estrategia estándar es:
 *
 *     leer -> modificar -> escribir -> si 409 -> volver a leer y reintentar
 *
 * Esta función hace ese ciclo EXPLÍCITO y REUTILIZABLE. Se llama desde
 * cada operación de escritura que pueda competir con otra (dar de baja
 * una copia, bloquear un cliente, registrar un préstamo, etc.).
 *
 * Referencia para el video: mencionar este archivo como "el punto único
 * donde la app reacciona al modelo MVCC de CouchDB".
 * ============================================================================
 */

// nano lanza un error con statusCode 409 y `error === 'conflict'`.
function isConflict(err) {
  return err && (err.statusCode === 409 || err.status === 409 || err.error === 'conflict');
}

/**
 * Ejecuta `operation` y la reintenta si CouchDB devuelve 409.
 *
 * @param {() => Promise<any>} operation  Ciclo completo leer-modificar-escribir.
 *        DEBE volver a leer el documento en cada intento (por eso recibe
 *        una función y no un documento ya cargado): un `_rev` viejo
 *        reintentado produciría el mismo 409 infinitamente.
 * @param {object} [opts]
 * @param {number} [opts.retries=5]   Reintentos antes de rendirse.
 * @param {string} [opts.label]       Etiqueta para el mensaje de error final.
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
