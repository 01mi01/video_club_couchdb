/** Controlador de autenticación. Sólo traduce HTTP <-> servicio. */
const authService = require('../services/authService');

exports.login = async (req, res) => {
  const { username, password } = req.body || {};
  const result = await authService.login(username, password);
  res.json(result);
};
