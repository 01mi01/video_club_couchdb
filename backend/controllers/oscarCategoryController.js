/** Controlador de CATEGORÍAS DE OSCAR. */
const oscarCategoryService = require('../services/oscarCategoryService');
const { parsePagination } = require('../utils/pagination');

exports.create = async (req, res) => {
  const category = await oscarCategoryService.create(req.body || {});
  res.status(201).json(category);
};

exports.list = async (req, res) => {
  res.json(await oscarCategoryService.list(parsePagination(req.query)));
};

exports.getById = async (req, res) => {
  res.json(await oscarCategoryService.getById(req.params.id));
};

exports.update = async (req, res) => {
  res.json(await oscarCategoryService.update(req.params.id, req.body || {}));
};

exports.deactivate = async (req, res) => {
  res.json(await oscarCategoryService.deactivate(req.params.id));
};

exports.activate = async (req, res) => {
  res.json(await oscarCategoryService.activate(req.params.id));
};
