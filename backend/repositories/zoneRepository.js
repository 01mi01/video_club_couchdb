/**
 * Repositorio de ZONAS (geolocalización preconfigurada).
 *
 * DECISIÓN DE MODELADO (no pedida literalmente por el enunciado, pero
 * resuelve un problema real de captura de datos: el enunciado pide
 * "geolocalización de la dirección" del cliente, y pedirle al empleado que
 * teclee lat/lng exactos a mano es poco realista y propenso a error). Se
 * normaliza igual que género / categoría de Oscar: documento propio con
 * coordenadas preconfiguradas, referenciado por ID desde el cliente
 * (`address.zone_id`) — el empleado elige una zona de una lista en vez de
 * escribir coordenadas.
 *
 * Documento:
 *   { _id: "zone:<uuid>", type: "zone", name,
 *     geo: { lat: number, lng: number },  // coordenadas preconfiguradas de la zona
 *     active, created_at, updated_at }
 *
 * `active` (default true): mismo patrón no-destructivo que género/categoría
 * de Oscar — sin DELETE real, se desactiva/reactiva (ver zoneService.js).
 */

const repo = require('./couchRepository');
const TYPE = 'zone';

module.exports = {
  TYPE,
  create: (data) => repo.insert(TYPE, data),
  getById: (id) => repo.getById(id, { label: 'Zona' }),
  tryGetById: (id) => repo.tryGetById(id),
  list: (opts) => repo.listByType(TYPE, opts),
  update: (id, mutator) => repo.updateWithRetry(id, mutator, { label: 'Zona' }),
};
