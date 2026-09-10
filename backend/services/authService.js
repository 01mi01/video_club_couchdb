/**
 * Servicio de AUTENTICACIÓN.
 *
 * La app tiene un único usuario: el propietario. Su documento
 * (`admin:<username>`) lo crea el script manual `scripts/create-admin.js`
 * a partir de `ADMIN_USERNAME` / `ADMIN_PASSWORD` del `.env`. Aquí NO se
 * crea ni se hardcodea ningún usuario.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const repo = require('../repositories/couchRepository');
const { unauthorized } = require('../utils/errors');

const JWT_EXPIRES_IN = '12h';

async function login(username, password) {
  if (!username || !password) {
    throw unauthorized('Usuario y contraseña son obligatorios.');
  }
  if (!process.env.JWT_SECRET) {
    // Falla temprano y claro si el .env está incompleto.
    const e = new Error('JWT_SECRET no está configurado en el entorno.');
    e.statusCode = 500;
    throw e;
  }

  // Mismo mensaje para "no existe" y "clave mala": no se filtra si el
  // usuario existe.
  const adminDoc = await repo.tryGetById(`admin:${username}`);
  if (!adminDoc) throw unauthorized('Credenciales inválidas.');

  const ok = await bcrypt.compare(password, adminDoc.password_hash);
  if (!ok) throw unauthorized('Credenciales inválidas.');

  const token = jwt.sign(
    { sub: username, role: 'owner' },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  return { token, token_type: 'Bearer', expires_in: JWT_EXPIRES_IN, username };
}

module.exports = { login };
