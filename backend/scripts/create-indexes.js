/**
 * ============================================================================
 * scripts/create-indexes.js  —  EJECUCIÓN MANUAL
 * ============================================================================
 *
 * Crea los índices Mango (`_index`) que necesita la aplicación.
 *
 * Uso:
 *     node scripts/create-indexes.js
 *
 *
 * ----------------------------------------------------------------------------
 * CRITERIO: un índice por CADA búsqueda que el profesor pidió
 * explícitamente, y NINGUNO más.
 * ----------------------------------------------------------------------------
 * El enunciado exige buscar películas por: NOMBRE, GÉNERO, ACTOR y
 * NOMINACIÓN AL OSCAR. Sin índice, CouchDB resuelve esas consultas con un
 * full scan y devuelve un `warning` de consulta "unindexed": funciona con
 * pocos documentos pero no escala. Por eso estos 4 índices SÍ se
 * justifican uno por uno.
 *
 * NO se crean índices sobre campos que no sirven una búsqueda requerida
 * (p.ej. `unit_cost`, `copies.status`, `release_year`, `type`): la
 * ausencia justificada de un índice es tan importante de explicar como su
 * presencia. Los listados por tipo ("todos los videos", "todos los
 * clientes") se resuelven con rangos de `_id` sobre `_all_docs` (índice
 * primario, siempre presente) — ver `repositories/couchRepository.js`.
 *
 * ----------------------------------------------------------------------------
 * NOTA PARA LA PRESENTACIÓN (Parte A: CONSISTENCIA)
 * ----------------------------------------------------------------------------
 * Los índices Mango en CouchDB son estructuras SECUNDARIAS que se
 * construyen de forma ASÍNCRONA: después de una escritura, el índice no
 * refleja el cambio de inmediato; se actualiza en la siguiente consulta
 * que lo use (o en segundo plano). Es un ejemplo directo de CONSISTENCIA
 * EVENTUAL, no inmediata. Una búsqueda hecha milisegundos después de
 * insertar una película podría no encontrarla todavía hasta que el índice
 * "se ponga al día".
 * ============================================================================
 */

require('dotenv').config();
const { db } = require('../config/db');

/**
 * Cada entrada:
 *   ddoc  : nombre del design doc que agrupa el índice
 *   name  : nombre del índice (se referencia con `use_index` en `_find`)
 *   fields: campos indexados
 *   why   : requerimiento funcional que justifica el índice
 */
const INDEXES = [
  {
    ddoc: 'idx-titles',
    name: 'idx-titles',
    // `all_titles` es el arreglo plano con TODOS los títulos de la
    // película (principal, original, inglés, alternativos). Indexarlo
    // permite una sola consulta para "buscar por nombre" cubriendo
    // cualquier variante del título.
    fields: ['all_titles'],
    why: 'Gestión de Préstamos 1: "Buscar película por nombre".',
  },
  {
    ddoc: 'idx-genres',
    name: 'idx-genres',
    // `genre_ids` referencia los documentos de género normalizados
    // (relación muchos-a-muchos). Se busca por el ID del género.
    fields: ['genre_ids'],
    why: 'Gestión de Préstamos 1: "Buscar película por género".',
  },
  {
    ddoc: 'idx-actors',
    name: 'idx-actors',
    fields: ['main_actors'],
    why: 'Gestión de Préstamos 1: "Buscar película por actor".',
  },
  {
    ddoc: 'idx-oscar-nominations',
    name: 'idx-oscar-nominations',
    // `oscar_nominations` es un arreglo plano de categorías nominadas.
    // Sirve tanto "¿fue nominada?" como "nominada en tal categoría".
    fields: ['oscar_nominations'],
    why: 'Gestión de Préstamos 1: "Buscar película por nominación al Oscar".',
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
    // `db.createIndex` es idempotente: si el índice ya existe con la
    // misma definición, CouchDB responde "exists" y no lo duplica.
    const res = await db.createIndex(definition);
    console.log(
      `[${res.result}] ${ix.name}  (campos: ${ix.fields.join(', ')})  <- ${ix.why}`
    );
  }
  console.log('\nÍndices Mango listos.');
  console.log(
    'Recuerda: se construyen de forma asíncrona (consistencia eventual). ' +
      'La primera búsqueda tras muchas inserciones puede tardar mientras el índice se pone al día.'
  );
}

main().catch((err) => {
  console.error('Fallo al crear índices:', err.message);
  process.exit(1);
});
