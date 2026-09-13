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
