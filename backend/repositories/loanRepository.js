/**
 * Repositorio de PRÉSTAMOS y FACTURAS.
 *
 * MODELO PRÉSTAMO (decidido aquí):
 *   {
 *     _id: "loan:<uuid>", type: "loan",
 *     client_id: "client:<uuid>",
 *     items: [
 *       { video_id: "video:<uuid>", copy_id: "c2", title: "..." }
 *     ],
 *     loan_date:   "ISO",              // fecha del préstamo
 *     days:        number,             // días de préstamo pactados
 *     due_date:    "ISO",              // fecha de devolución pactada
 *     return_date: "ISO" | null,       // fecha de devolución real
 *     pricing: {
 *       price_per_day: number,         // costo/día vigente al momento (snapshot)
 *       price_per_movie: number,       // lo que cuesta cada película por `days` días
 *       movies_count: number,
 *       base_amount: number,
 *       discount_percent: number,
 *       discount_amount: number,
 *       total_amount: number
 *     },
 *     status: "active" | "returned",
 *     invoice_id: "invoice:<uuid>",
 *     created_at, updated_at
 *   }
 *
 * MODELO FACTURA (documento separado: una factura es un comprobante
 * inmutable, con su propio ciclo de vida y numeración; embeberla en el
 * préstamo mezclaría dos cosas con reglas distintas):
 *   {
 *     _id: "invoice:<uuid>", type: "invoice",
 *     number: number,                  // correlativo legible
 *     loan_id: "loan:<uuid>",
 *     client_id: "client:<uuid>",
 *     issued_at: "ISO",
 *     currency: "Bs",
 *     lines: [ { description: "string", amount: number } ],
 *     subtotal: number,
 *     discount_percent: number,
 *     discount_amount: number,
 *     total: number,
 *     note: "string" | null            // p.ej. aviso de devolución tardía
 *   }
 */

const repo = require('./couchRepository');

module.exports = {
  getLoan: (id) => repo.getById(id, { label: 'Préstamo' }),
  listLoans: (opts) => repo.listByType('loan', opts),
  getInvoice: (id) => repo.getById(id, { label: 'Factura' }),
  listInvoices: (opts) => repo.listByType('invoice', opts),

  // La CREACIÓN y la DEVOLUCIÓN no se hacen aquí con inserts sueltos:
  // se arman como lote y se mandan por `_bulk_docs` desde loanService,
  // porque tocan varios documentos a la vez (préstamo + factura + N
  // videos) y hay que demostrar la pseudo-atomicidad explícitamente.
  bulk: (docs) => repo.bulkDocs(docs),
  makeId: (type) => repo.makeId(type),
};
