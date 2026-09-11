const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const c = require('../controllers/zoneController');

// Zonas: entidad normalizada propia con lat/lng preconfigurados, referenciada
// desde `client.address.zone_id` (ver clientService.js).
router.post('/', asyncHandler(c.create)); //        POST   /api/zones
router.get('/', asyncHandler(c.list)); //           GET    /api/zones
router.get('/:id', asyncHandler(c.getById)); //     GET    /api/zones/:id
router.put('/:id', asyncHandler(c.update)); //      PUT    /api/zones/:id
// Sin DELETE: mismo patrón no-destructivo que género/categoría de Oscar —
// se desactiva en vez de borrarse (ver zoneService.js).
router.patch('/:id/deactivate', asyncHandler(c.deactivate)); // PATCH /api/zones/:id/deactivate
router.patch('/:id/activate', asyncHandler(c.activate)); //     PATCH /api/zones/:id/activate

module.exports = router;
