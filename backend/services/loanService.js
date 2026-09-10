/**
 * ============================================================================
 * Servicio de PRÉSTAMOS — Gestión de Préstamos del enunciado
 * ============================================================================
 *
 * Cubre:
 *   - Registrar el préstamo de una o varias películas.
 *   - Registrar fecha de devolución y calcular el importe.
 *   - Emitir factura con el importe total.
 *   - Reglas: cliente no bloqueado, copias disponibles, plazo <= máximo
 *     configurado, descuentos por cantidad.
 *   - Devolución de películas (libera copias, recalcula por fecha real).
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ ESTE ARCHIVO ES EL "PROBLEMA COMPLEJO" CENTRAL
 * ----------------------------------------------------------------------------
 * Un préstamo toca VARIOS documentos a la vez:
 *     N documentos de video (marcar copias como prestadas)
 *   + 1 documento de préstamo
 *   + 1 documento de factura
 *
 * CouchDB NO tiene transacciones multi-documento. La herramienta más
 * cercana es `_bulk_docs`, que escribe todo en una sola petición HTTP
 * pero **NO es atómica**: cada documento se aplica por separado y puede
 * fallar solo (típicamente 409 si su `_rev` quedó viejo).
 *
 * Estrategia de PSEUDO-ATOMICIDAD implementada aquí:
 *   1. Ciclo leer-validar-escribir envuelto en `withConflictRetry`.
 *   2. Se lee la versión fresca de TODOS los documentos involucrados.
 *   3. Se validan las reglas de negocio sobre esos datos frescos.
 *   4. Se arma el lote y se manda por `_bulk_docs`.
 *   5. Si el lote vuelve con errores -> COMPENSACIÓN best-effort de lo que
 *      sí se escribió, y se relanza el conflicto para reintentar con
 *      lecturas nuevas.
 *
 * Es honesto sobre la limitación: no es una transacción real, es una
 * secuencia compensable. Se documenta como tal.
 * ============================================================================
 */

const clientRepo = require('../repositories/clientRepository');
const videoRepo = require('../repositories/videoRepository');
const loanRepo = require('../repositories/loanRepository');
const configService = require('./configService');
const clientService = require('./clientService');
const pricing = require('./pricing');
const repo = require('../repositories/couchRepository');
const { withConflictRetry } = require('../utils/conflictRetry');
const { badRequest, notFound, conflict } = require('../utils/errors');

/* ---------------------------------------------------------------------------
 * Resolución de plazo (days <-> due_date)
 * ------------------------------------------------------------------------- */
function resolveTerm(body, loanDateISO) {
  const loanDate = new Date(loanDateISO);
  if (body.days !== undefined) {
    const days = Number(body.days);
    if (!Number.isInteger(days) || days < 1) throw badRequest('`days` debe ser entero >= 1.');
    const due = new Date(loanDate.getTime() + days * 86400000);
    return { days, due_date: due.toISOString() };
  }
  if (body.due_date !== undefined) {
    const due = new Date(body.due_date);
    if (Number.isNaN(due.getTime())) throw badRequest('`due_date` inválida.');
    if (due.getTime() <= loanDate.getTime()) {
      throw badRequest('`due_date` debe ser posterior a la fecha del préstamo.');
    }
    const days = pricing.daysBetween(loanDateISO, due.toISOString());
    return { days, due_date: due.toISOString() };
  }
  throw badRequest('Indica `days` o `due_date`.');
}

/* ---------------------------------------------------------------------------
 * Selección de copias disponibles por video
 * ------------------------------------------------------------------------- *
 * `items` puede repetir el mismo `video_id` (cliente que lleva 2 copias de
 * la misma peli). Se agrupa por video y se asignan copias distintas.
 * Devuelve: { videoDoc, assignments:[{copy_id}], ... } por cada video.
 * ------------------------------------------------------------------------- */
async function planAssignments(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('El préstamo debe incluir al menos una película en `items`.');
  }

  // Agrupar solicitudes por video.
  const byVideo = new Map();
  for (const it of items) {
    if (!it || !it.video_id) throw badRequest('Cada item requiere `video_id`.');
    if (!byVideo.has(it.video_id)) byVideo.set(it.video_id, []);
    byVideo.get(it.video_id).push(it.copy_id || null);
  }

  const plan = [];
  for (const [videoId, requestedCopyIds] of byVideo) {
    const videoDoc = await videoRepo.tryGetById(videoId);
    if (!videoDoc || videoDoc.type !== 'video') {
      throw notFound(`Video no encontrado: ${videoId}`);
    }

    const available = videoDoc.copies.filter((c) => c.status === 'available');
    const chosen = [];

    for (const reqCopyId of requestedCopyIds) {
      let copy;
      if (reqCopyId) {
        copy = videoDoc.copies.find((c) => c.copy_id === reqCopyId);
        if (!copy) throw notFound(`Copia ${reqCopyId} no existe en ${videoId}.`);
        if (copy.status !== 'available') {
          throw conflict(`La copia ${reqCopyId} de "${title(videoDoc)}" no está disponible (${copy.status}).`);
        }
        if (chosen.includes(copy)) {
          throw badRequest(`La copia ${reqCopyId} fue pedida dos veces en el mismo préstamo.`);
        }
      } else {
        copy = available.find((c) => !chosen.includes(c));
        if (!copy) {
          throw conflict(
            `No hay copias disponibles suficientes de "${title(videoDoc)}" ` +
              `(disponibles: ${available.length}, pedidas: ${requestedCopyIds.length}).`
          );
        }
      }
      chosen.push(copy);
    }

    plan.push({ videoDoc, copyIds: chosen.map((c) => c.copy_id) });
  }
  return plan;
}

function title(videoDoc) {
  return videoDoc.display_title || (videoDoc.all_titles && videoDoc.all_titles[0]) || videoDoc._id;
}

/* ---------------------------------------------------------------------------
 * Compensación best-effort tras un `_bulk_docs` parcialmente fallido
 * ------------------------------------------------------------------------- */
async function compensate(bulkResults, sentDocs) {
  // Índice _id -> resultado (para saber cuáles SÍ se escribieron).
  const okIds = new Set(bulkResults.results.filter((r) => r.ok).map((r) => r.id));

  for (const doc of sentDocs) {
    if (!okIds.has(doc._id)) continue;
    try {
      if (doc.type === 'video') {
        // Revertir el estado de las copias que este préstamo había marcado.
        await videoRepo.update(doc._id, (fresh) => {
          for (const c of fresh.copies) {
            if (doc.__touchedCopies && doc.__touchedCopies.includes(c.copy_id)) {
              c.status = 'available';
            }
          }
          return fresh;
        });
      } else if (doc.type === 'loan' || doc.type === 'invoice') {
        const fresh = await repo.tryGetById(doc._id);
        if (fresh) await repo.db.destroy(fresh._id, fresh._rev);
      }
    } catch (e) {
      // La compensación es best-effort: se registra y se sigue. Si falla,
      // queda un documento "colgado" que el propietario puede limpiar a
      // mano. Esta es la limitación honesta de no tener transacciones.
      console.error('[compensación] no se pudo revertir', doc._id, e.message);
    }
  }
}

/* ===========================================================================
 * CASO DE USO 1: registrar préstamo
 * ======================================================================== */
async function createLoan(body) {
  const loanDate = body.loan_date || new Date().toISOString();

  return withConflictRetry(
    async () => {
      /* ----- 3.1  Cliente: existe y NO está bloqueado ------------------ */
      const client = await clientRepo.getById(body.client_id);
      clientService.assertCanRent(client); // regla de negocio explícita

      /* ----- 3.2  Plazo y configuración ------------------------------- */
      const { days, due_date } = resolveTerm(body, loanDate);
      const cfg = await configService.effectiveConfig();

      /* ----- 3.3  Disponibilidad de copias (datos frescos) ----------- */
      const plan = await planAssignments(body.items);
      const moviesCount = plan.reduce((n, p) => n + p.copyIds.length, 0);

      /* ----- 3.4  Cálculo de importe + descuento --------------------- *
       * `pricing.quote` valida además que `days` <= máximo configurado
       * ("no se permiten préstamos mayores a los días configurados").   */
      const breakdown = pricing.quote(days, moviesCount, cfg.pricing, cfg.discounts);

      /* ----- 3.5  Correlativo de factura (contador MVCC) ------------- */
      const invoiceNumber = await repo.nextSequence('invoice');

      /* ----- 3.6  Armado del LOTE para _bulk_docs ------------------- */
      const loanId = loanRepo.makeId('loan');
      const invoiceId = loanRepo.makeId('invoice');
      const now = new Date().toISOString();

      const loanItems = [];
      const videoDocsToSave = plan.map(({ videoDoc, copyIds }) => {
        for (const cid of copyIds) {
          const copy = videoDoc.copies.find((c) => c.copy_id === cid);
          copy.status = 'loaned'; // <- cambio de estado de la copia embebida
          loanItems.push({ video_id: videoDoc._id, copy_id: cid, title: title(videoDoc) });
        }
        videoDoc.updated_at = now;
        // marca interna para la compensación (se borra antes de enviar)
        videoDoc.__touchedCopies = copyIds;
        return videoDoc;
      });

      const loanDoc = {
        _id: loanId,
        type: 'loan',
        client_id: client._id,
        items: loanItems,
        loan_date: loanDate,
        days,
        due_date,
        return_date: null,
        pricing: breakdown,
        status: 'active',
        invoice_id: invoiceId,
        created_at: now,
        updated_at: now,
      };

      const invoiceDoc = {
        _id: invoiceId,
        type: 'invoice',
        number: invoiceNumber,
        loan_id: loanId,
        client_id: client._id,
        issued_at: now,
        currency: 'Bs',
        lines: buildInvoiceLines(loanItems, breakdown, days),
        subtotal: breakdown.base_amount,
        discount_percent: breakdown.discount_percent,
        discount_amount: breakdown.discount_amount,
        total: breakdown.total_amount,
        note: null,
        created_at: now,
        updated_at: now,
      };

      /* ----- 3.7  Enviar el lote ---------------------------------------
       * Orden: primero los videos, luego préstamo y factura. `_bulk_docs`
       * NO garantiza atomicidad; por eso se inspecciona el resultado. */
      const sent = [...videoDocsToSave, loanDoc, invoiceDoc];
      const payload = sent.map((d) => {
        const { __touchedCopies, ...clean } = d;
        return clean;
      });

      const result = await loanRepo.bulk(payload);

      if (result.hasErrors) {
        // Compensar lo que sí se escribió y relanzar como 409 para que
        // `withConflictRetry` reintente con lecturas frescas.
        await compensate(result, sent);
        const allConflicts = result.errors.every((e) => e.error === 'conflict');
        const err = new Error(
          `Fallo parcial al registrar el préstamo (${result.errors.length} doc con error). ` +
            (allConflicts ? 'Se reintenta.' : 'Revisa los documentos afectados.')
        );
        err.statusCode = allConflicts ? 409 : 500;
        err.details = result.errors;
        throw err;
      }

      // Éxito: devolver préstamo + factura ya con _rev.
      const revById = Object.fromEntries(result.results.map((r) => [r.id, r.rev]));
      return {
        loan: { ...loanDoc, _rev: revById[loanId] },
        invoice: { ...invoiceDoc, _rev: revById[invoiceId] },
      };
    },
    { label: 'registro de préstamo', retries: 4 }
  );
}

function buildInvoiceLines(loanItems, breakdown, days) {
  const lines = loanItems.map((it) => ({
    description: `Préstamo ${days} día(s) — "${it.title}" (copia ${it.copy_id})`,
    amount: breakdown.price_per_movie,
  }));
  if (breakdown.discount_amount > 0) {
    lines.push({
      description: `Descuento por cantidad (${breakdown.movies_count} películas, ${breakdown.discount_percent}%)`,
      amount: -breakdown.discount_amount,
    });
  }
  return lines;
}

/* ===========================================================================
 * CASO DE USO 2: cotizar SIN persistir
 * (Buscar pelis -> agregarlas -> fijar fecha de devolución -> ver importe)
 * ======================================================================== */
async function quoteLoan(body) {
  const loanDate = body.loan_date || new Date().toISOString();
  const client = await clientRepo.getById(body.client_id);
  clientService.assertCanRent(client);

  const { days, due_date } = resolveTerm(body, loanDate);
  const cfg = await configService.effectiveConfig();
  const plan = await planAssignments(body.items); // valida disponibilidad
  const moviesCount = plan.reduce((n, p) => n + p.copyIds.length, 0);
  const breakdown = pricing.quote(days, moviesCount, cfg.pricing, cfg.discounts);

  return {
    client_id: client._id,
    loan_date: loanDate,
    due_date,
    days,
    max_days: cfg.max_days,
    items: plan.flatMap(({ videoDoc, copyIds }) =>
      copyIds.map((cid) => ({ video_id: videoDoc._id, copy_id: cid, title: title(videoDoc) }))
    ),
    pricing: breakdown,
  };
}

/* ===========================================================================
 * CASO DE USO 3: registrar DEVOLUCIÓN
 * ------------------------------------------------------------------------- *
 * Libera las copias, recalcula el importe según la fecha REAL de
 * devolución y actualiza la factura. También multi-documento -> _bulk_docs
 * con la misma estrategia compensable.
 * ======================================================================== */
async function returnLoan(loanId, body) {
  const returnDate = body.return_date || new Date().toISOString();

  return withConflictRetry(
    async () => {
      const loan = await loanRepo.getLoan(loanId);
      if (loan.status === 'returned') {
        throw conflict('Este préstamo ya fue devuelto.');
      }
      if (new Date(returnDate).getTime() < new Date(loan.loan_date).getTime()) {
        throw badRequest('La fecha de devolución no puede ser anterior al préstamo.');
      }

      const cfg = await configService.effectiveConfig();

      // Días reales transcurridos. Para tarifar se recorta al máximo
      // configurado (la tabla de precios sólo llega hasta ahí); si el
      // cliente se pasó, se deja constancia en la nota de la factura.
      const actualDays = pricing.daysBetween(loan.loan_date, returnDate);
      const billedDays = Math.min(Math.max(actualDays, 1), cfg.max_days);
      const late = actualDays > loan.days;

      const breakdown = pricing.quote(
        billedDays,
        loan.pricing.movies_count,
        cfg.pricing,
        cfg.discounts
      );

      // Recargar los videos afectados y liberar SUS copias.
      const touched = new Map(); // videoId -> Set(copyId)
      for (const it of loan.items) {
        if (!touched.has(it.video_id)) touched.set(it.video_id, new Set());
        touched.get(it.video_id).add(it.copy_id);
      }

      const videoDocsToSave = [];
      for (const [videoId, copyIds] of touched) {
        const v = await videoRepo.getById(videoId);
        for (const c of v.copies) {
          if (copyIds.has(c.copy_id) && c.status === 'loaned') {
            c.status = 'available';
          }
        }
        v.__touchedCopies = [...copyIds];
        videoDocsToSave.push(v);
      }

      const now = new Date().toISOString();
      const updatedLoan = {
        ...loan,
        status: 'returned',
        return_date: returnDate,
        actual_days: actualDays,
        returned_late: late,
        pricing_original: loan.pricing_original || loan.pricing,
        pricing: breakdown,
        updated_at: now,
      };

      const invoice = await loanRepo.getInvoice(loan.invoice_id);
      const updatedInvoice = {
        ...invoice,
        lines: buildInvoiceLines(loan.items, breakdown, billedDays),
        subtotal: breakdown.base_amount,
        discount_percent: breakdown.discount_percent,
        discount_amount: breakdown.discount_amount,
        total: breakdown.total_amount,
        note: late
          ? `Devolución tardía: ${actualDays} días reales vs ${loan.days} pactados. Tarifado a ${billedDays} día(s).`
          : null,
        updated_at: now,
      };

      const sent = [...videoDocsToSave, updatedLoan, updatedInvoice];
      const payload = sent.map((d) => {
        const { __touchedCopies, ...clean } = d;
        return clean;
      });

      const result = await loanRepo.bulk(payload);
      if (result.hasErrors) {
        await compensate(result, sent);
        const allConflicts = result.errors.every((e) => e.error === 'conflict');
        const err = new Error(
          `Fallo parcial al registrar la devolución (${result.errors.length} doc con error).`
        );
        err.statusCode = allConflicts ? 409 : 500;
        err.details = result.errors;
        throw err;
      }

      const revById = Object.fromEntries(result.results.map((r) => [r.id, r.rev]));
      return {
        loan: { ...updatedLoan, _rev: revById[updatedLoan._id] },
        invoice: { ...updatedInvoice, _rev: revById[updatedInvoice._id] },
      };
    },
    { label: 'registro de devolución', retries: 4 }
  );
}

/* ---------------------------------------------------------------------------
 * Lecturas
 * ------------------------------------------------------------------------- */
async function listLoans(opts) {
  return loanRepo.listLoans(opts);
}
async function getLoan(id) {
  return loanRepo.getLoan(id);
}
async function getInvoiceByLoan(loanId) {
  const loan = await loanRepo.getLoan(loanId);
  return loanRepo.getInvoice(loan.invoice_id);
}
async function getInvoice(id) {
  return loanRepo.getInvoice(id);
}
async function listInvoices(opts) {
  return loanRepo.listInvoices(opts);
}

module.exports = {
  createLoan,
  quoteLoan,
  returnLoan,
  listLoans,
  getLoan,
  getInvoiceByLoan,
  getInvoice,
  listInvoices,
};
