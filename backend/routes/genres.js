const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const c = require('../controllers/genreController');

// Géneros: entidad normalizada propia (restricción del enunciado).
router.post('/', asyncHandler(c.create)); //        POST   /api/genres
router.get('/', asyncHandler(c.list)); //           GET    /api/genres
router.get('/:id', asyncHandler(c.getById)); //     GET    /api/genres/:id
router.put('/:id', asyncHandler(c.update)); //      PUT    /api/genres/:id
// Sin DELETE: el enunciado nunca pide "eliminar" ninguna entidad (solo
// "dar de baja" copias y "bloquear" clientes, ambos no-destructivos). Un
// género se DESACTIVA en vez de borrarse: deja de poder asignarse a
// películas nuevas, pero el documento persiste y las películas que ya lo
// referencian lo siguen mostrando sin problema (ver genreService.js).
router.patch('/:id/deactivate', asyncHandler(c.deactivate)); // PATCH /api/genres/:id/deactivate
router.patch('/:id/activate', asyncHandler(c.activate)); //     PATCH /api/genres/:id/activate

module.exports = router;
