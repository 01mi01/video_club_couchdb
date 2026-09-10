/**
 * Middleware de autenticación.
 *
 * Protege TODAS las rutas de negocio. Sólo quedan fuera `/api/health`
 * (diagnóstico) y `/api/login` (emisión del token). Se monta en
 * `server.js` justo antes de las rutas protegidas.
 */

const jwt = require('jsonwebtoken');
const { unauthorized } = require('../utils/errors');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Falta el header Authorization: Bearer <token>.'));
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    next(unauthorized('Token inválido o expirado.'));
  }
};
