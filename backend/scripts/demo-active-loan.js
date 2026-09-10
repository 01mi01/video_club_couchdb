/**
 * ============================================================================
 * scripts/demo-active-loan.js  —  SANITY CHECK + dato de demostración
 * ============================================================================
 *
 *     node scripts/demo-active-loan.js
 *
 * Crea UN préstamo real (cliente real + película real, NO datos de prueba)
 * y lo DEJA ACTIVO como dato de demostración para el frontend.
 *
 * Verifica el flujo completo:
 *   1. Cotización (/api/loans/quote) con montos correctos.
 *   2. Creación (/api/loans) vía _bulk_docs.
 *   3. La copia asignada queda en "loaned".
 *   4. Se emite la factura con número correlativo y total coherente.
 *
 * NO devuelve el préstamo. NO toca los préstamos/facturas de pruebas
 * anteriores.
 * ============================================================================
 */

require('dotenv').config();

const { db } = require('../config/db');
const clientRepo = require('../repositories/clientRepository');
const videoRepo = require('../repositories/videoRepository');
const loanService = require('../services/loanService');

const CLIENTE_EMAIL = 'sarah.bennett@outlook.com'; // Sarah Bennett Cole
const PELICULA = 'Parasite'; // 5 copias, sobra disponibilidad
const DIAS = 3;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function rawGet(id) { try { return await db.get(id); } catch (e) { if (e.statusCode === 404) return null; throw e; } }

async function main() {
  console.log('============================================================');
  console.log(' SANITY CHECK: préstamo real de demostración (queda ACTIVO)');
  console.log('============================================================');

  const clientes = await clientRepo.list();
  const cliente = clientes.find((c) => (c.email || '').toLowerCase() === CLIENTE_EMAIL);
  assert(cliente, `no se encontró el cliente real ${CLIENTE_EMAIL}`);
  assert(!cliente.blocked.is_blocked, 'el cliente elegido está bloqueado');

  const videos = await videoRepo.list();
  const peli = videos.find((v) => v.display_title === PELICULA);
  assert(peli, `no se encontró la película real "${PELICULA}"`);

  const dispAntes = peli.copies.filter((c) => c.status === 'available');
  assert(dispAntes.length >= 1, `"${PELICULA}" no tiene copias disponibles`);

  console.log(`\nCliente : ${cliente.first_name} ${cliente.paternal_surname} ${cliente.maternal_surname || ''}  (${cliente._id})`);
  console.log(`Película: ${peli.display_title} (${peli.release_year})  (${peli._id})`);
  console.log(`Copias disponibles antes: ${dispAntes.length} / ${peli.copies.length}`);
  console.log(`Plazo   : ${DIAS} días`);

  // ---- 1) COTIZACIÓN ----
  const q = await loanService.quoteLoan({
    client_id: cliente._id,
    items: [{ video_id: peli._id }],
    days: DIAS,
  });
  // Config por defecto: 3 días => 4 Bs/película ; 1 película => sin descuento.
  assert(q.pricing.price_per_movie === 4, `precio/película esperado 4, obtenido ${q.pricing.price_per_movie}`);
  assert(q.pricing.discount_percent === 0, `descuento esperado 0%, obtenido ${q.pricing.discount_percent}%`);
  assert(q.pricing.total_amount === 4, `total esperado 4 Bs, obtenido ${q.pricing.total_amount}`);
  console.log('\n1) COTIZACIÓN OK');
  console.log(`   base ${q.pricing.base_amount} Bs, descuento ${q.pricing.discount_percent}%, TOTAL ${q.pricing.total_amount} Bs, vence ${q.due_date}`);

  // ---- 2) CREACIÓN ----
  const res = await loanService.createLoan({
    client_id: cliente._id,
    items: [{ video_id: peli._id }],
    days: DIAS,
  });
  console.log('\n2) CREACIÓN OK');
  console.log(`   préstamo ${res.loan._id}  status=${res.loan.status}`);
  console.log(`   factura  ${res.invoice._id}  Nº ${res.invoice.number}`);

  assert(res.loan.status === 'active', `el préstamo quedó en "${res.loan.status}", esperado "active"`);
  assert(res.loan.pricing.total_amount === 4, `total del préstamo persistido ${res.loan.pricing.total_amount} != 4`);
  assert(res.loan.items.length === 1, 'el préstamo no registró exactamente 1 item');

  const copyId = res.loan.items[0].copy_id;

  // ---- 3) COPIA EN "loaned" ----
  const peliDespues = await rawGet(peli._id);
  const copia = peliDespues.copies.find((c) => c.copy_id === copyId);
  assert(copia && copia.status === 'loaned', `la copia ${copyId} quedó "${copia && copia.status}", esperado "loaned"`);
  const dispDespues = peliDespues.copies.filter((c) => c.status === 'available');
  assert(dispDespues.length === dispAntes.length - 1, 'el nº de copias disponibles no bajó en 1');
  console.log('\n3) COPIA MARCADA OK');
  console.log(`   copia ${copyId} -> "loaned"   |   disponibles: ${dispAntes.length} -> ${dispDespues.length}`);

  // ---- 4) FACTURA ----
  const facturaDb = await rawGet(res.invoice._id);
  assert(facturaDb, 'la factura no se persistió');
  assert(facturaDb.loan_id === res.loan._id, 'la factura no apunta al préstamo');
  assert(facturaDb.client_id === cliente._id, 'la factura no apunta al cliente');
  assert(facturaDb.total === 4, `total de la factura ${facturaDb.total} != 4`);
  assert(Array.isArray(facturaDb.lines) && facturaDb.lines.length >= 1, 'la factura no tiene líneas');
  assert(typeof facturaDb.number === 'number' && facturaDb.number > 0, 'la factura no tiene número correlativo');
  console.log('\n4) FACTURA OK');
  console.log(`   Nº ${facturaDb.number}  total ${facturaDb.total} Bs  moneda ${facturaDb.currency}  líneas: ${facturaDb.lines.length}`);
  facturaDb.lines.forEach((l) => console.log(`     - ${l.description}: ${l.amount} Bs`));

  // ---- Confirmación de que el préstamo QUEDA ACTIVO ----
  const loanFinal = await rawGet(res.loan._id);
  assert(loanFinal.status === 'active' && loanFinal.return_date === null,
    'el préstamo NO quedó activo como se pedía');

  console.log('\n============================================================');
  console.log(' PRÉSTAMO ACTIVO DE DEMOSTRACIÓN (no se devuelve):');
  console.log(`   loan     : ${res.loan._id}`);
  console.log(`   invoice  : ${res.invoice._id} (Nº ${facturaDb.number})`);
  console.log(`   cliente  : ${cliente.first_name} ${cliente.paternal_surname} <${cliente.email}>`);
  console.log(`   película : ${peli.display_title}  copia ${copyId}`);
  console.log(`   plazo    : ${DIAS} días  |  vence: ${loanFinal.due_date}`);
  console.log(`   total    : ${loanFinal.pricing.total_amount} Bs`);
  console.log(' Todas las comprobaciones OK.');
  console.log('============================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fallo en el sanity check:', err);
  process.exit(1);
});
