/** Controlador de CONFIGURACIÓN (precios por día / descuentos por cantidad). */
const configService = require('../services/configService');

exports.getPricing = async (req, res) => {
  res.json(await configService.getPricing());
};

exports.setPricing = async (req, res) => {
  res.json(await configService.setPricing(req.body || {}));
};

exports.getDiscounts = async (req, res) => {
  res.json(await configService.getDiscounts());
};

exports.setDiscounts = async (req, res) => {
  res.json(await configService.setDiscounts(req.body || {}));
};
