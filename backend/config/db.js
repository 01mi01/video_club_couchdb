require('dotenv').config();
const nano = require('nano');

const couchUrl = `http://${process.env.COUCHDB_USER}:${encodeURIComponent(process.env.COUCHDB_PASSWORD)}@${process.env.COUCHDB_URL.replace('http://', '')}`;

const couch = nano(couchUrl);
const db = couch.db.use(process.env.COUCHDB_DB);

module.exports = { couch, db };