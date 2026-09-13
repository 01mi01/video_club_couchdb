/**
 * Repositorio genérico de CouchDB (cliente `nano`): único punto que habla
 * con `nano` directamente. Los servicios piden operaciones con significado
 * ("inserta", "trae por prefijo", "bulk"), nunca usan `nano` directamente.
 *
 * IDs con prefijo de tipo (`genre:<uuid>`, `video:<uuid>`, ...): listar por
 * tipo usa `_all_docs` sobre ese prefijo (índice primario), no un índice
 * Mango sobre `type`.
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
 * Lista documentos cuyo `_id` empieza por `${type}:` vía `_all_docs` sobre
 * el índice primario. `￰` es el mayor code point posible, así
 * `type:` .. `type:￰` cubre todo el rango del prefijo.
 *
 * `limit`/`skip` se agregan a la query SOLO si son números finitos: `nano`
 * serializa cualquier valor con `String()`, así que un `limit: undefined`
 * llegaría a CouchDB como `?limit=undefined` -> 400.
 */
async function listByType(type, { limit, skip } = {}) {
  const query = {
    include_docs: true,
    startkey: `${type}:`,
    endkey: `${type}:￰`,
  };
  if (Number.isFinite(limit)) query.limit = limit;
  if (Number.isFinite(skip) && skip > 0) query.skip = skip;

  const res = await db.list(query);
  return res.rows.map((r) => r.doc);
}

/**
 * Consulta Mango (`_find`), solo para búsquedas con índice creado a
 * propósito (ver `scripts/create-indexes.js`). Si CouchDB responde con
 * `warning` (sin índice), se registra en consola.
 */
async function find(selector, options = {}) {
  // `limit` se desestructura aparte para que `undefined` no pise el
  // default vía el spread (mismo problema que en listByType).
  const { limit, ...rest } = options;
  const query = { selector, limit: Number.isFinite(limit) ? limit : 100, ...rest };
  const res = await db.find(query);
  if (res.warning) {
    console.warn('[CouchDB _find] Consulta SIN índice:', res.warning);
  }
  return res.docs;
}

/**
 * `_bulk_docs`: escribe varios documentos en una sola petición, pero NO es
 * atómico — cada documento puede fallar por su cuenta (típicamente 409 por
 * `_rev` viejo). Por eso devuelve los resultados por documento y marca
 * `hasErrors`; quien llama debe inspeccionar y compensar/reintentar (ver
 * `loanService.js`).
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
 * Contador monotónico (ej. número de factura) sin `AUTO_INCREMENT` nativo:
 * documento `counter:<name>` con `{ value }`, incrementado con el mismo
 * patrón MVCC (leer -> +1 -> escribir -> 409 -> reintentar).
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
