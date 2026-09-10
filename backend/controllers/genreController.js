/** Controlador de GÉNEROS. */
const genreService = require('../services/genreService');

exports.create = async (req, res) => {
  const genre = await genreService.create(req.body || {});
  res.status(201).json(genre);
};

exports.list = async (req, res) => {
  res.json(await genreService.list());
};

exports.getById = async (req, res) => {
  res.json(await genreService.getById(req.params.id));
};

exports.update = async (req, res) => {
  res.json(await genreService.update(req.params.id, req.body || {}));
};

exports.remove = async (req, res) => {
  await genreService.remove(req.params.id);
  res.status(204).end();
};
