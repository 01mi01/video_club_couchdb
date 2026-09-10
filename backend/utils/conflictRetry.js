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

/**
 * ¿Es un conflicto MVCC REAL de CouchDB (merece reintento)?
 *
 * OJO: no basta con mirar el código 409. Los errores de DOMINIO de la app
 * (`AppError`) también usan 409 para condiciones como "cliente bloqueado"
 * o "copia no disponible" (semánticamente son "conflictos" de negocio).
 * Esas condiciones son DETERMINISTAS: reintentarlas es inútil y además
 * enmascara el mensaje real con un genérico de "conflicto de versión".
 *
 * Por eso: un `AppError` NUNCA se reintenta. Solo se reintenta el
 * conflicto de `_rev` que lanza nano/CouchDB, identificado por
 * `error === 'conflict'` (marca de nano) o por un 409 de un error que
 * NO es de dominio (p.ej. el 409 sintético que arma `loanService` cuando
 * un `_bulk_docs` falla por `_rev` viejo).
 */
function isConflict(err) {
  if (!err) return false;
  if (err.name === 'AppError') return false;
  return err.error === 'conflict' || err.statusCode === 409 || err.status === 409;
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
