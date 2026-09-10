/**
 * Errores de dominio de la aplicación.
 *
 * Se usa una sola clase `AppError` con `statusCode` para que la capa de
 * servicio (donde viven las reglas de negocio) pueda lanzar errores
 * semánticos ("cliente bloqueado", "sin copias disponibles", "más días
 * que el máximo configurado") sin conocer Express. El middleware
 * `errorHandler` los traduce a respuestas HTTP.
 */

class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
  }
}

// Helpers de conveniencia para los casos más comunes.
const badRequest = (msg, details) => new AppError(400, msg, details);
const unauthorized = (msg = 'No autorizado') => new AppError(401, msg);
const notFound = (msg = 'Recurso no encontrado') => new AppError(404, msg);
const conflict = (msg, details) => new AppError(409, msg, details);
const unprocessable = (msg, details) => new AppError(422, msg, details);

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  notFound,
  conflict,
  unprocessable,
};
