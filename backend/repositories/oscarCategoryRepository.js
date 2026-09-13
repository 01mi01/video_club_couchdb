const repo = require('./couchRepository');
const TYPE = 'oscar_category';

module.exports = {
  TYPE,
  create: (data) => repo.insert(TYPE, data),
  getById: (id) => repo.getById(id, { label: 'Categoría de Oscar' }),
  tryGetById: (id) => repo.tryGetById(id),
  list: (opts) => repo.listByType(TYPE, opts),
  update: (id, mutator) => repo.updateWithRetry(id, mutator, { label: 'Categoría de Oscar' }),
};
