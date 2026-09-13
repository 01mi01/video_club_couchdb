/**
 * Crea los índices Mango, uno por cada búsqueda que exige el enunciado
 * (nombre, género, actor, nominación al Oscar) y ninguno más.
 *
 *     node scripts/create-indexes.js
 */

require('dotenv').config();
const { db } = require('../config/db');

const INDEXES = [
  {
    ddoc: 'idx-search-titles',
    name: 'idx-search-titles',
    // Se indexa `search_titles` (plegado, sin acentos), no `all_titles`.
    fields: ['search_titles'],
    why: 'Buscar película por nombre (insensible a acentos/mayúsculas).',
  },
  {
    ddoc: 'idx-genres',
    name: 'idx-genres',
    fields: ['genre_ids'],
    why: 'Buscar película por género.',
  },
  {
    ddoc: 'idx-actors',
    name: 'idx-actors',
    fields: ['main_actors'],
    why: 'Buscar película por actor.',
  },
  {
    ddoc: 'idx-oscar-nominations',
    name: 'idx-oscar-nominations',
    // `oscar_nominations`: IDs de `oscar_category` (antes texto libre en
    // inglés). El texto buscado se resuelve primero a IDs en memoria
    // (oscarCategoryService.findIdsByText) y luego se consulta este
    // índice con esos IDs.
    fields: ['oscar_nominations'],
    why: 'Buscar película por nominación al Oscar.',
  },
];

async function main() {
  for (const ix of INDEXES) {
    const definition = {
      index: { fields: ix.fields },
      ddoc: ix.ddoc,
      name: ix.name,
      type: 'json',
    };
    // Idempotente: si ya existe con la misma definición, responde "exists".
    const res = await db.createIndex(definition);
    console.log(
      `[${res.result}] ${ix.name}  (campos: ${ix.fields.join(', ')})  <- ${ix.why}`
    );
  }
  console.log('\nÍndices Mango listos (se construyen de forma asíncrona).');
}

main().catch((err) => {
  console.error('Fallo al crear índices:', err.message);
  process.exit(1);
});
