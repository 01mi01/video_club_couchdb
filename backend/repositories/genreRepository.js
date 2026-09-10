/**
 * Repositorio de GÉNEROS.
 *
 * RESTRICCIÓN OBLIGATORIA del enunciado: el género es un documento
 * normalizado propio (relación muchos-a-muchos con videos, porque una
 * película puede tener más de un género). Los videos guardan
 * `genre_ids: [...]`, nunca el nombre embebido.
 *
 * Documento:
 *   { _id: "genre:<uuid>", type: "genre", name, description,
 *     created_at, updated_at }
 */

const repo = require('./couchRepository');
const TYPE = 'genre';

module.exports = {
  create: (data) => repo.insert(TYPE, data),
  getById: (id) => repo.getById(id, { label: 'Género' }),
  tryGetById: (id) => repo.tryGetById(id),
  list: (opts) => repo.listByType(TYPE, opts),
  update: (id, mutator) => repo.updateWithRetry(id, mutator, { label: 'Género' }),
  remove: (id) => repo.remove(id, { label: 'Género' }),
};
