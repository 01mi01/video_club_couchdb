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
 *   1. Crea (si no existen ya, por `name`) una zona por cada barrio/ciudad
 *      real que YA aparece en las direcciones de los 20 clientes cargados
 *      (mapa ZONES abajo — nombre + lat/lng tomados de esos mismos
 *      clientes, así que la geolocalización real no cambia).
 *   2. Para cada cliente real (mapa CLIENT_ZONE, por `_id`), asigna
 *      `address.zone_id` con la zona correspondiente y elimina
 *      `address.geo` (reemplazado por la referencia).
 *
 * Uso:
 *   node scripts/migrate-client-zones.js             (DRY-RUN: solo reporta)
 *   node scripts/migrate-client-zones.js --apply      (crea zonas + migra clientes)
 *
 * IDEMPOTENTE: si un cliente ya tiene `zone_id` y no tiene `geo`, se
 * saltea. Las zonas se reutilizan por nombre si ya existen (no duplica).
 *
 * VERIFICACIÓN ESTRICTA POR CLIENTE: tras cada `update` se relee el
 * documento YA GUARDADO en CouchDB y se compara contra lo esperado
 * (`zone_id` correcto, `geo` ausente). Si algo no cuadra, se aborta con el
 * detalle del cliente afectado.
 * ============================================================================
 */

require('dotenv').config();
const { db } = require('../config/db');
const clientRepo = require('../repositories/clientRepository');
const zoneService = require('../services/zoneService');

const APPLY = process.argv.includes('--apply');

// Zonas reales: nombre "Barrio — Ciudad" + lat/lng, tomados TAL CUAL de las
// direcciones ya cargadas en scripts/seed-clients.js (no se inventa
// geolocalización nueva, se normaliza la que ya existía).
const ZONES = [
  { name: 'La Recoleta — Cochabamba', geo: { lat: -17.3838, lng: -66.1642 } },
  { name: 'La Recoleta — Sucre', geo: { lat: -19.0505, lng: -65.2585 } },
  { name: 'Centro — Cochabamba', geo: { lat: -17.3925, lng: -66.156 } },
  { name: 'Quillacollo — Cochabamba', geo: { lat: -17.393, lng: -66.2785 } },
  { name: 'Cala Cala — Cochabamba', geo: { lat: -17.3712, lng: -66.1548 } },
  { name: 'Miraflores — La Paz', geo: { lat: -16.4972, lng: -68.116 } },
  { name: 'Centro — Oruro', geo: { lat: -17.9662, lng: -67.1121 } },
  { name: 'Barrio Las Palmas — Santa Cruz de la Sierra', geo: { lat: -17.7725, lng: -63.178 } },
  { name: 'Casco Viejo — Santa Cruz de la Sierra', geo: { lat: -17.7845, lng: -63.181 } },
  { name: 'Montero — Santa Cruz', geo: { lat: -17.3399, lng: -63.2498 } },
  { name: 'Zona Sur — La Paz', geo: { lat: -16.5372, lng: -68.0798 } },
  { name: 'Urbari — Santa Cruz de la Sierra', geo: { lat: -17.799, lng: -63.193 } },
  { name: 'Centro — Trinidad', geo: { lat: -14.833, lng: -64.901 } },
  { name: 'San Miguel — La Paz', geo: { lat: -16.5407, lng: -68.082 } },
  { name: 'Centro — Tarija', geo: { lat: -21.534, lng: -64.731 } },
  { name: 'Ceja de El Alto — El Alto', geo: { lat: -16.5106, lng: -68.1636 } },
  { name: 'Sopocachi — La Paz', geo: { lat: -16.5108, lng: -68.1275 } },
  { name: 'Centro — Sucre', geo: { lat: -19.047, lng: -65.259 } },
  { name: 'Centro — Potosí', geo: { lat: -19.5845, lng: -65.754 } },
  { name: 'Equipetrol — Santa Cruz de la Sierra', geo: { lat: -17.7648, lng: -63.1955 } },
];

// Cliente (_id, SIN el prefijo "client:") -> nombre de zona. Resuelto a
// partir del barrio/ciudad que ya figura en `address.text` de cada uno.
const CLIENT_ZONE = {
  '0c490111-c135-4f06-b739-2bf9c47ca62d': 'La Recoleta — Cochabamba', // Jessica Turner
  '13e25b82-e958-4b20-99ce-299c577d0562': 'La Recoleta — Sucre', // Andrew Scott
  '32992e9b-47e5-4f94-89fd-b8f8f8911f44': 'Centro — Cochabamba', // Olivia Parker
  '378d5b68-c770-4d31-9fb9-1dbf580e89eb': 'Quillacollo — Cochabamba', // Thomas Reed
  '4a830f42-2acc-49f6-9b04-6d8233b82f28': 'Cala Cala — Cochabamba', // Michael Foster
  '4ce33832-df14-49e2-aedf-94edc44dfd87': 'Miraflores — La Paz', // Christopher Dean
  '4fdaeb5f-64cc-43fa-86c4-bc6fff703e9a': 'Centro — Oruro', // Anna Griffin
  '565b0060-3725-48fa-a367-bf26ef785618': 'Barrio Las Palmas — Santa Cruz de la Sierra', // Grace Hamilton
  '6c2a699e-848b-4674-a0e2-f37b71a9f18c': 'Casco Viejo — Santa Cruz de la Sierra', // Laura Coleman
  '6dacb5eb-70db-4fe8-ac4a-658abebcdc73': 'Montero — Santa Cruz', // Daniel Hunter
  '7cf56268-a5e5-44f2-84be-7a6bbdbe04df': 'Zona Sur — La Paz', // David Palmer
  '88134e9b-49ce-4a1e-bb9d-76b684a72f34': 'Urbari — Santa Cruz de la Sierra', // Megan Fletcher
  '99f9454e-1a94-423a-b1a5-b3cbaa4ae10d': 'Centro — Trinidad', // Rachel Owens
  'a6a2c1b6-d1c7-4a5c-9adf-94236ad407e5': 'San Miguel — La Paz', // Hannah Blake
  'acb2a9f2-75a9-45b4-ab7d-bd2449e3a639': 'Centro — Tarija', // Robert Hayes
  'ada28ade-243f-43a8-9624-b18aed4ce702': 'Ceja de El Alto — El Alto', // James Warren
  'c7936f86-295e-4088-b3c0-8087fd974f0f': 'Sopocachi — La Paz', // John Mitchell
  'cf43e752-bb76-486f-9ede-301c813da5f6': 'Centro — Sucre', // Emily Sanders
  'db789c47-9412-4e91-81a9-23c0c6122d95': 'Centro — Potosí', // William Brooks
  'ef325ae2-56c5-4e2b-82d8-8998ffa25b53': 'Equipetrol — Santa Cruz de la Sierra', // Sarah Bennett
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
    const zoneName = CLIENT_ZONE[c._id.replace('client:', '')];
    const zoneId = idByName.get(zoneName);
    if (!zoneId) throw new Error(`Zona "${zoneName}" no se pudo resolver (cliente ${c._id}).`);

    const hasGeo = Object.prototype.hasOwnProperty.call(c.address || {}, 'geo');
    if (!hasGeo && c.address?.zone_id === zoneId) {
      alreadyMigrated++;
      continue;
    }

    await clientRepo.update(c._id, (doc) => {
      doc.address = { text: doc.address?.text || '', zone_id: zoneId };
      return doc;
    });

    // Verificación ESTRICTA: releer de CouchDB (no confiar en memoria).
    const fresh = await db.get(c._id);
    const problems = [];
    if (fresh.address?.zone_id !== zoneId) problems.push(`zone_id esperado ${zoneId}, quedó ${fresh.address?.zone_id}`);
    if (Object.prototype.hasOwnProperty.call(fresh.address || {}, 'geo')) problems.push('address.geo todavía presente');
    if (!fresh.address?.text) problems.push('address.text se perdió');

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

  console.log('\nMigración completa: los 20 clientes reales quedaron con zona asignada y sin geo suelto.');
}

main().catch((e) => {
  console.error('Fallo la migración:', e);
  process.exit(1);
});
