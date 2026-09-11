/**
 * ============================================================================
 * scripts/migrate-client-zones.js  —  EJECUCIÓN MANUAL, UNA SOLA VEZ
 * ============================================================================
 *
 * Introduce la entidad ZONA (ver `repositories/zoneRepository.js`) y migra
 * a los 20 clientes reales ya cargados de `address.geo` (lat/lng tecleados
 * a mano) a `address.zone_id` (referencia a una zona preconfigurada).
 *
 * QUÉ HACE
 *   1. Crea (si no existen ya, por `name`) las zonas del catálogo curado
 *      (mapa ZONES abajo: barrios específicos de La Paz, Santa Cruz de la
 *      Sierra y Cochabamba, con nombre + lat/lng reales).
 *   2. Para cada cliente real (mapa CLIENT_ZONE, por `_id`), asigna
 *      `address.zone_id` con la zona correspondiente y actualiza
 *      `address.text` con SOLO la calle/número (sin repetir el nombre de
 *      la zona ahí: la UI arma la dirección completa a mostrar como
 *      `address.text` + el nombre de la zona referenciada — ver
 *      `lib/format.js > fullAddress` en el frontend).
 *
 * Uso:
 *   node scripts/migrate-client-zones.js             (DRY-RUN: solo reporta)
 *   node scripts/migrate-client-zones.js --apply      (crea zonas + migra clientes)
 *
 * IDEMPOTENTE: si un cliente ya tiene el `zone_id`/`address.text` esperado,
 * se saltea. Las zonas se reutilizan por nombre si ya existen (no duplica).
 *
 * VERIFICACIÓN ESTRICTA POR CLIENTE: tras cada `update` se relee el
 * documento YA GUARDADO en CouchDB y se compara contra lo esperado
 * (`zone_id` correcto, `address.text` correcto). Si algo no cuadra, se
 * aborta con el detalle del cliente afectado.
 * ============================================================================
 */

require('dotenv').config();
const { db } = require('../config/db');
const clientRepo = require('../repositories/clientRepository');
const zoneService = require('../services/zoneService');

const APPLY = process.argv.includes('--apply');

// Zonas: barrios específicos de las 3 ciudades principales, nombre +
// lat/lng reales.
const ZONES = [
  { name: 'Calacoto, La Paz', geo: { lat: -16.5473, lng: -68.0839 } },
  { name: 'Montenegro, La Paz', geo: { lat: -16.5453, lng: -68.081 } },
  { name: 'Achumani, La Paz', geo: { lat: -16.5586, lng: -68.0625 } },
  { name: 'San Miguel, La Paz', geo: { lat: -16.5407, lng: -68.082 } },
  { name: 'Sopocachi, La Paz', geo: { lat: -16.5108, lng: -68.1275 } },
  { name: 'Cala Cala, Cochabamba', geo: { lat: -17.3712, lng: -66.1548 } },
  { name: 'La Recoleta, Cochabamba', geo: { lat: -17.3838, lng: -66.1642 } },
  { name: 'Queru Queru, Cochabamba', geo: { lat: -17.38, lng: -66.13 } },
  { name: 'Aranjuez, Cochabamba', geo: { lat: -17.396, lng: -66.115 } },
  { name: 'Equipetrol, Santa Cruz de la Sierra', geo: { lat: -17.7648, lng: -63.1955 } },
  { name: 'Las Palmas, Santa Cruz de la Sierra', geo: { lat: -17.7725, lng: -63.178 } },
  { name: 'Urbari, Santa Cruz de la Sierra', geo: { lat: -17.799, lng: -63.193 } },
];

// Cliente (_id, SIN el prefijo "client:") -> { zona, calle/número (SIN el
// nombre de la zona — eso lo agrega la UI, ver comentario arriba) }.
const CLIENT_ZONE = {
  '0c490111-c135-4f06-b739-2bf9c47ca62d': { zone: 'La Recoleta, Cochabamba', addr: 'Av. Pando 780' }, // Jessica Turner
  '13e25b82-e958-4b20-99ce-299c577d0562': { zone: 'Calacoto, La Paz', addr: 'Calle 8 de Calacoto 450' }, // Andrew Scott
  '32992e9b-47e5-4f94-89fd-b8f8f8911f44': { zone: 'Achumani, La Paz', addr: 'Calle 15 de Achumani 220' }, // Olivia Parker
  '378d5b68-c770-4d31-9fb9-1dbf580e89eb': { zone: 'Queru Queru, Cochabamba', addr: 'Av. Melchor Pérez de Olguín 860' }, // Thomas Reed
  '4a830f42-2acc-49f6-9b04-6d8233b82f28': { zone: 'Cala Cala, Cochabamba', addr: 'Av. America 1450' }, // Michael Foster
  '4ce33832-df14-49e2-aedf-94edc44dfd87': { zone: 'Montenegro, La Paz', addr: 'Av. Montenegro 1330' }, // Christopher Dean
  '4fdaeb5f-64cc-43fa-86c4-bc6fff703e9a': { zone: 'Aranjuez, Cochabamba', addr: 'Calle Aniceto Arce 512' }, // Anna Griffin
  '565b0060-3725-48fa-a367-bf26ef785618': { zone: 'Las Palmas, Santa Cruz de la Sierra', addr: 'Calle Los Tajibos 75' }, // Grace Hamilton
  '6c2a699e-848b-4674-a0e2-f37b71a9f18c': { zone: 'Las Palmas, Santa Cruz de la Sierra', addr: 'Av. San Martín 1180' }, // Laura Coleman
  '6dacb5eb-70db-4fe8-ac4a-658abebcdc73': { zone: 'Equipetrol, Santa Cruz de la Sierra', addr: 'Calle Ceibo 340' }, // Daniel Hunter
  '7cf56268-a5e5-44f2-84be-7a6bbdbe04df': { zone: 'Calacoto, La Paz', addr: 'Av. Ballivián 720' }, // David Palmer
  '88134e9b-49ce-4a1e-bb9d-76b684a72f34': { zone: 'Urbari, Santa Cruz de la Sierra', addr: 'Av. Roca y Coronado 90' }, // Megan Fletcher
  '99f9454e-1a94-423a-b1a5-b3cbaa4ae10d': { zone: 'Urbari, Santa Cruz de la Sierra', addr: 'Calle Beni 210' }, // Rachel Owens
  'a6a2c1b6-d1c7-4a5c-9adf-94236ad407e5': { zone: 'San Miguel, La Paz', addr: 'Calle Gabriel Rene Moreno 1200' }, // Hannah Blake
  'acb2a9f2-75a9-45b4-ab7d-bd2449e3a639': { zone: 'Cala Cala, Cochabamba', addr: 'Av. Simón López 640' }, // Robert Hayes
  'ada28ade-243f-43a8-9624-b18aed4ce702': { zone: 'San Miguel, La Paz', addr: 'Calle 17 de San Miguel 95' }, // James Warren
  'c7936f86-295e-4088-b3c0-8087fd974f0f': { zone: 'Sopocachi, La Paz', addr: 'Av. 6 de Agosto 2170' }, // John Mitchell
  'cf43e752-bb76-486f-9ede-301c813da5f6': { zone: 'La Recoleta, Cochabamba', addr: 'Calle Ecuador 330' }, // Emily Sanders
  'db789c47-9412-4e91-81a9-23c0c6122d95': { zone: 'Sopocachi, La Paz', addr: 'Av. Ecuador 1560' }, // William Brooks
  'ef325ae2-56c5-4e2b-82d8-8998ffa25b53': { zone: 'Equipetrol, Santa Cruz de la Sierra', addr: 'Calle Los Cusis 120' }, // Sarah Bennett
};

async function loadClients() {
  const res = await db.list({ include_docs: true, startkey: 'client:', endkey: 'client:�' });
  return res.rows.map((r) => r.doc);
}

async function main() {
  const clients = await loadClients();
  console.log(`Clientes encontrados: ${clients.length}`);

  const missingMap = clients.filter((c) => !CLIENT_ZONE[c._id.replace('client:', '')]);
  if (missingMap.length > 0) {
    console.error(
      'FALTA mapeo de zona en CLIENT_ZONE para:',
      missingMap.map((c) => `${c._id} (${c.first_name} ${c.paternal_surname})`)
    );
    process.exit(1);
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Se crearían/reutilizarían ${ZONES.length} zonas.`);
    console.log(`Se migrarían ${clients.length} cliente(s) a address.zone_id. Ejecuta con --apply.`);
    return;
  }

  /* ----- 1. Crear (o reutilizar) cada zona ------------------------------ */
  const existingZones = await zoneService.list();
  const idByName = new Map(existingZones.map((z) => [z.name, z._id]));
  let zonesCreated = 0;
  for (const z of ZONES) {
    if (idByName.has(z.name)) continue;
    const doc = await zoneService.create(z);
    idByName.set(z.name, doc._id);
    zonesCreated++;
  }
  console.log(`Zonas: ${zonesCreated} creada(s), ${idByName.size - zonesCreated} ya existían (total ${idByName.size}).`);

  /* ----- 2. Migrar cada cliente, con verificación estricta -------------- */
  let migrated = 0;
  let alreadyMigrated = 0;
  const mismatches = [];

  for (const c of clients) {
    const target = CLIENT_ZONE[c._id.replace('client:', '')];
    const zoneId = idByName.get(target.zone);
    if (!zoneId) throw new Error(`Zona "${target.zone}" no se pudo resolver (cliente ${c._id}).`);

    if (c.address?.zone_id === zoneId && c.address?.text === target.addr) {
      alreadyMigrated++;
      continue;
    }

    await clientRepo.update(c._id, (doc) => {
      doc.address = { text: target.addr, zone_id: zoneId };
      return doc;
    });

    // Verificación ESTRICTA: releer de CouchDB (no confiar en memoria).
    const fresh = await db.get(c._id);
    const problems = [];
    if (fresh.address?.zone_id !== zoneId) problems.push(`zone_id esperado ${zoneId}, quedó ${fresh.address?.zone_id}`);
    if (fresh.address?.text !== target.addr) problems.push(`address.text esperado "${target.addr}", quedó "${fresh.address?.text}"`);

    if (problems.length > 0) {
      mismatches.push({ id: c._id, name: `${c.first_name} ${c.paternal_surname}`, problems });
      continue;
    }
    migrated++;
  }

  console.log(`\nClientes migrados y verificados: ${migrated}`);
  console.log(`Clientes ya migrados de una corrida previa: ${alreadyMigrated}`);
  console.log(`Total cubierto: ${migrated + alreadyMigrated} / ${clients.length}`);

  if (mismatches.length > 0) {
    console.error(`\n¡ALERTA! ${mismatches.length} cliente(s) no verificaron tras la migración:`);
    console.error(JSON.stringify(mismatches, null, 2));
    process.exit(1);
  }

  console.log('\nMigración completa: los 20 clientes reales quedaron con zona asignada.');
}

main().catch((e) => {
  console.error('Fallo la migración:', e);
  process.exit(1);
});
