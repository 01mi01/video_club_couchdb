/** Controlador de PRÉSTAMOS y FACTURAS. */
const loanService = require('../services/loanService');
const { parsePagination } = require('../utils/pagination');

// Cotización sin persistir: calcular importe según fecha de devolución.
exports.quote = async (req, res) => {
  res.json(await loanService.quoteLoan(req.body || {}));
};

// Registrar el préstamo (préstamo + factura + copias) vía _bulk_docs.
exports.create = async (req, res) => {
  const result = await loanService.createLoan(req.body || {});
  res.status(201).json(result);
};

exports.list = async (req, res) => {
  // `?limit=` / `?skip=` opcionales; ausentes => defaults (nunca error).
  res.json(await loanService.listLoans(parsePagination(req.query)));
};

exports.getById = async (req, res) => {
  res.json(await loanService.getLoan(req.params.id));
};

// Registrar devolución: libera copias y recalcula el importe.
exports.return = async (req, res) => {
  res.json(await loanService.returnLoan(req.params.id, req.body || {}));
};

// Baja por NO DEVOLUCIÓN: da de baja la(s) copia(s) del préstamo vencido
// que nunca volvieron y cierra el préstamo como "unreturned".
exports.writeOff = async (req, res) => {
  res.json(await loanService.writeOffUnreturned(req.params.id, req.body || {}));
};

// Factura del préstamo.
exports.invoiceByLoan = async (req, res) => {
  res.json(await loanService.getInvoiceByLoan(req.params.id));
};

exports.listInvoices = async (req, res) => {
  // `?limit=` / `?skip=` opcionales; ausentes => defaults (nunca error).
  res.json(await loanService.listInvoices(parsePagination(req.query)));
};

exports.getInvoice = async (req, res) => {
  res.json(await loanService.getInvoice(req.params.id));
};
