const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const c = require('../controllers/genreController');

// Géneros: entidad normalizada propia (restricción del enunciado).
router.post('/', asyncHandler(c.create)); //        POST   /api/genres
router.get('/', asyncHandler(c.list)); //           GET    /api/genres
router.get('/:id', asyncHandler(c.getById)); //     GET    /api/genres/:id
router.put('/:id', asyncHandler(c.update)); //      PUT    /api/genres/:id
router.delete('/:id', asyncHandler(c.remove)); //   DELETE /api/genres/:id

module.exports = router;
