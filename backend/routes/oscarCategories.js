const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const c = require('../controllers/oscarCategoryController');

// Categorías de Oscar: entidad normalizada propia, mismo patrón que
// géneros (ver repositories/oscarCategoryRepository.js para la decisión).
router.post('/', asyncHandler(c.create)); //        POST   /api/oscar-categories
router.get('/', asyncHandler(c.list)); //           GET    /api/oscar-categories
router.get('/:id', asyncHandler(c.getById)); //     GET    /api/oscar-categories/:id
router.put('/:id', asyncHandler(c.update)); //      PUT    /api/oscar-categories/:id
// Sin DELETE (mismo criterio que género: el enunciado nunca pide
// "eliminar" nada). Se desactiva/reactiva.
router.patch('/:id/deactivate', asyncHandler(c.deactivate)); // PATCH /api/oscar-categories/:id/deactivate
router.patch('/:id/activate', asyncHandler(c.activate)); //     PATCH /api/oscar-categories/:id/activate

module.exports = router;
