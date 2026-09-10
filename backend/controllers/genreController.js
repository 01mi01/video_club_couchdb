/** Controlador de GÉNEROS. */
const genreService = require('../services/genreService');
const { parsePagination } = require('../utils/pagination');

exports.create = async (req, res) => {
  const genre = await genreService.create(req.body || {});
  res.status(201).json(genre);
};

exports.list = async (req, res) => {
  // `?limit=` / `?skip=` opcionales; ausentes => defaults (nunca error).
  res.json(await genreService.list(parsePagination(req.query)));
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
