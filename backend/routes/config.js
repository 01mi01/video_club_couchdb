const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const c = require('../controllers/configController');

// Costos por día de préstamo (configurable). Define además el máximo de
// días permitido = mayor plazo con precio.
router.get('/pricing', asyncHandler(c.getPricing)); //   GET /api/config/pricing
router.put('/pricing', asyncHandler(c.setPricing)); //   PUT /api/config/pricing

// Descuentos por cantidad de películas (configurable).
router.get('/discounts', asyncHandler(c.getDiscounts)); // GET /api/config/discounts
router.put('/discounts', asyncHandler(c.setDiscounts)); // PUT /api/config/discounts

module.exports = router;
