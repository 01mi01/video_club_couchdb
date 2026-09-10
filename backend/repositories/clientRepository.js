/**
 * Repositorio de CLIENTES.
 *
 * MODELO (decidido aquí):
 *   {
 *     _id: "client:<uuid>", type: "client",
 *     first_name:       "string",       // nombre
 *     paternal_surname: "string",       // apellido paterno
 *     maternal_surname: "string" | null,// apellido materno (si tiene ambos)
 *     phone_mobile:     "string",       // número de teléfono celular
 *     email:            "string",
 *     birth_date:       "ISO date",     // fecha de nacimiento
 *     address: {
 *       text: "string",                 // dirección
 *       geo:  { lat: number, lng: number } | null  // geolocalización
 *     },
 *     registered_at:    "ISO",          // fecha de registro
 *
 *     // Bloqueo: los clientes bloqueados no pueden rentar. Se guarda la
 *     // fecha y la razón, como pide el enunciado.
 *     blocked: {
 *       is_blocked: boolean,
 *       date:   "ISO" | null,
 *       reason: "string" | null
 *     },
 *     created_at, updated_at
 *   }
 */

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
