/**
 * Repositorio de CONFIGURACIÓN (precios por día y descuentos por cantidad).
 *
 * Son documentos únicos con `_id` fijo y legible:
 *   - "config:pricing"    -> costos por día de préstamo + máximo de días
 *   - "config:discounts"  -> tramos de descuento por cantidad de películas
 *
 * Se usa `_id` fijo (no uuid) para que "modificar la configuración" sea
 * siempre un update sobre el mismo documento y no haya forma de tener
 * dos configuraciones activas.
 *
 * NOTA sobre "datos semilla": el enunciado YA especifica los valores por
 * defecto (1 día = 2 Bs, ..., 3-5 pelis = 5%, +5 = 10%). Esos valores
 * viven como constantes en `services/pricing.js`, NO se insertan en la
 * base. Mientras el propietario no haga el PUT, la app calcula con esos
 * defaults y `GET` los devuelve con `persisted: false`.
 */

const repo = require('./couchRepository');

const PRICING_ID = 'config:pricing';
const DISCOUNTS_ID = 'config:discounts';

module.exports = {
  PRICING_ID,
  DISCOUNTS_ID,
  getPricing: () => repo.tryGetById(PRICING_ID),
  getDiscounts: () => repo.tryGetById(DISCOUNTS_ID),

  /**
   * Upsert de un documento de configuración con `_id` fijo.
   * Reintenta ante 409 (dos PUT concurrentes sobre el mismo doc).
   */
  async savePricing(data) {
    return upsertFixed(PRICING_ID, 'config', data);
  },
  async saveDiscounts(data) {
    return upsertFixed(DISCOUNTS_ID, 'config', data);
  },
};

async function upsertFixed(id, type, data) {
  const { withConflictRetry } = require('../utils/conflictRetry');
  return withConflictRetry(
    async () => {
      const current = await repo.tryGetById(id);
      const now = new Date().toISOString();
      const doc = {
        _id: id,
        type,
        ...(current || { created_at: now }),
        ...data,
        updated_at: now,
      };
      if (current) doc._rev = current._rev;
      const res = await repo.db.insert(doc);
      return { ...doc, _rev: res.rev };
    },
    { label: `configuración ${id}` }
  );
}
