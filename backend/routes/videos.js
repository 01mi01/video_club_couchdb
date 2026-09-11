const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const c = require('../controllers/videoController');

// OJO con el orden: "/search" debe ir ANTES de "/:id" o Express tomaría
// "search" como un id de video.
router.get('/search', asyncHandler(c.search)); // GET /api/videos/search?title=&genreId=&actor=&oscarNomination=&oscarNominated=true

router.post('/', asyncHandler(c.create)); //      POST /api/videos            (registrar video + genera copias)
router.get('/', asyncHandler(c.list)); //         GET  /api/videos
router.get('/:id', asyncHandler(c.getById)); //   GET  /api/videos/:id
router.put('/:id', asyncHandler(c.update)); //    PUT  /api/videos/:id        (metadatos; no toca copias)

// Copias
router.post('/:id/copies', asyncHandler(c.addCopies)); //                       POST /api/videos/:id/copies         (registrar nuevas copias)
router.post('/:id/copies/:copyId/retire', asyncHandler(c.retireCopy)); //       POST /api/videos/:id/copies/:copyId/retire  (baja: fecha + razón)
router.post('/:id/copies/:copyId/recover', asyncHandler(c.recoverCopy)); //     POST /api/videos/:id/copies/:copyId/recover (copia "missing" -> "available")

module.exports = router;
