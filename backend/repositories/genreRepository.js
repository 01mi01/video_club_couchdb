const repo = require('./couchRepository');
const TYPE = 'genre';

module.exports = {
  create: (data) => repo.insert(TYPE, data),
  getById: (id) => repo.getById(id, { label: 'Género' }),
  tryGetById: (id) => repo.tryGetById(id),
  list: (opts) => repo.listByType(TYPE, opts),
  update: (id, mutator) => repo.updateWithRetry(id, mutator, { label: 'Género' }),
};
