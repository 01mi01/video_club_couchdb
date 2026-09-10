/**
 * ============================================================================
 * scripts/e2e-verify.js  —  VERIFICACIÓN END-TO-END DEL FLUJO FUNCIONAL
 * ============================================================================
 *
 *     node scripts/e2e-verify.js
 *
 * Ejercita TODO el backend contra los DATOS REALES ya cargados (79
 * películas, 20 clientes), usando la capa de servicios (mismo camino que
 * las rutas HTTP; el servidor no se levanta, regla de trabajo 1).
 *
 * REGLAS DE SEGURIDAD DE ESTE SCRIPT
 *   - NO crea ni borra películas ni clientes reales.
 *   - Los préstamos/facturas creados para probar se DEVUELVEN al final
 *     (las copias quedan disponibles). Los documentos de préstamo/factura
 *     quedan como historial "returned" (estado de negocio válido); se
 *     listan sus IDs por si se quieren depurar a mano.
 *   - El cliente que se bloquea para la prueba 4 se DESBLOQUEA al terminar.
 *   - El cambio de configuración de la prueba 7 se REVIERTE (se elimina el
 *     documento de config para volver al estado "sin persistir / defaults"
 *     que había antes).
 *   - EXCEPCIÓN deliberada: la prueba 6 (baja de copia) es permanente por
 *     naturaleza. Se hace sobre una película de 5 copias -> queda con 4.
 *
 * Cada verificación se reporta por separado. Nada corta la corrida: si una
 * asa falla se registra y se sigue, para que la limpieza/restauración
 * siempre ocurra y se vean los 7 resultados juntos.
 * ============================================================================
 */

require('dotenv').config();

const { db } = require('../config/db');
const videoRepo = require('../repositories/videoRepository');
const clientRepo = require('../repositories/clientRepository');
const genreRepo = require('../repositories/genreRepository');
const configRepo = require('../repositories/configRepository');

const videoService = require('../services/videoService');
const clientService = require('../services/clientService');
const loanService = require('../services/loanService');
const configService = require('../services/configService');

/* --------------------------------------------------------------------- */
const results = [];
function record(n, titulo, ok, detalle) {
  results.push({ n, titulo, ok, detalle });
  console.log(`\n[${ok ? 'OK' : 'FALLA'}] Verificación ${n}: ${titulo}`);
  if (detalle) console.log(detalle.split('\n').map((l) => '    ' + l).join('\n'));
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function money(n) {
  return `${n} Bs`;
}

/* Registro para limpieza/restauración */
const cleanup = { loansToReturn: [], loanDocs: [], blockedClientId: null, configDocsCreated: [] };

async function rawGet(id) {
  try { return await db.get(id); } catch (e) { if (e.statusCode === 404) return null; throw e; }
}

/* ===========================================================================
 * 1) BÚSQUEDA DE PELÍCULAS
 * ======================================================================== */
async function v1_busqueda() {
  const lines = [];

  // 1.a  por NOMBRE (título principal)
  const porNombre = await videoService.search({ title: 'Dark Knight' });
  assert(porNombre.length >= 1, 'búsqueda por nombre "Dark Knight" no devolvió nada');
  assert(
    porNombre.some((v) => v.display_title === 'The Dark Knight'),
    'búsqueda por nombre no encontró "The Dark Knight"'
  );
  lines.push(`por NOMBRE "Dark Knight" -> ${porNombre.length} resultado(s): ${porNombre.map((v) => v.display_title).join(', ')}`);

  // 1.b  por NOMBRE usando un título ALTERNATIVO / en idioma original
  const porNombreAlt = await videoService.search({ title: 'laberinto' });
  assert(
    porNombreAlt.some((v) => v.display_title === "Pan's Labyrinth"),
    'búsqueda por título alternativo "laberinto" no encontró "Pan\'s Labyrinth"'
  );
  lines.push(`por NOMBRE (título original) "laberinto" -> ${porNombreAlt.map((v) => v.display_title).join(', ')}`);

  // 1.c  por GÉNERO (referencia normalizada por ID)
  const generos = await genreRepo.list();
  const western = generos.find((g) => g.name === 'Western');
  assert(western, 'no existe el género Western en la base');
  const porGenero = await videoService.search({ genreId: western._id });
  assert(porGenero.length >= 2, `búsqueda por género Western devolvió ${porGenero.length} (<2)`);
  assert(
    porGenero.every((v) => (v.genre_ids || []).includes(western._id)),
    'algún resultado por género NO referencia realmente el género Western'
  );
  lines.push(`por GÉNERO "Western" (${western._id}) -> ${porGenero.length} resultado(s): ${porGenero.map((v) => v.display_title).join(', ')}`);

  // 1.d  por ACTOR
  const porActor = await videoService.search({ actor: 'Ryan Gosling' });
  assert(porActor.length >= 2, `búsqueda por actor "Ryan Gosling" devolvió ${porActor.length} (<2)`);
  assert(
    porActor.every((v) => (v.main_actors || []).some((a) => /ryan gosling/i.test(a))),
    'algún resultado por actor NO tiene a Ryan Gosling en main_actors'
  );
  lines.push(`por ACTOR "Ryan Gosling" -> ${porActor.length} resultado(s): ${porActor.map((v) => v.display_title).join(', ')}`);

  // 1.e  por NOMINACIÓN AL OSCAR (categoría concreta)
  const porOscar = await videoService.search({ oscarNomination: 'Best Visual Effects' });
  assert(porOscar.length >= 2, `búsqueda por nominación "Best Visual Effects" devolvió ${porOscar.length} (<2)`);
  assert(
    porOscar.every((v) => (v.oscar_nominations || []).some((c) => /best visual effects/i.test(c))),
    'algún resultado por nominación NO tiene esa categoría en oscar_nominations'
  );
  lines.push(`por NOMINACIÓN OSCAR "Best Visual Effects" -> ${porOscar.length}: ${porOscar.map((v) => v.display_title).join(', ')}`);

  // 1.f  "¿tuvo alguna nominación al Oscar?"
  const nominadas = await videoService.search({ oscarNominated: 'true' });
  assert(nominadas.length >= 20, `búsqueda "nominadas al Oscar" devolvió ${nominadas.length} (esperado muchas)`);
  assert(
    nominadas.every((v) => (v.oscar_nominations || []).length > 0),
    'algún resultado de "nominadas" NO tiene nominaciones'
  );
  lines.push(`por NOMINACIÓN OSCAR (cualquiera) -> ${nominadas.length} películas nominadas`);

  // Control negativo: un término que no existe no debe traer basura.
  const vacio = await videoService.search({ actor: 'Zzxx Noexiste Persona' });
  assert(vacio.length === 0, `búsqueda de un actor inexistente devolvió ${vacio.length} (debería ser 0)`);
  lines.push('control negativo (actor inexistente) -> 0 resultados. Correcto.');

  // NOTA sobre los `[CouchDB _find] Consulta SIN índice` que aparecen en
  // consola: NO significan que no haya índice. Las 4 consultas usan su
  // índice declarado (`use_index`). CouchDB emite un `warning` de
  // proporción ("documents examined high in proportion to results") porque
  // los selectores con `$elemMatch` + `$regex` (nombre / actor / categoría
  // Oscar) no se resuelven del todo con un índice `json` plano: el índice
  // acota el campo-arreglo y el filtro de regex se termina en memoria.
  // Es una característica real de Mango (útil de mencionar en el video:
  // conecta con los límites de la búsqueda por texto en CouchDB), no un
  // fallo. Los resultados son correctos y relevantes en los 4 tipos.
  lines.push(
    'NOTA: CouchDB emite un warning de proporción en las búsquedas con regex ' +
      '(nombre/actor/categoría Oscar): el índice se usa, pero el filtro de texto ' +
      'se completa en memoria. Resultados correctos.'
  );

  record(1, 'Búsqueda de películas por nombre / género / actor / nominación al Oscar', true,
    lines.join('\n'));
}

/* ===========================================================================
 * 2) COTIZACIÓN Y CREACIÓN DE PRÉSTAMOS + DESCUENTOS
 * ======================================================================== */
async function v2_prestamos(clienteId, videoIds) {
  const lines = [];

  // Escenarios: [nº películas, días, % esperado, total esperado]
  //   price_by_days por defecto: 1d=2, 2d=3, 3d=4, 4d=5, 5d=6
  //   descuentos: 3-5 pelis = 5% ; 6+ = 10%
  const escenarios = [
    { movies: 1, days: 1, pct: 0, perMovie: 2, base: 2, total: 2 },
    { movies: 4, days: 3, pct: 5, perMovie: 4, base: 16, total: 15.2 },
    { movies: 6, days: 2, pct: 10, perMovie: 3, base: 18, total: 16.2 },
  ];

  let cursor = 0;
  for (const e of escenarios) {
    const items = videoIds.slice(cursor, cursor + e.movies).map((id) => ({ video_id: id }));
    cursor += e.movies;
    assert(items.length === e.movies, 'no hay suficientes videos reales para el escenario');

    // --- COTIZACIÓN (no persiste) ---
    const q = await loanService.quoteLoan({ client_id: clienteId, items, days: e.days });
    assert(q.pricing.price_per_movie === e.perMovie, `${e.movies} pelis/${e.days}d: precio/peli ${q.pricing.price_per_movie} != ${e.perMovie}`);
    assert(q.pricing.base_amount === e.base, `${e.movies} pelis/${e.days}d: base ${q.pricing.base_amount} != ${e.base}`);
    assert(q.pricing.discount_percent === e.pct, `${e.movies} pelis/${e.days}d: %desc ${q.pricing.discount_percent} != ${e.pct}`);
    assert(q.pricing.total_amount === e.total, `${e.movies} pelis/${e.days}d: total ${q.pricing.total_amount} != ${e.total}`);

    // --- CREACIÓN (persiste: préstamo + factura + copias vía _bulk_docs) ---
    const res = await loanService.createLoan({ client_id: clienteId, items, days: e.days });
    cleanup.loansToReturn.push(res.loan._id);
    cleanup.loanDocs.push(res.loan._id, res.invoice._id);

    assert(res.loan.pricing.total_amount === e.total, `préstamo persistido: total ${res.loan.pricing.total_amount} != ${e.total}`);
    assert(res.invoice.total === e.total, `factura: total ${res.invoice.total} != ${e.total}`);
    assert(res.invoice.discount_percent === e.pct, `factura: %desc ${res.invoice.discount_percent} != ${e.pct}`);
    assert(res.invoice.number > 0, 'la factura no recibió número correlativo');

    // Consistencia: cada copia del préstamo quedó "loaned".
    for (const it of res.loan.items) {
      const vDoc = await rawGet(it.video_id);
      const cp = vDoc.copies.find((c) => c.copy_id === it.copy_id);
      assert(cp && cp.status === 'loaned', `copia ${it.copy_id} de ${it.video_id} no quedó "loaned"`);
    }

    lines.push(
      `${e.movies} película(s), ${e.days} día(s): ` +
        `precio/peli ${money(e.perMovie)} x ${e.movies} = base ${money(e.base)}, ` +
        `descuento ${e.pct}% (${money(q.pricing.discount_amount)}) -> TOTAL ${money(e.total)}  ` +
        `[cotización == préstamo == factura #${res.invoice.number}]  OK`
    );
  }

  record(2, 'Cotización y creación de préstamos con descuentos por cantidad (0% / 5% / 10%)', true, lines.join('\n'));
}

/* ===========================================================================
 * 3) LÍMITE DE DÍAS DE PRÉSTAMO
 * ======================================================================== */
async function v3_maxDias(clienteId, videoId) {
  const cfg = await configService.effectiveConfig();
  const max = cfg.max_days;
  const exceso = max + 2;

  let rechazado = false;
  let msg = '';
  let code = null;
  try {
    await loanService.quoteLoan({ client_id: clienteId, items: [{ video_id: videoId }], days: exceso });
  } catch (err) {
    rechazado = true;
    msg = err.message;
    code = err.statusCode;
  }
  assert(rechazado, `PROBLEMA: se aceptó un préstamo de ${exceso} días con máximo configurado ${max}`);
  assert(code === 422, `se esperaba rechazo 422, llegó ${code}`);
  assert(/día/i.test(msg) && String(max).length > 0 && msg.includes(String(max)),
    `el mensaje de rechazo no menciona el máximo de ${max} días (mensaje: "${msg}")`);

  // Y el límite del borde SÍ debe aceptarse (control positivo).
  const okBorde = await loanService.quoteLoan({ client_id: clienteId, items: [{ video_id: videoId }], days: max });
  assert(okBorde.days === max, 'un préstamo de exactamente el máximo de días debería aceptarse y no lo hace');

  record(3, 'Límite de días de préstamo (no se permiten plazos mayores al máximo configurado)', true,
    `Máximo configurado: ${max} días.\n` +
      `Préstamo de ${exceso} días -> RECHAZADO ${code}: "${msg}"\n` +
      `Préstamo de ${max} días (borde) -> aceptado en cotización. Correcto.`);
}

/* ===========================================================================
 * 4) BLOQUEO DE CLIENTE
 * ======================================================================== */
async function v4_bloqueo(clienteId, videoId) {
  const antes = await clientRepo.getById(clienteId);
  assert(!antes.blocked.is_blocked, 'el cliente elegido para la prueba ya estaba bloqueado (aborta la prueba)');

  // Bloquear
  await clientService.block(clienteId, { reason: 'Prueba E2E automatizada - se desbloqueará al terminar' });
  cleanup.blockedClientId = clienteId;
  const bloqueado = await clientRepo.getById(clienteId);
  assert(bloqueado.blocked.is_blocked === true, 'el bloqueo no se persistió');
  assert(bloqueado.blocked.date && bloqueado.blocked.reason, 'el bloqueo no registró fecha y/o razón');

  // Intentar préstamo -> debe rechazarse por la REGLA DE BLOQUEO
  let rechazado = false;
  let msg = '';
  let code = null;
  try {
    const r = await loanService.createLoan({ client_id: clienteId, items: [{ video_id: videoId }], days: 1 });
    cleanup.loansToReturn.push(r.loan._id);
    cleanup.loanDocs.push(r.loan._id, r.invoice._id);
  } catch (err) {
    rechazado = true;
    msg = err.message;
    code = err.statusCode;
  }
  assert(rechazado, 'PROBLEMA GRAVE: se permitió un préstamo a un cliente bloqueado');
  assert(code === 409, `se esperaba rechazo 409, llegó ${code}`);
  assert(/bloquead/i.test(msg), `el mensaje de rechazo no menciona el bloqueo (mensaje: "${msg}")`);

  // Ninguna copia debió quedar marcada por el intento fallido.
  const vDoc = await rawGet(videoId);
  const loaned = vDoc.copies.filter((c) => c.status === 'loaned').map((c) => c.copy_id);
  assert(loaned.length === 0 || !loaned, `el intento bloqueado dejó copia(s) en "loaned": ${loaned}`);

  // Desbloquear -> estado original
  await clientService.unblock(clienteId);
  cleanup.blockedClientId = null;
  const despues = await clientRepo.getById(clienteId);
  assert(despues.blocked.is_blocked === false, 'el cliente NO quedó desbloqueado tras la prueba');

  record(4, 'Bloqueo de cliente (cliente bloqueado no puede rentar) + restauración', true,
    `Cliente ${antes.first_name} ${antes.paternal_surname} (${clienteId})\n` +
      `Bloqueado -> intento de préstamo RECHAZADO ${code}: "${msg}"\n` +
      `Sin copias marcadas por el intento fallido.\n` +
      `Cliente DESBLOQUEADO al terminar (blocked.is_blocked = ${despues.blocked.is_blocked}). Estado original restaurado.`);
}

/* ===========================================================================
 * 5) FLUJO DE DEVOLUCIÓN
 * ======================================================================== */
async function v5_devolucion(clienteId, videoId) {
  const vAntes = await rawGet(videoId);
  const dispAntes = vAntes.copies.filter((c) => c.status === 'available').length;

  // Crear préstamo de 1 película, 3 días.
  const created = await loanService.createLoan({ client_id: clienteId, items: [{ video_id: videoId }], days: 3 });
  cleanup.loanDocs.push(created.loan._id, created.invoice._id);
  const copyId = created.loan.items[0].copy_id;

  const vDurante = await rawGet(videoId);
  assert(
    vDurante.copies.find((c) => c.copy_id === copyId).status === 'loaned',
    `la copia ${copyId} no quedó "loaned" tras crear el préstamo`
  );
  assert(
    vDurante.copies.filter((c) => c.status === 'available').length === dispAntes - 1,
    'el nº de copias disponibles no bajó en 1 al prestar'
  );

  // Factura emitida.
  const facturaCreada = await rawGet(created.invoice._id);
  assert(facturaCreada, 'no se emitió la factura al crear el préstamo');
  assert(facturaCreada.loan_id === created.loan._id, 'la factura no apunta al préstamo');
  assert(facturaCreada.total === created.loan.pricing.total_amount, 'total factura != total préstamo');

  // DEVOLVER.
  const ret = await loanService.returnLoan(created.loan._id, {});
  const loanDb = await rawGet(created.loan._id);
  assert(loanDb.status === 'returned', `el préstamo quedó en "${loanDb.status}", esperado "returned"`);
  assert(loanDb.return_date, 'la devolución no registró return_date');

  // Copia disponible de nuevo.
  const vDespues = await rawGet(videoId);
  const copyDespues = vDespues.copies.find((c) => c.copy_id === copyId);
  assert(copyDespues.status === 'available', `la copia ${copyId} quedó en "${copyDespues.status}", esperado "available"`);
  assert(
    vDespues.copies.filter((c) => c.status === 'available').length === dispAntes,
    'el nº de copias disponibles no volvió a su valor original tras la devolución'
  );

  // Factura tras la devolución.
  const facturaFinal = await rawGet(created.invoice._id);
  assert(facturaFinal, 'la factura desapareció tras la devolución');
  assert(typeof facturaFinal.total === 'number' && facturaFinal.total >= 0, 'la factura final no tiene un total válido');
  assert(Array.isArray(facturaFinal.lines) && facturaFinal.lines.length >= 1, 'la factura final no tiene líneas');

  record(5, 'Flujo de devolución (crear préstamo -> devolver -> copia disponible + factura)', true,
    `Película "${vAntes.display_title}" | copia ${copyId}\n` +
      `Disponibles antes: ${dispAntes}  ->  al prestar: ${dispAntes - 1}  ->  tras devolver: ${vDespues.copies.filter((c) => c.status === 'available').length}\n` +
      `Préstamo ${created.loan._id} status=returned, return_date=${loanDb.return_date}\n` +
      `Factura #${facturaFinal.number} (${created.invoice._id}) total ${money(facturaFinal.total)}, ${facturaFinal.lines.length} línea(s).`);
}

/* ===========================================================================
 * 6) BAJA DE COPIA  (permanente por diseño)
 * ======================================================================== */
async function v6_bajaCopia(videoId) {
  const vAntes = await rawGet(videoId);
  const dispAntes = vAntes.copies.filter((c) => c.status === 'available');
  assert(dispAntes.length >= 2, `la película elegida tiene ${dispAntes.length} copias disponibles (<2); se elige otra`);
  const objetivo = dispAntes[0].copy_id;

  await videoService.retireCopy(videoId, objetivo, { reason: 'robo' });

  const vDespues = await rawGet(videoId);
  const copia = vDespues.copies.find((c) => c.copy_id === objetivo);
  assert(copia.status === 'retired', `la copia ${objetivo} quedó "${copia.status}", esperado "retired"`);
  assert(copia.retirement && copia.retirement.reason === 'robo', 'no se registró la razón de la baja');
  assert(copia.retirement.date, 'no se registró la fecha de la baja');

  const dispDespues = vDespues.copies.filter((c) => c.status === 'available');
  assert(dispDespues.length === dispAntes.length - 1, 'el nº de copias disponibles no bajó en 1');
  assert(!dispDespues.some((c) => c.copy_id === objetivo), 'la copia dada de baja sigue figurando como disponible');

  // Confirmar que NO se puede prestar esa copia concreta.
  let rechazado = false;
  try {
    await loanService.quoteLoan({
      client_id: (await clientRepo.list())[0]._id,
      items: [{ video_id: videoId, copy_id: objetivo }],
      days: 1,
    });
  } catch (err) {
    rechazado = /disponible|no está|retired/i.test(err.message);
  }
  assert(rechazado, `PROBLEMA: la copia ${objetivo} dada de baja todavía se puede prestar`);

  record(6, 'Baja de copia (retiro permanente por robo; deja de estar disponible)', true,
    `Película "${vAntes.display_title}" (${videoId})\n` +
      `Copias disponibles: ${dispAntes.length} -> ${dispDespues.length}  (copia ${objetivo} = "retired", razón "robo", fecha ${copia.retirement.date})\n` +
      `Intento de préstamo de la copia ${objetivo} -> rechazado. Correcto.\n` +
      `NOTA: esta baja es permanente en los datos reales (quedan ${dispDespues.length} copias disponibles).`);
}

/* ===========================================================================
 * 7) CONFIGURACIÓN (cambiar -> verificar -> restaurar)
 * ======================================================================== */
async function v7_configuracion(clienteId, videoIds) {
  const items4 = videoIds.slice(0, 4).map((id) => ({ video_id: id }));

  // Estado original: sin documento config:discounts -> defaults (3-5 = 5%).
  const discountsAntes = await configRepo.getDiscounts();
  const origenPersistido = !!discountsAntes;

  const cotAntes = await loanService.quoteLoan({ client_id: clienteId, items: items4, days: 3 });
  assert(cotAntes.pricing.discount_percent === 5, `estado inicial: 4 pelis debería dar 5%, dio ${cotAntes.pricing.discount_percent}%`);

  // CAMBIO temporal: 3-5 películas -> 15% ; 6+ -> 20%.
  await configService.setDiscounts({
    tiers: [
      { min_qty: 3, max_qty: 5, percent: 15 },
      { min_qty: 6, max_qty: null, percent: 20 },
    ],
  });
  if (!origenPersistido) cleanup.configDocsCreated.push(configRepo.DISCOUNTS_ID);

  const cotDespues = await loanService.quoteLoan({ client_id: clienteId, items: items4, days: 3 });
  assert(cotDespues.pricing.discount_percent === 15, `tras el cambio: 4 pelis debería dar 15%, dio ${cotDespues.pricing.discount_percent}%`);
  assert(cotDespues.pricing.base_amount === 16, `base inesperada: ${cotDespues.pricing.base_amount}`);
  assert(cotDespues.pricing.total_amount === 13.6, `total tras 15%: esperado 13.6, dio ${cotDespues.pricing.total_amount}`);

  // RESTAURAR: como antes NO había documento, se elimina el creado para
  // volver exactamente al estado "sin persistir / defaults".
  let restauffDetalle;
  if (!origenPersistido) {
    const doc = await db.get(configRepo.DISCOUNTS_ID);
    await db.destroy(doc._id, doc._rev);
    cleanup.configDocsCreated = cleanup.configDocsCreated.filter((x) => x !== configRepo.DISCOUNTS_ID);
    restauffDetalle = 'documento config:discounts ELIMINADO (vuelve a defaults no persistidos).';
  } else {
    await configService.setDiscounts({ tiers: discountsAntes.tiers });
    restauffDetalle = 'tiers originales RE-GUARDADOS.';
  }

  const cotFinal = await loanService.quoteLoan({ client_id: clienteId, items: items4, days: 3 });
  assert(cotFinal.pricing.discount_percent === 5, `tras restaurar: 4 pelis debería volver a 5%, dio ${cotFinal.pricing.discount_percent}%`);
  assert(cotFinal.pricing.total_amount === 15.2, `tras restaurar: total esperado 15.2, dio ${cotFinal.pricing.total_amount}`);

  record(7, 'Configuración de descuentos (cambio temporal reflejado en la cotización + restauración)', true,
    `4 películas / 3 días, base ${money(16)}:\n` +
      `  ANTES     -> descuento ${cotAntes.pricing.discount_percent}%  total ${money(cotAntes.pricing.total_amount)}\n` +
      `  CAMBIADO  -> descuento ${cotDespues.pricing.discount_percent}%  total ${money(cotDespues.pricing.total_amount)}  (cambio reflejado)\n` +
      `  RESTAURADO-> descuento ${cotFinal.pricing.discount_percent}%  total ${money(cotFinal.pricing.total_amount)}  (${restauffDetalle})`);
}

/* ===========================================================================
 * LIMPIEZA / RESTAURACIÓN
 * ======================================================================== */
async function restaurar() {
  console.log('\n── RESTAURACIÓN ────────────────────────────────────────');

  // Devolver préstamos de prueba que sigan activos (libera copias).
  let devueltos = 0;
  for (const loanId of [...new Set(cleanup.loansToReturn)]) {
    try {
      const l = await rawGet(loanId);
      if (l && l.status === 'active') {
        await loanService.returnLoan(loanId, {});
        devueltos++;
      }
    } catch (e) {
      console.log(`  [AVISO] no se pudo devolver ${loanId}: ${e.message}`);
    }
  }
  console.log(`  Préstamos de prueba devueltos (copias liberadas): ${devueltos}`);

  // Desbloquear si quedó bloqueado por una prueba a medias.
  if (cleanup.blockedClientId) {
    try {
      await clientService.unblock(cleanup.blockedClientId);
      console.log(`  Cliente ${cleanup.blockedClientId} DESBLOQUEADO (quedó bloqueado por prueba interrumpida).`);
    } catch (e) {
      console.log(`  [AVISO] no se pudo desbloquear ${cleanup.blockedClientId}: ${e.message}`);
    }
  } else {
    console.log('  Bloqueo de cliente: sin pendientes.');
  }

  // Eliminar docs de config creados por una prueba a medias.
  for (const id of [...new Set(cleanup.configDocsCreated)]) {
    try {
      const d = await db.get(id);
      await db.destroy(d._id, d._rev);
      console.log(`  Config ${id} ELIMINADO (restaura estado sin persistir).`);
    } catch (e) {
      console.log(`  [AVISO] no se pudo eliminar config ${id}: ${e.message}`);
    }
  }

  // Verificación final del estado.
  const pricing = await configRepo.getPricing();
  const discounts = await configRepo.getDiscounts();
  console.log(`  Estado config final: pricing=${pricing ? 'persistido' : 'defaults'}, discounts=${discounts ? 'persistido' : 'defaults'}`);

  const clientes = await clientRepo.list();
  const bloqueados = clientes.filter((c) => c.blocked && c.blocked.is_blocked);
  console.log(`  Clientes bloqueados en la base: ${bloqueados.length}`);

  console.log('\n  Documentos de préstamo/factura creados por esta prueba (quedan como historial "returned"):');
  [...new Set(cleanup.loanDocs)].forEach((id) => console.log(`    - ${id}`));
}

/* ===========================================================================
 * MAIN
 * ======================================================================== */
async function main() {
  console.log('============================================================');
  console.log(' VERIFICACIÓN END-TO-END DEL FLUJO FUNCIONAL DEL BACKEND');
  console.log(` Base: ${process.env.COUCHDB_DB}`);
  console.log('============================================================');

  // Selección de datos reales.
  const videos = await videoRepo.list();
  const clientes = await clientRepo.list();
  assert(videos.length >= 15 && clientes.length >= 3, 'faltan datos reales (películas/clientes)');

  const byTitle = (t) => {
    const v = videos.find((x) => x.display_title === t);
    assert(v, `no se encontró la película real "${t}"`);
    return v;
  };

  // Cliente principal para préstamos (real, no bloqueado).
  const clientePrestamos = clientes.find((c) => !c.blocked.is_blocked);
  // Cliente distinto para la prueba de bloqueo.
  const clienteBloqueo = clientes.find((c) => c._id !== clientePrestamos._id && !c.blocked.is_blocked);

  // 12 películas distintas con copias disponibles para los préstamos de la
  // prueba 2 (1 + 4 + 6 = 11) y la 7 (4). Excluimos la de la prueba 6.
  const peliBaja = byTitle('Mad Max: Fury Road');
  const peliDevolucion = byTitle('Nomadland');
  const disponiblesParaPrestamo = videos
    .filter((v) => v._id !== peliBaja._id && v._id !== peliDevolucion._id)
    .filter((v) => (v.copies || []).some((c) => c.status === 'available'))
    .map((v) => v._id);
  const idsPrestamo = disponiblesParaPrestamo.slice(0, 11);
  const idsConfig = disponiblesParaPrestamo.slice(11, 15);
  // Película reservada para las pruebas 3 y 4 (solo cotización / rechazo
  // por bloqueo): NO la consume ninguna de las creaciones de la prueba 2.
  const idExtra = disponiblesParaPrestamo[15];

  try {
    await v1_busqueda();
  } catch (e) { record(1, 'Búsqueda de películas', false, `PROBLEMA: ${e.message}`); }

  try {
    await v2_prestamos(clientePrestamos._id, idsPrestamo);
  } catch (e) { record(2, 'Cotización y creación de préstamos con descuentos', false, `PROBLEMA: ${e.message}`); }

  try {
    await v3_maxDias(clientePrestamos._id, idExtra);
  } catch (e) { record(3, 'Límite de días de préstamo', false, `PROBLEMA: ${e.message}`); }

  try {
    await v4_bloqueo(clienteBloqueo._id, idExtra);
  } catch (e) { record(4, 'Bloqueo de cliente', false, `PROBLEMA: ${e.message}`); }

  try {
    await v5_devolucion(clientePrestamos._id, peliDevolucion._id);
  } catch (e) { record(5, 'Flujo de devolución', false, `PROBLEMA: ${e.message}`); }

  try {
    await v6_bajaCopia(peliBaja._id);
  } catch (e) { record(6, 'Baja de copia', false, `PROBLEMA: ${e.message}`); }

  try {
    await v7_configuracion(clientePrestamos._id, idsConfig);
  } catch (e) { record(7, 'Configuración de precios/descuentos', false, `PROBLEMA: ${e.message}`); }

  await restaurar();

  console.log('\n============================================================');
  console.log(' RESUMEN');
  console.log('============================================================');
  for (const r of results) {
    console.log(`  ${r.ok ? 'OK   ' : 'FALLA'}  ${r.n}. ${r.titulo}`);
  }
  const fallas = results.filter((r) => !r.ok);
  console.log('------------------------------------------------------------');
  console.log(`  ${results.length - fallas.length}/${results.length} verificaciones OK` + (fallas.length ? `  |  ${fallas.length} con problemas` : ''));
  console.log('============================================================');

  process.exit(fallas.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\n[ERROR NO CONTROLADO]', err);
  try { await restaurar(); } catch (e) { console.error('fallo en restauración:', e.message); }
  process.exit(1);
});
