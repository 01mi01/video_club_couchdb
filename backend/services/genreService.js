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
 * Desactivar/reactivar reemplaza el borrado permanente (el enunciado nunca
 * pide "eliminar", solo bajas/bloqueos con fecha y razón). El efecto real
 * (un género inactivo no se puede asignar a películas nuevas) se aplica en
 * `videoService.normalizeVideoInput`, no aquí.
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
