const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const c = require('../controllers/loanController');

router.post('/quote', asyncHandler(c.quote)); //          POST /api/loans/quote          (calcular importe sin persistir)
router.post('/', asyncHandler(c.create)); //              POST /api/loans               (registrar préstamo + factura)
router.get('/', asyncHandler(c.list)); //                 GET  /api/loans
router.get('/:id', asyncHandler(c.getById)); //           GET  /api/loans/:id
router.post('/:id/return', asyncHandler(c.return)); //    POST /api/loans/:id/return     (registrar devolución)
router.get('/:id/invoice', asyncHandler(c.invoiceByLoan)); // GET /api/loans/:id/invoice (factura del préstamo)

module.exports = router;
