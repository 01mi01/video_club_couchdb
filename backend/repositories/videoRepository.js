const repo = require('./couchRepository');
const TYPE = 'video';

module.exports = {
  TYPE,
  create: (data) => repo.insert(TYPE, data),
  getById: (id) => repo.getById(id, { label: 'Video' }),
  tryGetById: (id) => repo.tryGetById(id),
  list: (opts) => repo.listByType(TYPE, opts),
  update: (id, mutator) => repo.updateWithRetry(id, mutator, { label: 'Video' }),
  remove: (id) => repo.remove(id, { label: 'Video' }),
  // El selector Mango ya viene armado desde videoService, que deja claro
  // qué índice se está aprovechando.
  find: (selector, options) => repo.find(selector, options),
};
