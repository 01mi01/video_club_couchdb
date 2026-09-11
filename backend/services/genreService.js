/**
 * Servicio de GÉNEROS.
 *
 * El género es entidad normalizada propia (restricción del enunciado).
 * Campos mínimos exigidos: `name` y `description`.
 */

const genreRepo = require('../repositories/genreRepository');
const { badRequest, conflict } = require('../utils/errors');

function validate(body) {
  const name = (body.name || '').trim();
  const description = (body.description || '').trim();
  if (!name) throw badRequest('El género requiere `name`.');
  if (!description) throw badRequest('El género requiere `description`.');
  return { name, description };
}

async function create(body) {
  const data = validate(body);
  // Evita géneros duplicados por nombre (case-insensitive).
  const existing = await genreRepo.list();
  if (existing.some((g) => g.name.toLowerCase() === data.name.toLowerCase())) {
    throw conflict(`Ya existe un género llamado "${data.name}".`);
  }
  // `active: true` por defecto. Ver `deactivate`/`activate` más abajo: es
  // el reemplazo no-destructivo del viejo DELETE de género.
  return genreRepo.create({ ...data, active: true });
}

async function list(opts) {
  return genreRepo.list(opts);
}

async function getById(id) {
  return genreRepo.getById(id);
}

async function update(id, body) {
  const data = validate(body);
  return genreRepo.update(id, (doc) => {
    doc.name = data.name;
    doc.description = data.description;
    return doc;
  });
}

/**
 * DESACTIVAR / REACTIVAR un género — reemplaza el borrado permanente.
 *
 * DECISIÓN (no pedida por el enunciado, corregida a partir de la revisión):
 * el profesor NUNCA pide "eliminar" ninguna entidad del sistema; su patrón
 * es siempre no-destructivo (bajas de copia con fecha/razón, bloqueo de
 * cliente con fecha/razón). El género es una entidad que agregamos
 * nosotros (restricción de modelado, no requerimiento del profesor), así
 * que se alinea con ese mismo patrón: en vez de DELETE se marca
 * `active: false`.
 *
 * Efecto de `active: false` (aplicado en `videoService.normalizeVideoInput`,
 * no aquí): el género deja de poder asignarse a películas NUEVAS o
 * agregarse a una edición, pero NO se toca ninguna película que ya lo
 * referencie — sigue existiendo el documento y se sigue mostrando sin
 * problema. Por eso, a diferencia del viejo `remove()`, aquí NO hace falta
 * ninguna comprobación de integridad referencial contra `videoRepo`: no
 * hay borrado real, no hay nada que proteger.
 */
async function deactivate(id) {
  await genreRepo.getById(id); // 404 si no existe
  return genreRepo.update(id, (doc) => {
    doc.active = false;
    return doc;
  });
}

async function activate(id) {
  await genreRepo.getById(id); // 404 si no existe
  return genreRepo.update(id, (doc) => {
    doc.active = true;
    return doc;
  });
}

module.exports = { create, list, getById, update, deactivate, activate };
