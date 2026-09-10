/**
 * ============================================================================
 * REPOSITORIO GENÉRICO DE COUCHDB  (cliente `nano`)
 * ============================================================================
 *
 * Todas las llamadas crudas a CouchDB pasan por aquí. Las capas de
 * servicio nunca hablan con `nano` directamente: piden operaciones con
 * significado ("inserta", "trae por prefijo", "bulk").
 *
 * DECISIONES DE MODELADO QUE SE APOYAN EN ESTE ARCHIVO
 * ---------------------------------------------------------------------------
 * 1. IDs CON PREFIJO DE TIPO  (`genre:<uuid>`, `video:<uuid>`, ...).
 *    CouchDB guarda TODOS los documentos en una sola base
 *    (`video_club_db`); no hay "tablas" ni "colecciones". Para listar
 *    "todos los videos" hay dos caminos:
 *      a) `_find` con `{ selector: { type: "video" } }`  -> requiere un
 *         índice sobre `type`, y sin él CouchDB devuelve un warning de
 *         consulta no indexada (full scan).
 *      b) `_all_docs` con rango `startkey/endkey` sobre el prefijo del
 *         `_id`  -> usa el B-tree primario que SIEMPRE existe, sin crear
 *         ningún índice extra.
 *    Elegimos (b). Así los únicos índices Mango del proyecto son los que
 *    sirven una búsqueda que el profesor pidió explícitamente (nombre,
 *    género, actor, nominación al Oscar) y no hay índices "decorativos".
 *
 * 2. CAMPO `type` redundante dentro del documento: se mantiene igual,
 *    porque es barato y hace los documentos autoexplicativos al leerlos
 *    en Fauxton, pero NO se indexa.
 * ============================================================================
 */

const { randomUUID } = require('crypto');
const { db } = require('../config/db');
const { withConflictRetry } = require('../utils/conflictRetry');
const { notFound } = require('../utils/errors');

/** Genera un `_id` con prefijo de tipo: `video:9f8c...`. */
function makeId(type) {
  return `${type}:${randomUUID()}`;
}

/** Trae un documento por `_id`. Lanza 404 si no existe. */
async function getById(id, { label = 'Documento' } = {}) {
  try {
    return await db.get(id);
  } catch (err) {
    if (err.statusCode === 404) throw notFound(`${label} no encontrado: ${id}`);
    throw err;
  }
}

/** Igual que getById pero devuelve `null` en vez de lanzar. */
async function tryGetById(id) {
  try {
    return await db.get(id);
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

/**
 * Inserta un documento nuevo. Le pone `_id` (con prefijo), `type`,
 * `created_at` y `updated_at`. Devuelve el documento ya con `_rev`.
 */
async function insert(type, doc) {
  const now = new Date().toISOString();
  const toSave = {
    _id: doc._id || makeId(type),
    type,
    ...doc,
    created_at: now,
    updated_at: now,
  };
  const res = await db.insert(toSave);
  return { ...toSave, _id: res.id, _rev: res.rev };
}

/**
 * Actualización con patrón leer-modificar-escribir y REINTENTO ANTE 409.
 *
 * `mutator(doc)` recibe la versión fresca del documento y debe
 * devolverlo modificado (o devolver `undefined`/el mismo doc para
 * "sin cambios"). En cada reintento se vuelve a leer: así el `_rev`
 * enviado siempre es el más reciente. Ver `utils/conflictRetry.js`.
 */
async function updateWithRetry(id, mutator, { label = 'Documento' } = {}) {
  return withConflictRetry(
    async () => {
      const current = await getById(id, { label });
      const mutated = (await mutator(current)) || current;
      mutated.updated_at = new Date().toISOString();
      const res = await db.insert(mutated); // mismo _id + _rev actual => update
      return { ...mutated, _rev: res.rev };
    },
    { label: `actualización de ${label} (${id})` }
  );
}

/** Borra un documento (requiere `_rev` actual; reintenta ante 409). */
async function remove(id, { label = 'Documento' } = {}) {
  return withConflictRetry(
    async () => {
      const current = await getById(id, { label });
      return db.destroy(current._id, current._rev);
    },
    { label: `borrado de ${label} (${id})` }
  );
}

/**
 * Lista todos los documentos cuyo `_id` empieza por `${type}:` usando
 * `_all_docs` sobre el índice primario (sin índice secundario).
 * `￰` es el mayor code point posible: `type:` .. `type:￰`
 * cubre todo el rango del prefijo.
 */
async function listByType(type, { limit, skip } = {}) {
  const res = await db.list({
    include_docs: true,
    startkey: `${type}:`,
    endkey: `${type}:￰`,
    limit,
    skip,
  });
  return res.rows.map((r) => r.doc);
}

/**
 * Consulta Mango (`_find`). SOLO se usa para las búsquedas que tienen un
 * índice creado a propósito (ver `scripts/create-indexes.js`).
 * Si CouchDB responde con `warning` (consulta sin índice) se registra en
 * consola: sirve para demostrar en el video la diferencia indexado vs no.
 */
async function find(selector, options = {}) {
  const query = { selector, limit: options.limit || 100, ...options };
  const res = await db.find(query);
  if (res.warning) {
    console.warn('[CouchDB _find] Consulta SIN índice:', res.warning);
  }
  return res.docs;
}

/**
 * `_bulk_docs`: escribe/actualiza varios documentos en UNA sola petición.
 *
 * PSEUDO-ATOMICIDAD (Parte A: Atomicidad / Transacciones):
 * CouchDB NO tiene transacciones multi-documento. `_bulk_docs` NO es
 * "todo o nada": cada documento del lote se aplica de forma
 * independiente y puede fallar por su cuenta (típicamente un 409 si su
 * `_rev` quedó viejo). Por eso esta función DEVUELVE la lista de
 * resultados por documento y marca `hasErrors`; quien la llama debe
 * inspeccionar y compensar / reintentar (ver `loanService.js`).
 */
async function bulkDocs(docs) {
  const res = await db.bulk({ docs });
  const errors = res.filter((r) => r.error);
  return {
    results: res,
    hasErrors: errors.length > 0,
    errors,
    ok: errors.length === 0,
  };
}

/**
 * Contador monotónico (correlativo) SIN secuencias nativas.
 *
 * CouchDB no tiene `AUTO_INCREMENT` ni `SEQUENCE`. Un correlativo (p.ej.
 * el número de factura) se implementa como un documento
 * `counter:<name>` con `{ value }` y se incrementa con el mismo patrón
 * MVCC: leer -> +1 -> escribir -> si 409 (otro préstamo pidió número al
 * mismo tiempo) -> reintentar. Es exactamente el caso de uso para el
 * que sirve el control optimista.
 *
 * Devuelve el nuevo valor ya reservado.
 */
async function nextSequence(name) {
  const id = `counter:${name}`;
  return withConflictRetry(
    async () => {
      let doc = await tryGetById(id);
      if (!doc) {
        doc = { _id: id, type: 'counter', value: 0 };
      }
      doc.value += 1;
      doc.updated_at = new Date().toISOString();
      const res = await db.insert(doc); // si otro lo creó primero -> 409 -> retry
      return doc.value;
    },
    { label: `correlativo ${name}` }
  );
}

module.exports = {
  db,
  makeId,
  getById,
  tryGetById,
  insert,
  updateWithRetry,
  remove,
  listByType,
  find,
  bulkDocs,
  nextSequence,
};
