/**
 * Repositorio de CATEGORÍAS DE OSCAR.
 *
 * DECISIÓN DE MODELADO (resuelve un problema real, no es requerimiento
 * literal del profesor pero sigue su mismo espíritu de normalización que
 * ya aplica a género): antes `oscar_nominations[]`/`oscar_wins[]` en el
 * video guardaban strings libres en inglés ("Best Picture"), así que
 * buscar "Mejor Película" (como buscaría el profesor en español) nunca
 * encontraba nada. Se normaliza exactamente igual que género: documento
 * propio, referenciado por ID desde los videos (relación
 * muchos-a-muchos: una categoría aplica a muchas películas, una película
 * tiene muchas categorías nominadas/ganadas).
 *
 * Documento:
 *   { _id: "oscar_category:<uuid>", type: "oscar_category",
 *     name_en, name_es,
 *     search_names: [fold(name_en), fold(name_es)],  // ver utils/textFold.js
 *     active, created_at, updated_at }
 *
 * `search_names` es EXACTAMENTE el mismo mecanismo que `search_titles` de
 * video (`videoService.buildSearchTitles`): cada nombre plegado (Unicode
 * NFD, sin marcas diacríticas, minúsculas) para que la búsqueda sea
 * insensible a acentos/mayúsculas Y funcione en los dos idiomas a la vez.
 *
 * `active` (default true): mismo patrón no-destructivo que género — sin
 * DELETE real, se desactiva/reactiva (ver oscarCategoryService.js).
 */
const repo = require('./couchRepository');
const TYPE = 'oscar_category';

module.exports = {
  TYPE,
  create: (data) => repo.insert(TYPE, data),
  getById: (id) => repo.getById(id, { label: 'Categoría de Oscar' }),
  tryGetById: (id) => repo.tryGetById(id),
  list: (opts) => repo.listByType(TYPE, opts),
  update: (id, mutator) => repo.updateWithRetry(id, mutator, { label: 'Categoría de Oscar' }),
};
