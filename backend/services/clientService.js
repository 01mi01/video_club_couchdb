/**
 * Servicio de CLIENTES.
 *   1. Registrar nuevos clientes.
 *   2. Actualizar datos.
 *   3. Bloquear/desbloquear (fecha + razón). Bloqueados no pueden rentar.
 */

const clientRepo = require('../repositories/clientRepository');
const zoneRepo = require('../repositories/zoneRepository');
const { badRequest, conflict } = require('../utils/errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function normalize(body, { partial = false, existingZoneId = null } = {}) {
  const out = {};
  const req = (field, label) => {
    if (!partial && !String(body[field] || '').trim()) {
      throw badRequest(`\`${field}\` (${label}) es obligatorio.`);
    }
  };

  req('first_name', 'nombre');
  req('paternal_surname', 'apellido paterno');
  req('phone_mobile', 'teléfono celular');
  req('birth_date', 'fecha de nacimiento');
  // `email` es opcional (el enunciado lo lista pero no lo exige); si se
  // provee, igual se valida el formato (EMAIL_RE abajo).

  if (body.first_name !== undefined) out.first_name = String(body.first_name).trim();
  if (body.paternal_surname !== undefined)
    out.paternal_surname = String(body.paternal_surname).trim();
  // Apellido materno: opcional ("si tiene ambos").
  if (body.maternal_surname !== undefined) {
    const m = String(body.maternal_surname).trim();
    out.maternal_surname = m || null;
  }
  if (body.phone_mobile !== undefined) out.phone_mobile = String(body.phone_mobile).trim();

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) throw badRequest('`email` no tiene formato válido.');
    out.email = email || null;
  }

  if (body.birth_date !== undefined) {
    const d = new Date(body.birth_date);
    if (Number.isNaN(d.getTime())) throw badRequest('`birth_date` no es una fecha válida.');
    if (d.getTime() > Date.now()) throw badRequest('`birth_date` no puede ser futura.');
    out.birth_date = d.toISOString().slice(0, 10);
  }

  // La geolocalización de la dirección se resuelve por referencia a una
  // ZONA preconfigurada (documento normalizado, ver zoneRepository.js) en
  // vez de que el empleado teclee lat/lng a mano.
  if (body.address !== undefined || !partial) {
    const addr = body.address || {};
    const text = String(addr.text || '').trim();
    if (!partial && !text) throw badRequest('`address.text` (dirección) es obligatorio.');

    let zone_id = null;
    const rawZoneId = addr.zone_id !== undefined ? addr.zone_id : addr.zoneId;
    if (rawZoneId) {
      const zone = await zoneRepo.tryGetById(rawZoneId);
      if (!zone || zone.type !== 'zone') throw badRequest(`Zona inexistente: ${rawZoneId}`);
      // Igual que género/categoría de Oscar: una zona inactiva no se puede
      // asignar de nuevo, pero conservar la que ya tenía sí se permite.
      if (zone.active === false && rawZoneId !== existingZoneId) {
        throw badRequest(
          `La zona "${zone.name}" está inactiva: no se puede asignar a clientes nuevos ni agregar en una edición.`
        );
      }
      zone_id = rawZoneId;
    }
    out.address = { text, zone_id };
  }

  return out;
}

async function create(body) {
  const data = await normalize(body, { partial: false });
  // Apellido materno opcional: si no vino, se guarda explícitamente como
  // `null` (no ausente) para que TODOS los clientes tengan la misma forma.
  if (data.maternal_surname === undefined) data.maternal_surname = null;
  data.registered_at = body.registered_at || new Date().toISOString();
  data.blocked = { is_blocked: false, date: null, reason: null };
  return clientRepo.create(data);
}

async function list(opts) {
  return clientRepo.list(opts);
}

async function getById(id) {
  return clientRepo.getById(id);
}

/** 2. Actualizar datos. No cambia el estado de bloqueo (tiene su endpoint). */
async function update(id, body) {
  // Lectura previa solo para conocer la zona ya asociada (ver comentario
  // sobre zonas inactivas en `normalize`).
  const current = await clientRepo.getById(id);
  const patch = await normalize(body, {
    partial: true,
    existingZoneId: current.address?.zone_id || null,
  });
  if (Object.keys(patch).length === 0) throw badRequest('Nada que actualizar.');
  return clientRepo.update(id, (doc) => {
    if (patch.address) {
      doc.address = { ...doc.address, ...patch.address };
      delete patch.address;
    }
    Object.assign(doc, patch);
    return doc;
  });
}

/** 3. Bloquear cliente: registra fecha y razón. */
async function block(id, body) {
  const reason = String(body.reason || '').trim();
  if (!reason) throw badRequest('El bloqueo requiere `reason`.');
  const date = body.date || new Date().toISOString();
  return clientRepo.update(id, (doc) => {
    if (doc.blocked && doc.blocked.is_blocked) {
      throw conflict('El cliente ya está bloqueado.');
    }
    doc.blocked = { is_blocked: true, date, reason };
    return doc;
  });
}

/** Desbloqueo (complementa el bloqueo; útil en la operación real). */
async function unblock(id) {
  return clientRepo.update(id, (doc) => {
    if (!doc.blocked || !doc.blocked.is_blocked) {
      throw conflict('El cliente no está bloqueado.');
    }
    doc.blocked = { is_blocked: false, date: null, reason: null };
    return doc;
  });
}

/**
 * Regla de negocio compartida con préstamos: lanza si el cliente está
 * bloqueado. Se deja aquí para que la regla viva en un solo lugar.
 */
function assertCanRent(clientDoc) {
  if (clientDoc.blocked && clientDoc.blocked.is_blocked) {
    throw conflict(
      `Cliente bloqueado (${clientDoc.blocked.reason}). No puede rentar películas.`
    );
  }
}

module.exports = { create, list, getById, update, block, unblock, assertCanRent };
