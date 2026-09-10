const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const authController = require('../controllers/authController');

// POST /api/login  -> valida credenciales contra el documento admin y
// devuelve un JWT. Es la ÚNICA ruta de negocio sin autenticación previa.
router.post('/login', asyncHandler(authController.login));

module.exports = router;
