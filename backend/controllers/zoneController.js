/** Controlador de ZONAS. */
const zoneService = require('../services/zoneService');
const { parsePagination } = require('../utils/pagination');

exports.create = async (req, res) => {
  const zone = await zoneService.create(req.body || {});
  res.status(201).json(zone);
};

exports.list = async (req, res) => {
  res.json(await zoneService.list(parsePagination(req.query)));
};

exports.getById = async (req, res) => {
  res.json(await zoneService.getById(req.params.id));
};

exports.update = async (req, res) => {
  res.json(await zoneService.update(req.params.id, req.body || {}));
};

exports.deactivate = async (req, res) => {
  res.json(await zoneService.deactivate(req.params.id));
};

exports.activate = async (req, res) => {
  res.json(await zoneService.activate(req.params.id));
};
