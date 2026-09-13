const repo = require('./couchRepository');
const TYPE = 'client';

module.exports = {
  create: (data) => repo.insert(TYPE, data),
  getById: (id) => repo.getById(id, { label: 'Cliente' }),
  tryGetById: (id) => repo.tryGetById(id),
  list: (opts) => repo.listByType(TYPE, opts),
  update: (id, mutator) => repo.updateWithRetry(id, mutator, { label: 'Cliente' }),
  remove: (id) => repo.remove(id, { label: 'Cliente' }),
};
