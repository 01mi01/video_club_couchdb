/**
 * Servicio de CATEGORÍAS DE OSCAR.
 *
 * Entidad normalizada propia, mismo patrón que género (ver
 * `genreService.js` y `repositories/oscarCategoryRepository.js` para la
 * decisión completa). Campos mínimos: `name_en` y `name_es`.
 */

const oscarRepo = require('../repositories/oscarCategoryRepository');
const { foldForSearch } = require('../utils/textFold');
const { badRequest, conflict } = require('../utils/errors');

function validate(body) {
  const name_en = (body.name_en || '').trim();
  const name_es = (body.name_es || '').trim();
  if (!name_en) throw badRequest('La categoría de Oscar requiere `name_en`.');
  if (!name_es) throw badRequest('La categoría de Oscar requiere `name_es`.');
  return { name_en, name_es };
}

/** Igual que `buildSearchTitles` de video: cada nombre plegado, sin
 *  duplicados. Permite que la búsqueda funcione por `name_en` O `name_es`
 *  indistintamente, insensible a acentos/mayúsculas. */
function buildSearchNames({ name_en, name_es }) {
  return [...new Set([name_en, name_es].map(foldForSearch).filter(Boolean))];
}

async function create(body) {
  const data = validate(body);
  // Evita categorías duplicadas por `name_en` (case-insensitive) — es el
  // identificador estable de la categoría real de la Academia.
  const existing = await oscarRepo.list();
  if (existing.some((c) => c.name_en.toLowerCase() === data.name_en.toLowerCase())) {
    throw conflict(`Ya existe una categoría de Oscar con name_en "${data.name_en}".`);
  }
  return oscarRepo.create({ ...data, search_names: buildSearchNames(data), active: true });
}

async function list(opts) {
  return oscarRepo.list(opts);
}

async function getById(id) {
  return oscarRepo.getById(id);
}

async function update(id, body) {
  const data = validate(body);
  return oscarRepo.update(id, (doc) => {
    doc.name_en = data.name_en;
    doc.name_es = data.name_es;
    doc.search_names = buildSearchNames(data);
    return doc;
  });
}

/** DESACTIVAR / REACTIVAR — mismo patrón no-destructivo que género (ver
 *  `genreService.deactivate`): sin DELETE real, el enunciado nunca pide
 *  "eliminar" nada. Efecto aplicado en `videoService.resolveCategoryIds`:
 *  una categoría inactiva no se puede asignar a películas nuevas, pero
 *  las que ya la referencian la siguen mostrando sin problema. */
async function deactivate(id) {
  await oscarRepo.getById(id);
  return oscarRepo.update(id, (doc) => {
    doc.active = false;
    return doc;
  });
}

async function activate(id) {
  await oscarRepo.getById(id);
  return oscarRepo.update(id, (doc) => {
    doc.active = true;
    return doc;
  });
}

/**
 * BÚSQUEDA POR NOMINACIÓN AL OSCAR EN CUALQUIER IDIOMA (problema complejo
 * resuelto — ver `videoService.search`).
 *
 * Resuelve un texto (inglés o español, con o sin acentos/mayúsculas) al o
 * los IDs de categoría cuyo `search_names` contiene ese texto plegado
 * EXACTO. Filtrado EN MEMORIA sobre la colección completa de categorías:
 * es un catálogo chico (~24 documentos reales), así que un índice Mango
 * dedicado aquí sería decorativo — el índice que sí importa
 * (`idx-oscar-nominations`) protege la colección grande (videos), donde
 * `videoService.search` usa los IDs que esta función devuelve.
 *
 * IMPORTANTE: coincidencia EXACTA, no subcadena. A diferencia de la
 * búsqueda de títulos de película (donde SÍ interesa "nomadas" dentro de
 * "Los Nómadas"), aquí el texto viene de un selector con categorías
 * FIJAS (frontend) — un `$regex`/`includes` de subcadena haría que
 * "mejor pelicula" también matcheara "Mejor Película DE ANIMACIÓN" o
 * "... INTERNACIONAL" (ambas contienen esa subcadena), devolviendo
 * películas de categorías que el usuario nunca pidió. Bug real detectado
 * y corregido durante la verificación end-to-end de esta migración.
 */
async function findIdsByText(text) {
  const needle = foldForSearch(text);
  if (!needle) return [];
  const all = await oscarRepo.list();
  return all.filter((c) => (c.search_names || []).includes(needle)).map((c) => c._id);
}

module.exports = { create, list, getById, update, deactivate, activate, findIdsByText, buildSearchNames };
