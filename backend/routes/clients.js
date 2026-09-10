const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const c = require('../controllers/clientController');

router.post('/', asyncHandler(c.create)); //             POST /api/clients
router.get('/', asyncHandler(c.list)); //                GET  /api/clients
router.get('/:id', asyncHandler(c.getById)); //          GET  /api/clients/:id
router.put('/:id', asyncHandler(c.update)); //           PUT  /api/clients/:id        (actualizar datos)
router.post('/:id/block', asyncHandler(c.block)); //     POST /api/clients/:id/block  (bloquear: fecha + razón)
router.post('/:id/unblock', asyncHandler(c.unblock)); // POST /api/clients/:id/unblock

module.exports = router;
