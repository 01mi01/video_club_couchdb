/** Controlador de VIDEOS. */
const videoService = require('../services/videoService');

exports.create = async (req, res) => {
  const video = await videoService.create(req.body || {});
  res.status(201).json(video);
};

exports.list = async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const skip = req.query.skip ? Number(req.query.skip) : undefined;
  res.json(await videoService.list({ limit, skip }));
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
