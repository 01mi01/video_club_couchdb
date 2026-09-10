/** Controlador de CLIENTES. */
const clientService = require('../services/clientService');
const { parsePagination } = require('../utils/pagination');

exports.create = async (req, res) => {
  const client = await clientService.create(req.body || {});
  res.status(201).json(client);
};

exports.list = async (req, res) => {
  // `?limit=` / `?skip=` opcionales; ausentes => defaults (nunca error).
  res.json(await clientService.list(parsePagination(req.query)));
};

exports.getById = async (req, res) => {
  res.json(await clientService.getById(req.params.id));
};

exports.update = async (req, res) => {
  res.json(await clientService.update(req.params.id, req.body || {}));
};

// Bloquear cliente (fecha + razón). Los bloqueados no pueden rentar.
exports.block = async (req, res) => {
  res.json(await clientService.block(req.params.id, req.body || {}));
};

exports.unblock = async (req, res) => {
  res.json(await clientService.unblock(req.params.id));
};
