/** Controlador de VIDEOS. */
const videoService = require('../services/videoService');
const { parsePagination } = require('../utils/pagination');

exports.create = async (req, res) => {
  const video = await videoService.create(req.body || {});
  res.status(201).json(video);
};

exports.list = async (req, res) => {
  // `limit`/`skip` opcionales: si faltan o vienen vacíos, `parsePagination`
  // aplica los valores por defecto (limit 50, skip 0). Nunca es un error.
  res.json(await videoService.list(parsePagination(req.query)));
};

// IMPORTANTE: esta ruta se monta ANTES de "/:id" para que "search" no se
// interprete como un id.
exports.search = async (req, res) => {
  res.json(await videoService.search(req.query || {}));
};

exports.getById = async (req, res) => {
  res.json(await videoService.getById(req.params.id));
};

exports.update = async (req, res) => {
  res.json(await videoService.update(req.params.id, req.body || {}));
};

// 2. Registrar nuevas copias para una película.
exports.addCopies = async (req, res) => {
  res.json(await videoService.addCopies(req.params.id, req.body || {}));
};

// 3. Registrar baja de una copia (fecha + razón).
exports.retireCopy = async (req, res) => {
  res.json(await videoService.retireCopy(req.params.id, req.params.copyId, req.body || {}));
};

// Recuperar una copia "missing" (no devuelta/perdida/robada) que apareció.
exports.recoverCopy = async (req, res) => {
  res.json(await videoService.recoverCopy(req.params.id, req.params.copyId));
};
