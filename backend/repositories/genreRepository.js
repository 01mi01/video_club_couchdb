/**
 * Repositorio de GÉNEROS.
 *
 * RESTRICCIÓN OBLIGATORIA del enunciado: el género es un documento
 * normalizado propio (relación muchos-a-muchos con videos, porque una
 * película puede tener más de un género). Los videos guardan
 * `genre_ids: [...]`, nunca el nombre embebido.
 *
 * Documento:
 *   { _id: "genre:<uuid>", type: "genre", name, description, active,
 *     created_at, updated_at }
 *
 * `active` (boolean, default true): reemplaza el borrado permanente. El
 * enunciado nunca pide "eliminar" ninguna entidad — su patrón es siempre
 * no-destructivo (bajas de copia, bloqueo de cliente) — así que género
 * sigue el mismo patrón: se desactiva, no se borra. Sin `remove()` a
 * propósito: no existe ningún camino de borrado real para género (ver
 * `genreService.deactivate`/`activate`).
 */

const repo = require('./couchRepository');
const TYPE = 'genre';

module.exports = {
  create: (data) => repo.insert(TYPE, data),
  getById: (id) => repo.getById(id, { label: 'Género' }),
  tryGetById: (id) => repo.tryGetById(id),
  list: (opts) => repo.listByType(TYPE, opts),
  update: (id, mutator) => repo.updateWithRetry(id, mutator, { label: 'Género' }),
};
