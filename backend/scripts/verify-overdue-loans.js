/**
 * ============================================================================
 * scripts/verify-overdue-loans.js  —  PRÉSTAMOS VENCIDOS (sanity check)
 * ============================================================================
 *
 *     node scripts/verify-overdue-loans.js
 *
 * Verifica el comportamiento esperado para préstamos vencidos:
 *
 *   1. NO hay ningún proceso automático: un préstamo con `due_date` en el
 *      pasado sigue "active" y su copia sigue "loaned" indefinidamente.
 *   2. Salida manual (a): devolución TARDÍA -> `returnLoan` cierra el
 *      préstamo, marca `returned_late`, y la factura deja constancia del
 *      atraso. La copia vuelve a "available".
 *   3. Salida manual (b): BAJA POR NO DEVOLUCIÓN -> el endpoint de baja de
 *      copias con razón "no devuelto" (o `POST /api/loans/:id/write-off`)
 *      deja la copia "retired" y cierra el préstamo como "unreturned".
 *   4. Protección: una copia PRESTADA no se puede dar de baja por "robo"
 *      (hay que devolverla primero).
 *
 * DATOS: 100% descartables, creados y borrados por el propio script
 * (género/película/cliente marcados `TEST_DELETE_ME_...`). Limpieza total
 * en `finally`, aunque una aserción falle.
 * ============================================================================
 */

require('dotenv').config();

const { db } = require('../config/db');
const genreRepo = require('../repositories/genreRepository');
const videoRepo = require('../repositories/videoRepository');
const clientRepo = require('../repositories/clientRepository');
const videoService = require('../services/videoService');
const clientService = require('../services/clientService');
const loanService = require('../services/loanService');

const RUN = `TEST_DELETE_ME_${Date.now()}`;
const DAY = 86400000;

const results = [];
function record(n, titulo, ok, detalle) {
  results.push({ n, titulo, ok, detalle });
  console.log(`\n[${ok ? 'OK' : 'FALLA'}] ${n}. ${titulo}`);
  if (detalle) console.log(detalle.split('\n').map((l) => '    ' + l).join('\n'));
}
function assert(c, m) { if (!c) throw new Error(m); }
async function rawGet(id) { try { return await db.get(id); } catch (e) { if (e.statusCode === 404) return null; throw e; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const created = { genres: [], videos: [], clients: [], loans: [], invoices: [] };

async function main() {
  console.log('============================================================');
  console.log(' VERIFICACIÓN: préstamos vencidos y salidas manuales');
  console.log('============================================================');

  // ---- Montaje de datos descartables --------------------------------------
  const genre = await genreRepo.create({ name: `${RUN}_g`, description: 'descartable' });
  created.genres.push(genre._id);

  const video = await videoService.create({
    display_title: `${RUN} Overdue Film`,
    duration_minutes: 100,
    genre_ids: [genre._id],
    release_year: 2020,
    main_actors: [`${RUN} Actor`],
    unit_cost: 10,
    units_acquired: 4, // c1..c4
  });
  created.videos.push(video._id);

  const client = await clientService.create({
    first_name: `${RUN}`,
    paternal_surname: 'Vencido',
    phone_mobile: '70000000',
    email: `${RUN.toLowerCase()}@example.com`,
    birth_date: '1990-01-01',
    address: { text: 'Calle Descartable 1', zone_id: null },
  });
  created.clients.push(client._id);

  /** Crea un préstamo YA VENCIDO sobre una copia concreta (loan_date atrás). */
  async function crearPrestamoVencido(copyId, diasAtras = 10, dias = 2) {
    const loanDate = new Date(Date.now() - diasAtras * DAY).toISOString();
    const res = await loanService.createLoan({
      client_id: client._id,
      items: [{ video_id: video._id, copy_id: copyId }],
      loan_date: loanDate,
      days: dias,
    });
    created.loans.push(res.loan._id);
    created.invoices.push(res.invoice._id);
    return res;
  }

  /* =====================================================================
   * 1) SIN PROCESO AUTOMÁTICO
   * ==================================================================== */
  try {
    const { loan } = await crearPrestamoVencido('c1', 10, 2);
    const venceEn = new Date(loan.due_date).getTime();
    assert(venceEn < Date.now(), 'el préstamo de prueba no quedó vencido (due_date en el futuro)');
    assert(loan.status === 'active', `status inicial "${loan.status}", esperado "active"`);

    let v = await rawGet(video._id);
    assert(v.copies.find((c) => c.copy_id === 'c1').status === 'loaned', 'la copia c1 no quedó "loaned"');

    // Esperar y volver a leer: nada debe haber cambiado (no hay cron/scheduler).
    await sleep(1500);
    const loanDespues = await rawGet(loan._id);
    v = await rawGet(video._id);
    assert(loanDespues.status === 'active', `tras esperar, el préstamo pasó a "${loanDespues.status}" solo`);
    assert(loanDespues.return_date === null, 'apareció un return_date sin que nadie devolviera');
    assert(
      v.copies.find((c) => c.copy_id === 'c1').status === 'loaned',
      'tras esperar, la copia c1 cambió de estado sola'
    );

    record(1, 'Préstamo vencido: sin proceso automático', true,
      `due_date ${loan.due_date} (hace ${Math.round((Date.now() - venceEn) / DAY)} días).\n` +
        `status = "active" y copia c1 = "loaned" antes y después de esperar 1.5 s.\n` +
        `(No hay cron/scheduler/setInterval en el código: verificado por grep.)`);
  } catch (e) {
    record(1, 'Préstamo vencido: sin proceso automático', false, `PROBLEMA: ${e.message}`);
  }

  /* =====================================================================
   * 2) SALIDA (a): DEVOLUCIÓN TARDÍA
   * ==================================================================== */
  try {
    const { loan } = await crearPrestamoVencido('c2', 12, 2);
    const ret = await loanService.returnLoan(loan._id, {}); // return_date = ahora

    const loanDb = await rawGet(loan._id);
    assert(loanDb.status === 'returned', `status "${loanDb.status}", esperado "returned"`);
    assert(loanDb.returned_late === true, 'no se marcó `returned_late = true`');
    assert(loanDb.actual_days > loanDb.days, `actual_days (${loanDb.actual_days}) no es mayor que days (${loanDb.days})`);

    const facturaDb = await rawGet(loan.invoice_id);
    assert(facturaDb && /tard[ií]a|atraso/i.test(facturaDb.note || ''),
      `la factura no refleja el atraso (note: "${facturaDb && facturaDb.note}")`);

    const v = await rawGet(video._id);
    assert(v.copies.find((c) => c.copy_id === 'c2').status === 'available',
      'la copia c2 no volvió a "available" tras la devolución tardía');

    record(2, 'Salida manual (a): devolución tardía', true,
      `Préstamo pactado ${loanDb.days} días, devuelto a los ${loanDb.actual_days} días -> returned_late = true.\n` +
        `Factura nota: "${facturaDb.note}"\n` +
        `Total recalculado: ${ret.invoice.total} Bs. Copia c2 -> "available".`);
  } catch (e) {
    record(2, 'Salida manual (a): devolución tardía', false, `PROBLEMA: ${e.message}`);
  }

  /* =====================================================================
   * 3) SALIDA (b): BAJA POR NO DEVOLUCIÓN
   * ==================================================================== */
  // 3.1 vía endpoint de BAJA DE COPIAS (videoService.retireCopy, razón "no devuelto")
  try {
    const { loan } = await crearPrestamoVencido('c3', 20, 3);
    const antesCopia = (await rawGet(video._id)).copies.find((c) => c.copy_id === 'c3').status;
    assert(antesCopia === 'loaned', 'precondición: c3 debería estar "loaned"');

    const out = await videoService.retireCopy(video._id, 'c3', { reason: 'no devuelto' });

    const v = await rawGet(video._id);
    const c3 = v.copies.find((c) => c.copy_id === 'c3');
    assert(c3.status === 'retired', `c3 quedó "${c3.status}", esperado "retired"`);
    assert(c3.retirement && /no devuelto/i.test(c3.retirement.reason), 'no se registró la razón "no devuelto"');
    assert(c3.retirement.date, 'no se registró la fecha de baja');

    const loanDb = await rawGet(loan._id);
    assert(loanDb.status === 'unreturned', `el préstamo quedó "${loanDb.status}", esperado "unreturned"`);
    assert(loanDb.return_date === null, 'un préstamo no devuelto NO debería tener return_date');
    assert(loanDb.closed_at, 'no se registró closed_at');

    const facturaDb = await rawGet(loan.invoice_id);
    assert(facturaDb && /no devoluci[oó]n/i.test(facturaDb.note || ''),
      `la factura no refleja la no devolución (note: "${facturaDb && facturaDb.note}")`);

    record(3, 'Salida manual (b): baja por "no devuelto" vía endpoint de baja de copias', true,
      `retireCopy(c3, "no devuelto") -> copia "retired" (razón "${c3.retirement.reason}", ${c3.retirement.date}).\n` +
        `Préstamo asociado cerrado como "unreturned" (return_date = null, closed_at = ${loanDb.closed_at}).\n` +
        `Factura nota: "${facturaDb.note}"  (importe pactado ${facturaDb.total} Bs se mantiene).`);
  } catch (e) {
    record(3, 'Salida manual (b): baja por "no devuelto" vía endpoint de baja de copias', false, `PROBLEMA: ${e.message}`);
  }

  // 3.2 vía endpoint DIRECTO del préstamo (loanService.writeOffUnreturned)
  try {
    const { loan } = await crearPrestamoVencido('c4', 15, 1);
    const w = await loanService.writeOffUnreturned(loan._id, { reason: 'no devuelto' });

    const v = await rawGet(video._id);
    const c4 = v.copies.find((c) => c.copy_id === 'c4');
    assert(c4.status === 'retired', `c4 quedó "${c4.status}", esperado "retired"`);
    const loanDb = await rawGet(loan._id);
    assert(loanDb.status === 'unreturned', `el préstamo quedó "${loanDb.status}", esperado "unreturned"`);
    assert(Array.isArray(w.retired_copies) && w.retired_copies.some((c) => c.copy_id === 'c4'),
      'la respuesta no lista c4 entre las copias dadas de baja');

    record(4, 'Salida manual (b) vía POST /api/loans/:id/write-off', true,
      `writeOffUnreturned -> c4 "retired", préstamo "unreturned". Copias dadas de baja: ` +
        `${w.retired_copies.map((c) => c.copy_id).join(', ')}.`);
  } catch (e) {
    record(4, 'Salida manual (b) vía POST /api/loans/:id/write-off', false, `PROBLEMA: ${e.message}`);
  }

  /* =====================================================================
   * 5) PROTECCIÓN: "robo" sobre copia prestada -> rechazado
   * ==================================================================== */
  try {
    // c1 sigue prestada (del test 1). Intentar baja por "robo" debe fallar.
    let rechazado = false;
    let msg = '';
    try {
      await videoService.retireCopy(video._id, 'c1', { reason: 'robo' });
    } catch (err) {
      rechazado = true;
      msg = err.message;
    }
    assert(rechazado, 'PROBLEMA: se permitió dar de baja por "robo" una copia que está prestada');
    assert(/prestada|devoluci[oó]n/i.test(msg), `mensaje de rechazo inesperado: "${msg}"`);

    const c1 = (await rawGet(video._id)).copies.find((c) => c.copy_id === 'c1');
    assert(c1.status === 'loaned', 'la copia c1 cambió de estado pese al rechazo');

    record(5, 'Protección: "robo" sobre copia prestada se rechaza', true,
      `retireCopy(c1, "robo") con c1 prestada -> RECHAZADO: "${msg}"\n` +
        `c1 sigue "loaned". (Para "robo" hay que registrar antes la devolución.)`);
  } catch (e) {
    record(5, 'Protección: "robo" sobre copia prestada se rechaza', false, `PROBLEMA: ${e.message}`);
  }

  await limpiar();

  console.log('\n============================================================');
  console.log(' RESUMEN');
  console.log('============================================================');
  for (const r of results) console.log(`  ${r.ok ? 'OK   ' : 'FALLA'}  ${r.n}. ${r.titulo}`);
  const fallas = results.filter((r) => !r.ok);
  console.log('------------------------------------------------------------');
  console.log(`  ${results.length - fallas.length}/${results.length} OK` + (fallas.length ? `  |  ${fallas.length} FALLA(S)` : ''));
  console.log('============================================================');
  process.exit(fallas.length ? 1 : 0);
}

async function limpiar() {
  console.log('\n── LIMPIEZA (todo descartable) ─────────────────────────');
  let n = 0;
  const grupos = [
    ['invoice', created.invoices],
    ['loan', created.loans],
    ['video', created.videos],
    ['client', created.clients],
    ['genre', created.genres],
  ];
  for (const [label, ids] of grupos) {
    for (const id of [...new Set(ids)]) {
      try {
        const d = await rawGet(id);
        if (d) { await db.destroy(d._id, d._rev); n++; }
      } catch (e) {
        console.log(`  [AVISO] no se pudo borrar ${label} ${id}: ${e.message}`);
      }
    }
  }
  // Barrido por marca.
  try {
    const all = await db.list({ include_docs: true });
    for (const row of all.rows) {
      const d = row.doc;
      if (d && [d.name, d.display_title, d.first_name].some((x) => typeof x === 'string' && x.includes(RUN))) {
        await db.destroy(d._id, d._rev); n++;
        console.log(`  barrido: ${d._id}`);
      }
    }
  } catch (e) {
    console.log(`  [AVISO] barrido incompleto: ${e.message}`);
  }
  console.log(`  ${n} documento(s) descartable(s) eliminado(s). Datos reales intactos.`);
}

main().catch(async (err) => {
  console.error('\n[ERROR NO CONTROLADO]', err);
  try { await limpiar(); } catch (e) { console.error('limpieza:', e.message); }
  process.exit(1);
});
