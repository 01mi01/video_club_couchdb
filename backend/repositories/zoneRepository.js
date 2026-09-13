const repo = require('./couchRepository');
const TYPE = 'zone';

module.exports = {
  TYPE,
  create: (data) => repo.insert(TYPE, data),
  getById: (id) => repo.getById(id, { label: 'Zona' }),
  tryGetById: (id) => repo.tryGetById(id),
  list: (opts) => repo.listByType(TYPE, opts),
  update: (id, mutator) => repo.updateWithRetry(id, mutator, { label: 'Zona' }),
};
