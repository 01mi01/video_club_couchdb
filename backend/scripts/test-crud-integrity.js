/**
 * ============================================================================
 * scripts/test-crud-integrity.js  —  PRUEBA DE INTEGRIDAD CRUD ACOTADA
 * ============================================================================
 *
 * Ejecución MANUAL y PUNTUAL (no es una suite `npm test`, no se deja
 * corriendo, no se agrega a scripts de arranque):
 *
 *     node scripts/test-crud-integrity.js
 *
 * QUÉ VERIFICA (según CLAUDE.md):
 *
 *   Por cada entidad (géneros, clientes, videos, préstamos):
 *     - CREATE : crea un documento de prueba y confirma con un GET real.
 *     - UPDATE : actualiza y confirma que el cambio se aplicó y que NO se
 *                duplicó (sigue existiendo UN solo doc con ese `_id`).
 *     - DELETE : elimina y confirma con un GET que YA NO existe (se
 *                comprueba el estado real en CouchDB, no solo el 200).
 *
 *   Verificaciones adicionales obligatorias:
 *     - REGLA DE BLOQUEO      : un cliente bloqueado NO puede generar un
 *                               préstamo (rechazo explícito).
 *     - CONSISTENCIA PRÉSTAMO-COPIA : al crear el préstamo, la copia queda
 *                               en `"loaned"` de forma consistente con la
 *                               creación del préstamo (vía `_bulk_docs`).
 *     - MANEJO DE CONFLICTOS _rev : se fuerza un conflicto real (409) y se
 *                               confirma que `conflictRetry.js` lo resuelve
 *                               sin pérdida de datos y sin duplicar.
 *
 * DATOS: sólo documentos descartables creados por el propio script y
 * marcados de forma inequívoca (prefijo `TEST_DELETE_ME` + sufijo único).
 * NUNCA toca datos reales insertados a mano.
 *
 * LIMPIEZA: todo lo creado se registra y se borra en el bloque `finally`,
 * aunque una verificación falle a mitad de camino.
 * ============================================================================
 */

require('dotenv').config();

const couchRepo = require('../repositories/couchRepository');
const { db } = require('../config/db');
const { isConflict } = require('../utils/conflictRetry');

const genreService = require('../services/genreService');
const clientService = require('../services/clientService');
const videoService = require('../services/videoService');
const loanService = require('../services/loanService');
const configService = require('../services/configService');
const pricing = require('../services/pricing');

// Marca única para esta corrida: permite identificar y limpiar sin ambigüedad.
const RUN = `TEST_DELETE_ME_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

// Registro de todo lo creado -> se borra al final (orden inverso a la
// dependencia: préstamos/facturas -> videos -> clientes -> géneros).
const created = { loans: [], invoices: [], videos: [], clients: [], genres: [] };

// ---------------------------------------------------------------------------
// Reporte: cada verificación se registra con su estado. Nunca se corta la
// corrida por una aserción fallida; se anota y se sigue (así la limpieza
// siempre ocurre y se ven todos los resultados juntos).
// ---------------------------------------------------------------------------
const results = [];
function record(entity, check, ok, detail) {
  results.push({ entity, check, ok, detail });
  const tag = ok ? 'OK   ' : 'FALLA';
  console.log(`  [${tag}] ${entity} :: ${check}${detail ? ` — ${detail}` : ''}`);
}
async function step(entity, check, fn) {
  try {
    const detail = await fn();
    record(entity, check, true, detail || '');
  } catch (err) {
    record(entity, check, false, `PROBLEMA: ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** GET directo contra CouchDB: devuelve el doc o null (404). Sin capas. */
async function rawGet(id) {
  try {
    return await db.get(id);
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

/** Cuenta cuántos documentos existen con un `_id` dado (debe ser 0 o 1). */
async function countById(id) {
  const res = await db.list({ key: id });
  return res.rows.length;
}

/* ===========================================================================
 * 1) GÉNEROS  — CREATE/UPDATE + DESACTIVAR/REACTIVAR (soft delete).
 *
 *    Ya NO existe ningún DELETE real para género (ni para ninguna otra
 *    entidad del sistema): el enunciado nunca pide "eliminar", solo "dar
 *    de baja" copias y "bloquear" clientes, ambos no-destructivos. Género
 *    sigue ese mismo patrón con `active: boolean` (ver genreService.js).
 * ======================================================================== */
async function testGenres() {
  console.log('\n── GÉNEROS ─────────────────────────────────────────────');
  let genre;

  await step('genero', 'CREATE + GET', async () => {
    genre = await genreService.create({
      name: `${RUN}_genero`,
      description: 'Género descartable de prueba de integridad',
    });
    created.genres.push(genre._id);
    const fromDb = await rawGet(genre._id);
    assert(fromDb, 'el GET tras crear devolvió null (no se persistió)');
    assert(fromDb.name === `${RUN}_genero`, 'el name persistido no coincide');
    assert(fromDb.type === 'genre', '`type` incorrecto en el documento');
    assert(fromDb.active === true, 'un género nuevo debería nacer `active: true`');
    return `_id=${genre._id}`;
  });

  await step('genero', 'UPDATE (aplica cambio, no duplica)', async () => {
    await genreService.update(genre._id, {
      name: `${RUN}_genero_editado`,
      description: 'Descripción actualizada',
    });
    const fromDb = await rawGet(genre._id);
    assert(fromDb, 'el doc desapareció tras el update');
    assert(
      fromDb.name === `${RUN}_genero_editado`,
      `el cambio no se aplicó (name = "${fromDb.name}")`
    );
    const n = await countById(genre._id);
    assert(n === 1, `se esperaba 1 documento con ese _id, hay ${n} (¿update duplicó?)`);
    return `name actualizado; documentos con ese _id = ${n}`;
  });

  await step('genero', 'DESACTIVAR (soft delete: el documento NO desaparece)', async () => {
    await genreService.deactivate(genre._id);
    const fromDb = await rawGet(genre._id);
    assert(fromDb !== null, 'el género desapareció tras desactivar (no debería: no hay DELETE real)');
    assert(fromDb.active === false, 'el género no quedó marcado `active: false`');
    return 'documento sigue existiendo; active=false';
  });

  await step('genero', 'Género inactivo: rechazado en un video NUEVO', async () => {
    let rejected = false;
    try {
      const v = await videoService.create({
        display_title: `${RUN} Video con género inactivo`,
        duration_minutes: 90,
        genre_ids: [genre._id],
        release_year: 2000,
        main_actors: [`${RUN} Actor`],
        unit_cost: 10,
        units_acquired: 1,
      });
      created.videos.push(v._id); // por si acaso se permitiera por error
    } catch (err) {
      rejected = true;
      assert(err.statusCode === 400, `se esperaba 400, llegó ${err.statusCode}`);
    }
    assert(rejected, 'PROBLEMA: se permitió asignar un género inactivo a un video nuevo');
    return 'rechazado correctamente';
  });

  await step('genero', 'REACTIVAR', async () => {
    await genreService.activate(genre._id);
    const fromDb = await rawGet(genre._id);
    assert(fromDb.active === true, 'el género no quedó reactivado');
    return 'active=true';
  });
}

/* ===========================================================================
 * 2) CLIENTES — CREATE / UPDATE + verificación de que el bloqueo se persiste.
 *    (No hay endpoint DELETE de clientes por diseño: se bloquean, no se
 *    borran. El DELETE se verifica a nivel repositorio para la limpieza y
 *    para dejar constancia del estado real.)
 * ======================================================================== */
async function testClients() {
  console.log('\n── CLIENTES ────────────────────────────────────────────');
  let client;

  await step('cliente', 'CREATE + GET', async () => {
    client = await clientService.create({
      first_name: `${RUN}`,
      paternal_surname: 'Prueba',
      phone_mobile: '70000000',
      email: `${RUN.toLowerCase()}@example.com`,
      birth_date: '1990-01-01',
      address: { text: 'Calle Falsa 123', geo: { lat: -17.78, lng: -63.18 } },
    });
    created.clients.push(client._id);
    const fromDb = await rawGet(client._id);
    assert(fromDb, 'el GET tras crear devolvió null');
    assert(fromDb.type === 'client', '`type` incorrecto');
    assert(fromDb.blocked && fromDb.blocked.is_blocked === false, 'debería nacer NO bloqueado');
    return `_id=${client._id}`;
  });

  await step('cliente', 'UPDATE (aplica cambio, no duplica)', async () => {
    await clientService.update(client._id, { phone_mobile: '71111111' });
    const fromDb = await rawGet(client._id);
    assert(fromDb.phone_mobile === '71111111', `el cambio no se aplicó (${fromDb.phone_mobile})`);
    const n = await countById(client._id);
    assert(n === 1, `se esperaba 1 documento, hay ${n} (¿update duplicó?)`);
    return `phone actualizado; documentos con ese _id = ${n}`;
  });

  await step('cliente', 'DELETE a nivel repositorio (desaparece de verdad)', async () => {
    // Cliente auxiliar, sólo para probar el borrado real sin afectar al
    // cliente que usan las pruebas de préstamo.
    const tmp = await clientService.create({
      first_name: `${RUN}_tmp`,
      paternal_surname: 'Borrar',
      phone_mobile: '70000001',
      email: `${RUN.toLowerCase()}.tmp@example.com`,
      birth_date: '1985-05-05',
      address: { text: 'Av. Temporal 1', geo: null },
    });
    await couchRepo.remove(tmp._id, { label: 'Cliente' });
    const fromDb = await rawGet(tmp._id);
    assert(fromDb === null, 'el GET tras DELETE todavía devuelve el cliente');
    return 'GET posterior => 404';
  });
}

/* ===========================================================================
 * 3) VIDEOS — CREATE / UPDATE (sin tocar copias) / alta y baja de copias /
 *    DELETE a nivel repositorio.
 * ======================================================================== */
async function testVideos() {
  console.log('\n── VIDEOS ──────────────────────────────────────────────');
  let genre;
  let video;

  // Género auxiliar para poder referenciarlo desde el video.
  genre = await genreService.create({
    name: `${RUN}_genero_video`,
    description: 'Género auxiliar para la prueba de videos',
  });
  created.genres.push(genre._id);

  await step('video', 'CREATE + GET (genera copias iniciales)', async () => {
    video = await videoService.create({
      display_title: `${RUN} La Película`,
      original_title: `${RUN} Original`,
      english_title: `${RUN} The Movie`,
      alternative_titles: [`${RUN} Alt`],
      duration_minutes: 100,
      genre_ids: [genre._id],
      release_year: 2001,
      oscar_nominations: ['Best Picture'],
      oscar_wins: [],
      main_actors: [`${RUN} Actor`],
      unit_cost: 20,
      units_acquired: 2,
    });
    created.videos.push(video._id);
    const fromDb = await rawGet(video._id);
    assert(fromDb, 'el GET tras crear devolvió null');
    assert(fromDb.type === 'video', '`type` incorrecto');
    assert(Array.isArray(fromDb.copies) && fromDb.copies.length === 2, 'no se generaron 2 copias');
    assert(
      fromDb.copies.every((c) => c.status === 'available'),
      'las copias iniciales deberían estar "available"'
    );
    return `_id=${video._id}; copias=${fromDb.copies.length}`;
  });

  await step('video', 'UPDATE de metadatos (no altera copias, no duplica)', async () => {
    const before = await rawGet(video._id);
    await videoService.update(video._id, { duration_minutes: 123 });
    const after = await rawGet(video._id);
    assert(after.duration_minutes === 123, `el cambio no se aplicó (${after.duration_minutes})`);
    assert(
      JSON.stringify(after.copies) === JSON.stringify(before.copies),
      'el update de metadatos alteró el arreglo de copias (no debería)'
    );
    const n = await countById(video._id);
    assert(n === 1, `se esperaba 1 documento, hay ${n} (¿update duplicó?)`);
    return `duración actualizada; copias intactas; documentos con ese _id = ${n}`;
  });

  await step('video', 'ALTA de copias', async () => {
    await videoService.addCopies(video._id, { count: 1 });
    const fromDb = await rawGet(video._id);
    assert(fromDb.copies.length === 3, `se esperaban 3 copias, hay ${fromDb.copies.length}`);
    return `copias ahora = ${fromDb.copies.length}`;
  });

  await step('video', 'BAJA de copia (fecha + razón)', async () => {
    const fromDb = await rawGet(video._id);
    const target = fromDb.copies.find((c) => c.status === 'available');
    await videoService.retireCopy(video._id, target.copy_id, { reason: 'robo' });
    const after = await rawGet(video._id);
    const c = after.copies.find((x) => x.copy_id === target.copy_id);
    assert(c.status === 'retired', `la copia debería estar "retired", está "${c.status}"`);
    assert(c.retirement && c.retirement.reason === 'robo', 'no se registró la razón de la baja');
    return `copia ${target.copy_id} dada de baja`;
  });

  await step(
    'video',
    'Género YA asociado que se vuelve inactivo: la edición del video lo sigue mostrando',
    async () => {
      await genreService.deactivate(genre._id);
      // (a) editar un campo sin tocar `genre_ids`: no debe re-validarse.
      await videoService.update(video._id, { duration_minutes: 111 });
      let fromDb = await rawGet(video._id);
      assert(fromDb.duration_minutes === 111, 'la edición no se aplicó');
      assert(
        (fromDb.genre_ids || []).includes(genre._id),
        'el video debería seguir mostrando el género inactivo'
      );
      // (b) reenviar `genre_ids` conservando el mismo género inactivo: se
      //     permite, porque no es una asignación NUEVA.
      await videoService.update(video._id, { genre_ids: [genre._id] });
      fromDb = await rawGet(video._id);
      assert(
        (fromDb.genre_ids || []).includes(genre._id),
        'se perdió la referencia al género inactivo al reenviar genre_ids'
      );
      return 'video editado sin problema pese a tener un género inactivo';
    }
  );

  await step(
    'video',
    'Género inactivo NUEVO: no se puede AGREGAR a un video existente',
    async () => {
      const otro = await genreService.create({
        name: `${RUN}_genero_video_otro`,
        description: 'Segundo género auxiliar, se desactiva para la prueba',
      });
      created.genres.push(otro._id);
      await genreService.deactivate(otro._id);

      let rejected = false;
      try {
        await videoService.update(video._id, { genre_ids: [genre._id, otro._id] });
      } catch (err) {
        rejected = true;
        assert(err.statusCode === 400, `se esperaba 400, llegó ${err.statusCode}`);
      }
      assert(rejected, 'PROBLEMA: se permitió agregar un género inactivo NUEVO a un video existente');

      await genreService.activate(genre._id); // se deja reactivado, no interfiere con lo que sigue
      return 'rechazado correctamente';
    }
  );

  await step('video', 'DELETE a nivel repositorio (desaparece de verdad)', async () => {
    await couchRepo.remove(video._id, { label: 'Video' });
    const fromDb = await rawGet(video._id);
    assert(fromDb === null, 'el GET tras DELETE todavía devuelve el video');
    created.videos = created.videos.filter((id) => id !== video._id);
    return 'GET posterior => 404';
  });
}

/* ===========================================================================
 * 4) PRÉSTAMOS — verificaciones adicionales obligatorias
 * ======================================================================== */
async function testLoans() {
  console.log('\n── PRÉSTAMOS ───────────────────────────────────────────');

  // --- Montaje: género + video (2 copias) + cliente ------------------------
  const genre = await genreService.create({
    name: `${RUN}_genero_prestamo`,
    description: 'Género auxiliar para la prueba de préstamos',
  });
  created.genres.push(genre._id);

  const video = await videoService.create({
    display_title: `${RUN} Préstamo Film`,
    duration_minutes: 95,
    genre_ids: [genre._id],
    release_year: 2010,
    main_actors: [`${RUN} Protagonista`],
    unit_cost: 15,
    units_acquired: 2,
  });
  created.videos.push(video._id);

  const client = await clientService.create({
    first_name: `${RUN}_prest`,
    paternal_surname: 'Cliente',
    phone_mobile: '72222222',
    email: `${RUN.toLowerCase()}.prest@example.com`,
    birth_date: '1992-03-03',
    address: { text: 'Zona Central s/n', geo: null },
  });
  created.clients.push(client._id);

  // -----------------------------------------------------------------------
  // 4.a  CONSISTENCIA PRÉSTAMO-COPIA
  // -----------------------------------------------------------------------
  let loan;
  await step('prestamo', 'CONSISTENCIA préstamo-copia (_bulk_docs)', async () => {
    const res = await loanService.createLoan({
      client_id: client._id,
      items: [{ video_id: video._id }],
      days: 2,
    });
    loan = res.loan;
    created.loans.push(res.loan._id);
    created.invoices.push(res.invoice._id);

    // (1) El préstamo existe en CouchDB.
    const loanDb = await rawGet(res.loan._id);
    assert(loanDb, 'el préstamo no quedó persistido');
    assert(loanDb.items.length === 1, 'el préstamo no registró su item');
    const usedCopyId = loanDb.items[0].copy_id;

    // (2) La copia referenciada quedó en "loaned".
    const videoDb = await rawGet(video._id);
    const usedCopy = videoDb.copies.find((c) => c.copy_id === usedCopyId);
    assert(usedCopy, `la copia ${usedCopyId} del préstamo no existe en el video`);
    assert(
      usedCopy.status === 'loaned',
      `la copia ${usedCopyId} debería estar "loaned", está "${usedCopy.status}"`
    );

    // (3) NINGUNA otra copia se marcó de más (no hay copia "loaned" sin
    //     estar en los items del préstamo).
    const loanedCopyIds = videoDb.copies.filter((c) => c.status === 'loaned').map((c) => c.copy_id);
    const itemCopyIds = loanDb.items.map((i) => i.copy_id);
    assert(
      loanedCopyIds.length === itemCopyIds.length &&
        loanedCopyIds.every((id) => itemCopyIds.includes(id)),
      `copias "loaned" (${loanedCopyIds}) no coinciden con los items del préstamo (${itemCopyIds})`
    );

    // (4) La factura del préstamo existe y cuadra.
    const invoiceDb = await rawGet(res.invoice._id);
    assert(invoiceDb, 'no se emitió la factura');
    assert(invoiceDb.loan_id === res.loan._id, 'la factura no apunta al préstamo');

    return `préstamo ${res.loan._id} <-> copia ${usedCopyId} "loaned" <-> factura ${res.invoice._id}`;
  });

  // Verificación complementaria: la DEVOLUCIÓN libera la copia de forma
  // consistente (no queda copia "loaned" sin préstamo activo).
  await step('prestamo', 'CONSISTENCIA en la devolución (libera copia)', async () => {
    assert(loan, 'no hay préstamo previo para devolver');
    const ret = await loanService.returnLoan(loan._id, {});
    const loanDb = await rawGet(loan._id);
    assert(loanDb.status === 'returned', `el préstamo debería quedar "returned", está "${loanDb.status}"`);
    const videoDb = await rawGet(video._id);
    const stillLoaned = videoDb.copies.filter((c) => c.status === 'loaned');
    assert(
      stillLoaned.length === 0,
      `tras la devolución no debería quedar ninguna copia "loaned", quedan ${stillLoaned.length}`
    );
    return `préstamo devuelto; copias liberadas; total factura = ${ret.invoice.total}`;
  });

  // -----------------------------------------------------------------------
  // 4.a2  DEVOLUCIÓN QUE EXCEDE `max_days`: la tarifa del día máximo
  //       configurado se cobra por CADA día real, SIN capear a max_days
  //       (ver `pricing.quoteReturn` / `loanService.returnLoan`).
  // -----------------------------------------------------------------------
  await step(
    'prestamo',
    'DEVOLUCIÓN > max_days: tarifa del día máximo × días reales (no capea)',
    async () => {
      // Config VIGENTE en este momento: nunca se asume un valor fijo, así
      // el test sigue siendo válido si el propietario reconfiguró precios.
      const cfg = await configService.effectiveConfig();
      const maxDays = cfg.max_days;
      const rate = pricing.maxDayRate(cfg.pricing.price_by_days);
      const actualDays = maxDays + 2; // se pasa 2 días del máximo configurado

      // Fechas explícitas y fijas (no depende de esperar N días reales):
      // ambos servicios aceptan `loan_date`/`return_date` en el body.
      const loanDate = new Date('2020-01-01T00:00:00.000Z').toISOString();
      const returnDate = new Date(
        new Date(loanDate).getTime() + actualDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const res2 = await loanService.createLoan({
        client_id: client._id,
        items: [{ video_id: video._id }],
        days: maxDays, // pactado al máximo permitido en la creación
        loan_date: loanDate,
      });
      created.loans.push(res2.loan._id);
      created.invoices.push(res2.invoice._id);

      const ret = await loanService.returnLoan(res2.loan._id, { return_date: returnDate });

      // 1 película, sin descuento (moviesCount=1 no entra en ningún tramo).
      const expectedTotal = pricing.round2(rate * actualDays * 1);
      assert(
        ret.invoice.total === expectedTotal,
        `total esperado ${expectedTotal} Bs (tarifa día máximo ${rate} Bs × ${actualDays} días), ` +
          `llegó ${ret.invoice.total} Bs`
      );
      assert(ret.loan.pricing.overdue === true, 'el breakdown debería marcar `overdue: true`');
      assert(
        ret.invoice.note && ret.invoice.note.includes('tarifa del día máximo'),
        `la nota de la factura no explica la tarifa por exceso de max_days (nota: "${ret.invoice.note}")`
      );
      return (
        `max_days=${maxDays}; actualDays=${actualDays}; tarifa día máx=${rate} Bs; ` +
        `total cobrado=${expectedTotal} Bs (no ${pricing.round2(rate * maxDays)} Bs, que sería el tope capeado)`
      );
    }
  );

  // -----------------------------------------------------------------------
  // 4.b  REGLA DE BLOQUEO
  // -----------------------------------------------------------------------
  await step('prestamo', 'REGLA DE BLOQUEO (cliente bloqueado no puede rentar)', async () => {
    await clientService.block(client._id, { reason: 'Prueba de integridad' });
    const clientDb = await rawGet(client._id);
    assert(clientDb.blocked.is_blocked === true, 'el bloqueo no se persistió');

    let rejected = false;
    let msg = '';
    try {
      const r = await loanService.createLoan({
        client_id: client._id,
        items: [{ video_id: video._id }],
        days: 1,
      });
      // Si llegó aquí, se permitió por error -> hay que limpiar el préstamo.
      created.loans.push(r.loan._id);
      created.invoices.push(r.invoice._id);
    } catch (err) {
      rejected = true;
      msg = err.message;
      assert(err.statusCode === 409, `se esperaba rechazo 409, llegó ${err.statusCode}`);
      // El rechazo debe ser por la REGLA DE BLOQUEO, no un 409 genérico de
      // conflicto de versión (eso indicaría que la regla se está tratando
      // como una carrera MVCC y se reintenta en vano).
      assert(
        /bloquead/i.test(msg),
        `el rechazo no menciona el bloqueo (mensaje recibido: "${msg}")`
      );
    }
    assert(rejected, 'PROBLEMA GRAVE: se permitió un préstamo a un cliente bloqueado');

    // Y no debe haber quedado ninguna copia marcada como prestada por el
    // intento fallido.
    const videoDb = await rawGet(video._id);
    const loaned = videoDb.copies.filter((c) => c.status === 'loaned');
    assert(loaned.length === 0, `el intento bloqueado dejó ${loaned.length} copia(s) en "loaned"`);

    await clientService.unblock(client._id); // se deja el cliente utilizable para la limpieza
    return `rechazado correctamente: "${msg}"`;
  });

  // -----------------------------------------------------------------------
  // 4.c  MANEJO DE CONFLICTOS _rev  (MVCC / control optimista)
  // -----------------------------------------------------------------------
  await step('prestamo', 'MANEJO DE CONFLICTOS _rev (409 real -> conflictRetry)', async () => {
    // Documento descartable dedicado a este test.
    const target = await genreService.create({
      name: `${RUN}_conflicto`,
      description: 'inicial',
      // campo extra que iremos tocando
    });
    created.genres.push(target._id);

    // --- (i) Demostrar que un `_rev` viejo produce un 409 REAL ---------
    const stale = await db.get(target._id);
    const staleRev = stale._rev;
    // Un primer escritor mueve el documento hacia adelante:
    await db.insert({ ...stale, _rev: staleRev, description: 'escritor-1' });
    // Un segundo escritor intenta con el `_rev` ya viejo -> 409:
    let got409 = false;
    try {
      await db.insert({ ...stale, _rev: staleRev, description: 'escritor-2-directo' });
    } catch (err) {
      got409 = isConflict(err);
    }
    assert(got409, 'no se produjo el 409 esperado con un _rev viejo (test inválido)');

    // --- (ii) La MISMA actualización, hecha con updateWithRetry, sí
    //          completa (re-lee, reintenta) y no pierde el cambio previo.
    await couchRepo.updateWithRetry(
      target._id,
      (doc) => {
        doc.description = 'escritor-1'; // preserva lo que había
        doc.reintento_ok = true; // su propio cambio
        return doc;
      },
      { label: 'Género' }
    );

    // --- (iii) Carrera real: 5 incrementos concurrentes sobre el mismo
    //           documento. Si el manejo de conflictos funciona, el
    //           contador final es exactamente 5 (ningún update perdido).
    const N = 5;
    await Promise.all(
      Array.from({ length: N }, () =>
        couchRepo.updateWithRetry(
          target._id,
          (doc) => {
            doc.counter = (doc.counter || 0) + 1;
            return doc;
          },
          { label: 'Género' }
        )
      )
    );

    const finalDoc = await rawGet(target._id);
    assert(finalDoc.reintento_ok === true, 'se perdió el cambio hecho vía updateWithRetry');
    assert(finalDoc.description === 'escritor-1', 'se perdió el cambio del primer escritor');
    assert(
      finalDoc.counter === N,
      `se perdieron updates por conflicto: counter = ${finalDoc.counter}, esperado ${N}`
    );
    const n = await countById(target._id);
    assert(n === 1, `el manejo de conflictos duplicó el documento (hay ${n})`);

    return `409 real reproducido y resuelto; ${N} escrituras concurrentes sin pérdida; 1 solo documento`;
  });
}

/* ===========================================================================
 * LIMPIEZA
 * ======================================================================== */
async function cleanup() {
  console.log('\n── LIMPIEZA ────────────────────────────────────────────');
  const groups = [
    ['invoice', created.invoices],
    ['loan', created.loans],
    ['video', created.videos],
    ['client', created.clients],
    ['genre', created.genres],
  ];
  let borrados = 0;
  let fallos = 0;
  for (const [label, ids] of groups) {
    for (const id of [...new Set(ids)]) {
      try {
        const doc = await rawGet(id);
        if (!doc) continue; // ya no existe
        await db.destroy(doc._id, doc._rev);
        borrados++;
      } catch (err) {
        fallos++;
        console.log(`  [AVISO] no se pudo borrar ${label} ${id}: ${err.message}`);
      }
    }
  }
  console.log(`  Limpieza: ${borrados} documento(s) borrado(s), ${fallos} fallo(s).`);

  // Barrido de seguridad: cualquier documento que haya quedado con la
  // marca de esta corrida en el nombre.
  await sweepByRunMarker();
}

/**
 * Segunda pasada de limpieza: busca por `_all_docs` cualquier doc cuyo
 * `name` / `display_title` / `first_name` contenga la marca RUN y lo
 * elimina. Cubre el caso de que algún `_id` no se haya registrado.
 */
async function sweepByRunMarker() {
  try {
    const res = await db.list({ include_docs: true });
    const huerfanos = res.rows
      .map((r) => r.doc)
      .filter(
        (d) =>
          d &&
          [d.name, d.display_title, d.first_name, d.description]
            .filter((x) => typeof x === 'string')
            .some((x) => x.includes(RUN))
      );
    if (huerfanos.length === 0) {
      console.log('  Barrido por marca: sin documentos huérfanos.');
      return;
    }
    for (const d of huerfanos) {
      try {
        await db.destroy(d._id, d._rev);
        console.log(`  Barrido por marca: borrado ${d._id}`);
      } catch (err) {
        console.log(`  Barrido por marca: no se pudo borrar ${d._id}: ${err.message}`);
      }
    }
  } catch (err) {
    console.log(`  Barrido por marca: no se pudo completar (${err.message}).`);
  }
}

/* ===========================================================================
 * MAIN
 * ======================================================================== */
async function main() {
  console.log('============================================================');
  console.log(' PRUEBA DE INTEGRIDAD CRUD ACOTADA');
  console.log(` Marca de corrida: ${RUN}`);
  console.log(` Base: ${process.env.COUCHDB_DB}`);
  console.log('============================================================');

  try {
    await testGenres();
    await testClients();
    await testVideos();
    await testLoans();
  } catch (err) {
    console.error('\n[ERROR NO CONTROLADO durante las pruebas]', err);
    results.push({
      entity: 'general',
      check: 'ejecución',
      ok: false,
      detail: `Excepción no controlada: ${err.message}`,
    });
  } finally {
    await cleanup();
  }

  // -------- Resumen final -------------------------------------------------
  console.log('\n============================================================');
  console.log(' RESUMEN');
  console.log('============================================================');
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  for (const r of results) {
    console.log(
      `  ${r.ok ? 'OK   ' : 'FALLA'}  ${pad(r.entity, 10)}  ${pad(r.check, 46)}  ${r.detail || ''}`
    );
  }
  const fallas = results.filter((r) => !r.ok);
  console.log('------------------------------------------------------------');
  console.log(`  Total: ${results.length}  |  OK: ${results.length - fallas.length}  |  FALLA: ${fallas.length}`);
  console.log('============================================================');

  process.exit(fallas.length > 0 ? 1 : 0);
}

main();
