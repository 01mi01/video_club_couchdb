/**
 * ============================================================================
 * scripts/seed-clients.js  —  CARGA DE CLIENTES REALES (ejecución manual)
 * ============================================================================
 *
 * Autorizado por CLAUDE.md, seccion "Contenido de datos - peliculas y
 * clientes" + regla de trabajo 2. NO son datos de prueba descartables.
 *
 *     node scripts/seed-clients.js
 *
 * QUE HACE
 *   - Crea 20 clientes con `clientService.create(...)`, el mismo camino de
 *     validacion/normalizacion que usa POST /api/clients (el servidor HTTP
 *     no se levanta; regla de trabajo 1).
 *   - Idempotente: si ya existe un cliente con el mismo email, lo salta.
 *
 * CRITERIOS APLICADOS (instrucciones del propietario)
 *   - Nombres SIEMPRE anglosajones/EE.UU. (nombre + apellido paterno +
 *     apellido materno). Nunca nombres latinoamericanos.
 *   - Telefono celular: formato boliviano real, 8 digitos, empieza en 6 o
 *     7, sin codigo de pais.
 *   - Direccion: ubicaciones reales de ciudades bolivianas, variadas
 *     (La Paz, Santa Cruz, Cochabamba, Sucre, Oruro, Potosi, Tarija,
 *     Trinidad, El Alto, Montero, Quillacollo).
 *   - Geolocalizacion: lat/lng reales del barrio/ciudad correspondiente
 *     (no aleatorias).
 *   - Email con formato realista basado en el nombre.
 *   - Fecha de nacimiento: edades entre 20 y 55 (referencia: ano 2026).
 *   - registered_at: fechas repartidas dentro del ultimo ano
 *     (2025-09 .. 2026-09).
 *   - Ninguno bloqueado (clientService.create ya fija blocked.is_blocked
 *     = false; no se toca).
 * ============================================================================
 */

require('dotenv').config();

const clientRepo = require('../repositories/clientRepository');
const clientService = require('../services/clientService');

const CLIENTS = [
  {
    first_name: 'John', paternal_surname: 'Mitchell', maternal_surname: 'Carter',
    phone_mobile: '71234501', email: 'john.carter@gmail.com', birth_date: '1985-03-14',
    address: { text: 'Av. 6 de Agosto 2170, Sopocachi, La Paz', geo: { lat: -16.5108, lng: -68.1275 } },
    registered_at: '2025-10-02T14:20:00.000Z', city: 'La Paz',
  },
  {
    first_name: 'Sarah', paternal_surname: 'Bennett', maternal_surname: 'Cole',
    phone_mobile: '70045512', email: 'sarah.bennett@outlook.com', birth_date: '1990-07-22',
    address: { text: 'Calle Los Cusis 120, Equipetrol, Santa Cruz de la Sierra', geo: { lat: -17.7648, lng: -63.1955 } },
    registered_at: '2025-11-18T17:05:00.000Z', city: 'Santa Cruz de la Sierra',
  },
  {
    first_name: 'Michael', paternal_surname: 'Foster', maternal_surname: 'Hayes',
    phone_mobile: '68812345', email: 'michael.hayes@gmail.com', birth_date: '1978-11-05',
    address: { text: 'Av. America 1450, Cala Cala, Cochabamba', geo: { lat: -17.3712, lng: -66.1548 } },
    registered_at: '2026-01-09T12:40:00.000Z', city: 'Cochabamba',
  },
  {
    first_name: 'Emily', paternal_surname: 'Sanders', maternal_surname: 'Brooks',
    phone_mobile: '72659008', email: 'emily.brooks@yahoo.com', birth_date: '1995-02-17',
    address: { text: 'Calle Nicolas Ortiz 45, Centro, Sucre', geo: { lat: -19.0470, lng: -65.2590 } },
    registered_at: '2026-02-21T09:15:00.000Z', city: 'Sucre',
  },
  {
    first_name: 'David', paternal_surname: 'Palmer', maternal_surname: 'Reed',
    phone_mobile: '70611223', email: 'david.reed@gmail.com', birth_date: '1972-09-30',
    address: { text: 'Calle 21 de Calacoto 8300, Zona Sur, La Paz', geo: { lat: -16.5372, lng: -68.0798 } },
    registered_at: '2025-09-27T16:30:00.000Z', city: 'La Paz',
  },
  {
    first_name: 'Laura', paternal_surname: 'Coleman', maternal_surname: 'Fisher',
    phone_mobile: '71778890', email: 'laura.fisher@hotmail.com', birth_date: '1988-06-11',
    address: { text: 'Calle Sucre 240, Casco Viejo, Santa Cruz de la Sierra', geo: { lat: -17.7845, lng: -63.1810 } },
    registered_at: '2025-12-14T11:00:00.000Z', city: 'Santa Cruz de la Sierra',
  },
  {
    first_name: 'James', paternal_surname: 'Warren', maternal_surname: 'Hughes',
    phone_mobile: '68490077', email: 'james.hughes@gmail.com', birth_date: '1993-04-03',
    address: { text: 'Av. Alfonso Ugarte 55, Ceja de El Alto, El Alto', geo: { lat: -16.5106, lng: -68.1636 } },
    registered_at: '2026-03-05T13:45:00.000Z', city: 'El Alto',
  },
  {
    first_name: 'Anna', paternal_surname: 'Griffin', maternal_surname: 'Wells',
    phone_mobile: '72033445', email: 'anna.wells@outlook.com', birth_date: '1983-08-25',
    address: { text: 'Calle Bolivar 620, Centro, Oruro', geo: { lat: -17.9662, lng: -67.1121 } },
    registered_at: '2026-04-12T15:10:00.000Z', city: 'Oruro',
  },
  {
    first_name: 'Robert', paternal_surname: 'Hayes', maternal_surname: 'Morgan',
    phone_mobile: '70877665', email: 'robert.morgan@gmail.com', birth_date: '1975-12-19',
    address: { text: 'Calle General Trigo 380, Centro, Tarija', geo: { lat: -21.5340, lng: -64.7310 } },
    registered_at: '2025-10-30T10:25:00.000Z', city: 'Tarija',
  },
  {
    first_name: 'Jessica', paternal_surname: 'Turner', maternal_surname: 'Bailey',
    phone_mobile: '76644321', email: 'jessica.bailey@gmail.com', birth_date: '2000-05-08',
    address: { text: 'Av. Pando 780, La Recoleta, Cochabamba', geo: { lat: -17.3838, lng: -66.1642 } },
    registered_at: '2026-05-19T18:00:00.000Z', city: 'Cochabamba',
  },
  {
    first_name: 'William', paternal_surname: 'Brooks', maternal_surname: 'Ellis',
    phone_mobile: '71290654', email: 'william.ellis@yahoo.com', birth_date: '1971-01-27',
    address: { text: 'Calle Quijarro 145, Centro, Potosi', geo: { lat: -19.5845, lng: -65.7540 } },
    registered_at: '2025-11-02T08:50:00.000Z', city: 'Potosi',
  },
  {
    first_name: 'Megan', paternal_surname: 'Fletcher', maternal_surname: 'Gray',
    phone_mobile: '70255678', email: 'megan.gray@hotmail.com', birth_date: '1997-10-14',
    address: { text: 'Av. Roca y Coronado 90, Urbari, Santa Cruz de la Sierra', geo: { lat: -17.7990, lng: -63.1930 } },
    registered_at: '2026-06-08T14:35:00.000Z', city: 'Santa Cruz de la Sierra',
  },
  {
    first_name: 'Christopher', paternal_surname: 'Dean', maternal_surname: 'Lawson',
    phone_mobile: '68701199', email: 'chris.lawson@gmail.com', birth_date: '1981-03-22',
    address: { text: 'Av. Busch 1120, Miraflores, La Paz', geo: { lat: -16.4972, lng: -68.1160 } },
    registered_at: '2025-09-15T09:40:00.000Z', city: 'La Paz',
  },
  {
    first_name: 'Rachel', paternal_surname: 'Owens', maternal_surname: 'Barrett',
    phone_mobile: '72811223', email: 'rachel.barrett@outlook.com', birth_date: '1992-12-02',
    address: { text: 'Calle La Paz 210, Centro, Trinidad', geo: { lat: -14.8330, lng: -64.9010 } },
    registered_at: '2026-07-01T16:15:00.000Z', city: 'Trinidad',
  },
  {
    first_name: 'Daniel', paternal_surname: 'Hunter', maternal_surname: 'Freeman',
    phone_mobile: '70933441', email: 'daniel.freeman@gmail.com', birth_date: '1986-07-19',
    address: { text: 'Av. Circunvalacion 340, Montero, Santa Cruz', geo: { lat: -17.3399, lng: -63.2498 } },
    registered_at: '2025-12-28T12:05:00.000Z', city: 'Montero',
  },
  {
    first_name: 'Olivia', paternal_surname: 'Parker', maternal_surname: 'Nolan',
    phone_mobile: '76120987', email: 'olivia.nolan@gmail.com', birth_date: '2004-02-29',
    address: { text: 'Calle Espana 415, Centro, Cochabamba', geo: { lat: -17.3925, lng: -66.1560 } },
    registered_at: '2026-08-11T10:50:00.000Z', city: 'Cochabamba',
  },
  {
    first_name: 'Andrew', paternal_surname: 'Scott', maternal_surname: 'Middleton',
    phone_mobile: '71455662', email: 'andrew.middleton@yahoo.com', birth_date: '1974-06-07',
    address: { text: 'Calle Dalence 60, La Recoleta, Sucre', geo: { lat: -19.0505, lng: -65.2585 } },
    registered_at: '2025-10-19T15:55:00.000Z', city: 'Sucre',
  },
  {
    first_name: 'Hannah', paternal_surname: 'Blake', maternal_surname: 'Sullivan',
    phone_mobile: '70588773', email: 'hannah.sullivan@gmail.com', birth_date: '1999-09-09',
    address: { text: 'Calle Gabriel Rene Moreno 1200, San Miguel, La Paz', geo: { lat: -16.5407, lng: -68.0820 } },
    registered_at: '2026-01-25T11:20:00.000Z', city: 'La Paz',
  },
  {
    first_name: 'Thomas', paternal_surname: 'Reed', maternal_surname: 'Chambers',
    phone_mobile: '68344210', email: 'thomas.chambers@hotmail.com', birth_date: '1980-11-28',
    address: { text: 'Av. Martin Cardenas 220, Quillacollo, Cochabamba', geo: { lat: -17.3930, lng: -66.2785 } },
    registered_at: '2025-11-23T13:30:00.000Z', city: 'Quillacollo',
  },
  {
    first_name: 'Grace', paternal_surname: 'Hamilton', maternal_surname: 'Porter',
    phone_mobile: '72977001', email: 'grace.porter@gmail.com', birth_date: '1996-04-16',
    address: { text: 'Calle Los Tajibos 75, Barrio Las Palmas, Santa Cruz de la Sierra', geo: { lat: -17.7725, lng: -63.1780 } },
    registered_at: '2026-02-08T17:45:00.000Z', city: 'Santa Cruz de la Sierra',
  },
];

async function main() {
  console.log('============================================================');
  console.log(' CARGA DE CLIENTES REALES');
  console.log(` Base: ${process.env.COUCHDB_DB}  |  a crear: ${CLIENTS.length}`);
  console.log('============================================================');

  const existentes = await clientRepo.list();
  const emailsExistentes = new Set(existentes.map((c) => (c.email || '').toLowerCase()));

  const creados = [];
  let saltados = 0;

  for (const c of CLIENTS) {
    if (emailsExistentes.has(c.email.toLowerCase())) {
      console.log(`  [salta]  ${c.first_name} ${c.paternal_surname} <${c.email}> ya existe`);
      saltados++;
      continue;
    }
    try {
      const created = await clientService.create({
        first_name: c.first_name,
        paternal_surname: c.paternal_surname,
        maternal_surname: c.maternal_surname,
        phone_mobile: c.phone_mobile,
        email: c.email,
        birth_date: c.birth_date,
        address: c.address,
        registered_at: c.registered_at,
      });
      creados.push({ id: created._id, c });
      console.log(
        `  [crea]   ${c.first_name} ${c.paternal_surname} ${c.maternal_surname}  ->  ${created._id}` +
          `  | ${c.city} | blocked=${created.blocked.is_blocked}`
      );
    } catch (err) {
      console.error(`  [ERROR]  ${c.first_name} ${c.paternal_surname}: ${err.message}`);
    }
  }

  // Verificacion: ninguno bloqueado.
  const todos = await clientRepo.list();
  const bloqueados = todos.filter((c) => c.blocked && c.blocked.is_blocked);

  console.log('\n============================================================');
  console.log(` Creados ahora: ${creados.length}  |  Ya existian (saltados): ${saltados}`);
  console.log(` Total de clientes en la base: ${todos.length}`);
  console.log(
    bloqueados.length === 0
      ? ' Ningun cliente esta bloqueado. OK'
      : ` ATENCION: ${bloqueados.length} cliente(s) bloqueado(s).`
  );
  console.log('============================================================');

  process.exit(bloqueados.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Fallo en la carga de clientes:', err);
  process.exit(1);
});
