const express = require('express');
const router = express.Router();
const { couch } = require('../config/db');

router.get('/health', async (req, res) => {
  try {
    const info = await couch.request({ method: 'get', path: '' });
    res.json({ status: 'ok', couchdb: info });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;