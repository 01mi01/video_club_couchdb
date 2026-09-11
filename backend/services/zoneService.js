/**
 * Servicio de ZONAS.
 *
 * Entidad normalizada propia, mismo patrón que género/categoría de Oscar
 * (ver `genreService.js` y `repositories/zoneRepository.js` para la
 * decisión completa). Campos mínimos: `name` y `geo` (lat/lng
 * preconfigurados). El cliente referencia una zona por ID (`address.zone_id`,
 * ver `clientService.js`) en vez de que el empleado tenga que teclear
 * coordenadas exactas a mano.
 */

const zoneRepo = require('../repositories/zoneRepository');
const { badRequest, conflict } = require('../utils/errors');

function validate(body) {
  const name = (body.name || '').trim();
  if (!name) throw badRequest('La zona requiere `name`.');

  const geo = body.geo || {};
  const lat = Number(geo.lat);
  const lng = Number(geo.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw badRequest('`geo.lat` es obligatorio y debe estar entre -90 y 90.');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw badRequest('`geo.lng` es obligatorio y debe estar entre -180 y 180.');
  }

  return { name, geo: { lat, lng } };
}

async function create(body) {
  const data = validate(body);
  // Evita zonas duplicadas por nombre (case-insensitive) — mismo criterio
  // que género.
  const existing = await zoneRepo.list();
  if (existing.some((z) => z.name.toLowerCase() === data.name.toLowerCase())) {
    throw conflict(`Ya existe una zona llamada "${data.name}".`);
  }
  return zoneRepo.create({ ...data, active: true });
}

async function list(opts) {
  return zoneRepo.list(opts);
}

async function getById(id) {
  return zoneRepo.getById(id);
}

async function update(id, body) {
  const data = validate(body);
  return zoneRepo.update(id, (doc) => {
    doc.name = data.name;
    doc.geo = data.geo;
    return doc;
  });
}

/** DESACTIVAR / REACTIVAR — mismo patrón no-destructivo que género (ver
 *  `genreService.deactivate`): sin DELETE real. Efecto aplicado en
 *  `clientService.normalize`: una zona inactiva no se puede asignar a
 *  clientes nuevos ni agregar en una edición, pero los clientes que ya la
 *  referencian la siguen mostrando sin problema. */
async function deactivate(id) {
  await zoneRepo.getById(id);
  return zoneRepo.update(id, (doc) => {
    doc.active = false;
    return doc;
  });
}

async function activate(id) {
  await zoneRepo.getById(id);
  return zoneRepo.update(id, (doc) => {
    doc.active = true;
    return doc;
  });
}

module.exports = { create, list, getById, update, deactivate, activate };
