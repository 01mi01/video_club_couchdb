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
 *     // ...y ADEMÁS dos arreglos planos denormalizados con TODOS los
 *     // títulos, recalculados en cada escritura:
 *     //   all_titles    -> para MOSTRAR (tal cual, con acentos/mayúsculas).
 *     //   search_titles -> para BUSCAR: cada título "plegado" (Unicode NFD,
 *     //                    sin marcas diacríticas, en minúsculas). Es este
 *     //                    el que indexa Mango (idx-search-titles), porque
 *     //                    `$regex` no compara insensible a acentos y el
 *     //                    enunciado exige buscar por nombre en español.
 *     //                    Ver `foldForSearch` en services/videoService.js.
 *     all_titles:    ["string", ...],
 *     search_titles: ["string", ...],
 *
 *     duration_minutes: number,          // duración en minutos
 *     genre_ids: ["genre:<uuid>", ...],  // REFERENCIA a géneros normalizados
 *     release_year: number,
 *
 *     // --- Oscar --------------------------------------------------------
 *     // REFERENCIA a categorías normalizadas (oscar_category), NO strings
 *     // libres. Antes eran strings en inglés ("Best Picture"), lo que
 *     // rompía la búsqueda en español ("Mejor Película"). Mismo patrón
 *     // que género: documento propio con `name_en`/`name_es`, referenciado
 *     // por ID (ver repositories/oscarCategoryRepository.js).
 *     oscar_nominations: ["oscar_category:<uuid>", ...],
 *     oscar_wins:        ["oscar_category:<uuid>", ...],
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
