const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const c = require('../controllers/loanController');

router.get('/', asyncHandler(c.listInvoices)); //   GET /api/invoices
router.get('/:id', asyncHandler(c.getInvoice)); //  GET /api/invoices/:id

module.exports = router;
