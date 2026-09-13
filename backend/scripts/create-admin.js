/**
 * Crea el documento del único usuario admin, a partir de
 * ADMIN_USERNAME/ADMIN_PASSWORD en `.env`. Ejecución manual, una sola vez.
 *
 *     node scripts/create-admin.js
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { db } = require('../config/db');

const BCRYPT_ROUNDS = 12;

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error(
      'ERROR: define ADMIN_USERNAME y ADMIN_PASSWORD en backend/.env antes de ejecutar este script.'
    );
    process.exit(1);
  }

  const _id = `admin:${username}`;

  // ¿Ya existe? No se pisa en silencio.
  try {
    const existing = await db.get(_id);
    console.error(
      `ERROR: el usuario admin "${username}" ya existe (rev ${existing._rev}).\n` +
        'Si quieres cambiar la contraseña, borra ese documento en Fauxton y vuelve a ejecutar el script.'
    );
    process.exit(1);
  } catch (err) {
    if (err.statusCode !== 404) throw err; // 404 = no existe -> seguimos
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const res = await db.insert({
    _id,
    type: 'admin',
    username,
    password_hash,
    created_at: new Date().toISOString(),
  });

  console.log(`OK: usuario admin creado -> ${res.id} (rev ${res.rev})`);
  console.log('Ya puedes hacer POST /api/login con esas credenciales.');
}

main().catch((err) => {
  console.error('Fallo al crear el admin:', err.message);
  process.exit(1);
});
