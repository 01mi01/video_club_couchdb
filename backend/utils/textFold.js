/**
 * Plegado de texto para búsqueda INSENSIBLE A ACENTOS Y MAYÚSCULAS.
 *
 * Compartido por dos entidades normalizadas que necesitan exactamente el
 * mismo truco (Mango `$regex`/`$eq` no hacen folding de diacríticos):
 *   - `videoService.js`      -> `search_titles` (búsqueda de películas por nombre).
 *   - `oscarCategoryService.js` -> `search_names` (búsqueda por categoría de
 *     Oscar en inglés O español: "Best Picture" / "Mejor Película").
 *
 * Unicode NFD separa cada letra acentuada en letra base + marca
 * combinante (`á` -> `a´`), luego se eliminan esas marcas (`\p{M}`):
 * á->a, ñ->n, ü->u, é->e ... y se pasa a minúsculas.
 */
function foldForSearch(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { foldForSearch };
