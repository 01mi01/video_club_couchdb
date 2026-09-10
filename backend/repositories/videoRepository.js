/**
 * Repositorio de VIDEOS (películas).
 *
 * MODELO (decidido aquí, según lo permite el enunciado):
 *
 *   {
 *     _id: "video:<uuid>", type: "video",
 *
 *     // --- Títulos -------------------------------------------------------
 *     // El enunciado pide "título con varios alternativos, incluyendo en
 *     // idioma original y en inglés". Se guardan estructurados...
 *     display_title:      "string",      // el título principal para mostrar
 *     original_title:     "string",
 *     original_language:  "string",      // idioma original
 *     english_title:      "string",
 *     alternative_titles: ["string", ...],
 *     // ...y ADEMÁS se mantiene un arreglo plano denormalizado con TODOS
 *     // los títulos. Ese arreglo es lo que se indexa con Mango para la
 *     // "búsqueda por nombre": un solo índice cubre cualquier variante
 *     // del título (original, inglés, alternativo) sin tener que hacer
 *     // OR entre varios campos. Se recalcula en cada escritura.
 *     all_titles: ["string", ...],
 *
 *     duration_minutes: number,          // duración en minutos
 *     genre_ids: ["genre:<uuid>", ...],  // REFERENCIA a géneros normalizados
 *     release_year: number,
 *
 *     // --- Oscar --------------------------------------------------------
 *     // Arreglos planos de strings (categorías) para poder indexarlos y
 *     // buscar "películas nominadas al Oscar" / "por categoría".
 *     oscar_nominations: ["Best Picture", ...],
 *     oscar_wins:        ["Best Director", ...],
 *
 *     main_actors: ["string", ...],      // arreglo plano -> indexable
 *
 *     unit_cost: number,                 // costo unitario de cada DVD
 *     units_acquired: number,            // nº de unidades adquiridas (total histórico)
 *
 *     // --- Copias EMBEBIDAS -------------------------------------------
 *     // Se embeben porque una copia no tiene vida propia fuera de su
 *     // película y la relación es 1-a-muchos (no muchos-a-muchos). Evita
 *     // un JOIN que CouchDB no hace bien.
 *     copies: [
 *       { copy_id: "c1", acquisition_date: "ISO",
 *         status: "available" | "loaned" | "retired",
 *         retirement: null | { date: "ISO", reason: "no devuelto" | "robo" | ... } }
 *     ],
 *
 *     created_at, updated_at
 *   }
 */

const repo = require('./couchRepository');
const TYPE = 'video';

module.exports = {
  TYPE,
  create: (data) => repo.insert(TYPE, data),
  getById: (id) => repo.getById(id, { label: 'Video' }),
  tryGetById: (id) => repo.tryGetById(id),
  list: (opts) => repo.listByType(TYPE, opts),
  update: (id, mutator) => repo.updateWithRetry(id, mutator, { label: 'Video' }),
  remove: (id) => repo.remove(id, { label: 'Video' }),

  // Búsqueda Mango: el `selector` ya viene armado desde el servicio para
  // dejar claro allí qué índice se está aprovechando.
  find: (selector, options) => repo.find(selector, options),
};
