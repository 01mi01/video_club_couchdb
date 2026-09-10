/**
 * Servicio de GÉNEROS.
 *
 * El género es entidad normalizada propia (restricción del enunciado).
 * Campos mínimos exigidos: `name` y `description`.
 */

const genreRepo = require('../repositories/genreRepository');
const videoRepo = require('../repositories/videoRepository');
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
  return genreRepo.create(data);
}

async function list() {
  return genreRepo.list();
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

async function remove(id) {
  await genreRepo.getById(id); // 404 si no existe
  // Integridad referencial (CouchDB no la impone): no se borra un género
  // que algún video todavía referencia en `genre_ids`.
  const videos = await videoRepo.list();
  const used = videos.filter((v) => (v.genre_ids || []).includes(id));
  if (used.length > 0) {
    throw conflict(
      `No se puede eliminar: ${used.length} video(s) referencian este género.`,
      { video_ids: used.map((v) => v._id) }
    );
  }
  return genreRepo.remove(id);
}

module.exports = { create, list, getById, update, remove };
