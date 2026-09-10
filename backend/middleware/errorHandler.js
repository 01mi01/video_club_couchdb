/**
 * Middleware de manejo de errores central (4 argumentos => Express lo
 * reconoce como error handler). Traduce:
 *   - AppError / errores con `statusCode`  -> ese código
 *   - errores de `nano` (CouchDB)          -> se respeta su statusCode
 *   - cualquier otra cosa                  -> 500
 *
 * El 409 se deja pasar tal cual: si un conflicto _rev sobrevivió a los
 * reintentos, el cliente debe saberlo (y así se ve en la demo).
 */

module.exports = function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;

  if (status >= 500) {
    console.error('[ERROR]', req.method, req.originalUrl, '\n', err);
  }

  const body = { error: err.message || 'Error interno' };
  if (err.details !== undefined) body.details = err.details;
  if (status === 409) {
    body.hint =
      'Conflicto de concurrencia (MVCC / _rev). Reintenta la operación.';
  }
  res.status(status).json(body);
};
