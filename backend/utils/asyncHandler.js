/**
 * Envuelve un handler async de Express para que cualquier promesa
 * rechazada se reenvíe a `next(err)` y termine en el `errorHandler`
 * central. Evita repetir try/catch en cada controlador.
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
