/**
 * ============================================================================
 * scripts/audit-requirements.js  —  AUDITORÍA DE CUMPLIMIENTO (enunciado)
 * ============================================================================
 *
 *     node scripts/audit-requirements.js
 *
 * Recorre CADA requisito funcional del enunciado del profesor y lo prueba
 * end-to-end contra los servicios reales (mismo camino que las rutas
 * HTTP). Para cada regla explícita ("no préstamos > días configurados",
 * "cliente bloqueado no renta", etc.) se verifica el caso feliz Y el
 * rechazo.
 *
 * Datos: se crean entidades descartables marcadas `AUDIT_DELETE_ME_*` y se
 * eliminan al final (bloque finally), incluso si una aserción falla. NO se
 * tocan películas / clientes reales.
 * ============================================================================
 */

require('dotenv').config();

const { db } = require('../config/db');
const genreRepo = require('../repositories/genreRepository');
const videoRepo = require('../repositories/videoRepository');
const clientRepo = require('../repositories/clientRepository');
const configRepo = require('../repositories/configRepository');

const genreService = require('../services/genreService');
const videoService = require('../services/videoService');
const clientService = require('../services/clientService');
const zoneService = require('../services/zoneService');
const loanService = require('../services/loanService');
const configService = require('../services/configService');

const RUN = `AUDIT_DELETE_ME_${Date.now()}`;
const DAY = 86400000;
const created = { genres: [], videos: [], clients: [], loans: [], invoices: [], zones: [] };

const rows = [];
let currentReq = '';
function req(id, title) {
  currentReq = `${id} — ${title}`;
}
function check(desc, ok, detail = '') {
  rows.push({ req: currentReq, desc, ok: !!ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${desc}${detail ? `  — ${detail}` : ''}`);
}
async function expectOk(desc, fn) {
  try {
    const r = await fn();
    check(desc, true, typeof r === 'string' ? r : '');
    return r;
  } catch (e) {
    check(desc, false, `lanzó: ${e.message}`);
    return undefined;
  }
}
async function expectReject(desc, fn, matcher) {
  try {
    await fn();
    check(desc, false, 'NO fue rechazado (se esperaba error)');
  } catch (e) {
    const ok = matcher ? matcher.test(e.message) || matcher.test(String(e.statusCode)) : true;
    check(desc, ok, `rechazado: "${e.message}"${ok ? '' : ' (mensaje inesperado)'}`);
  }
}
async function rawGet(id) {
  try { return await db.get(id); } catch (e) { if (e.statusCode === 404) return null; throw e; }
}
function A(cond, msg) { if (!cond) throw new Error(msg); return true; }

// ---------------------------------------------------------------------------
async function main() {
  console.log('============================================================');
  console.log(' AUDITORÍA DE CUMPLIMIENTO DE REQUISITOS');
  console.log(` Base: ${process.env.COUCHDB_DB}`);
  console.log('============================================================\n');

  // Montaje base ------------------------------------------------------------
  const g1 = await genreService.create({ name: `${RUN}_Drama`, description: 'descartable 1' });
  const g2 = await genreService.create({ name: `${RUN}_Comedia`, description: 'descartable 2' });
  created.genres.push(g1._id, g2._id);

  /* =====================================================================
   * GESTIÓN DE VIDEOS
   * ==================================================================== */

  // ---- V1: Registrar un nuevo video con TODOS los campos ----------------
  req('V1', 'Registrar nuevo video (duración, géneros múltiples, títulos alt/original/inglés, año, Oscars nominados y ganados, actores, costo DVD, unidades)');
  let video;
  await expectOk('POST /api/videos crea el video con todos los campos', async () => {
    video = await videoService.create({
      display_title: `${RUN} Pelicula`,
      original_title: `${RUN} Título Original`,
      original_language: 'Coreano',
      director: `${RUN} Director`,
      alternative_titles: [`${RUN} Alt Uno`, `${RUN} Alt Dós`, `${RUN} The Movie`],
      duration_minutes: 132,
      genre_ids: [g1._id, g2._id], // MÁS DE UN GÉNERO
      release_year: 2019,
      oscar_nominations: ['Best Picture', 'Best Film Editing'],
      oscar_wins: ['Best Director', 'Best International Feature Film'],
      main_actors: [`${RUN} Actor A`, `${RUN} Actriz B`],
      unit_cost: 27.5,
      units_acquired: 5,
    });
    created.videos.push(video._id);
    return `id=${video._id}`;
  });
  const vdb = await rawGet(video._id);
  check('duración en minutos persistida', vdb.duration_minutes === 132);
  check('pertenece a MÁS DE UN género (genre_ids)', (vdb.genre_ids || []).length === 2 && vdb.genre_ids.includes(g1._id) && vdb.genre_ids.includes(g2._id));
  check('título original + idioma original persistidos', vdb.original_title === `${RUN} Título Original` && vdb.original_language === 'Coreano');
  check('director persistido', vdb.director === `${RUN} Director`);
  check('títulos alternativos persistidos (incluye título en inglés, ya sin campo dedicado)', (vdb.alternative_titles || []).length === 3);
  check('all_titles agrega todas las variantes', ['display_title', 'original_title'].every((k) => vdb.all_titles.includes(vdb[k])) && vdb.all_titles.length >= 5);
  check('año de publicación persistido', vdb.release_year === 2019);
  check('nominaciones al Oscar persistidas', vdb.oscar_nominations.includes('Best Picture') && vdb.oscar_nominations.includes('Best Film Editing'));
  check('premios Oscar ganados persistidos', vdb.oscar_wins.includes('Best Director') && vdb.oscar_wins.includes('Best International Feature Film'));
  check('coherencia: todo lo ganado consta también como nominación', vdb.oscar_wins.every((w) => vdb.oscar_nominations.includes(w)));
  check('actores principales persistidos', vdb.main_actors.length === 2);
  check('costo unitario del DVD persistido', vdb.unit_cost === 27.5);
  check('número de unidades adquiridas persistido', vdb.units_acquired === 5);
  check('se generaron tantas copias como unidades (c1..c5, todas disponibles)', vdb.copies.length === 5 && vdb.copies.every((c, i) => c.copy_id === `c${i + 1}` && c.status === 'available'));

  // Reglas / validaciones (no solo caso feliz)
  const baseVideo = {
    display_title: `${RUN} tmp`, duration_minutes: 90, genre_ids: [g1._id],
    release_year: 2000, main_actors: ['X'], unit_cost: 10, units_acquired: 1,
  };
  await expectReject('rechaza sin display_title', () => videoService.create({ ...baseVideo, display_title: '' }), /obligatorio|display_title/i);
  await expectReject('rechaza sin duración', () => videoService.create({ ...baseVideo, duration_minutes: undefined }), /duration|obligatorio/i);
  await expectReject('rechaza duración <= 0', () => videoService.create({ ...baseVideo, duration_minutes: 0 }), /duration|> 0/i);
  await expectReject('rechaza sin géneros', () => videoService.create({ ...baseVideo, genre_ids: [] }), /género|genre_ids/i);
  await expectReject('rechaza género inexistente', () => videoService.create({ ...baseVideo, genre_ids: ['genre:no-existe'] }), /inexistente|Género/i);
  await expectReject('rechaza sin año', () => videoService.create({ ...baseVideo, release_year: undefined }), /release_year|obligatorio/i);
  await expectReject('rechaza año fuera de rango', () => videoService.create({ ...baseVideo, release_year: 3025 }), /rango|release_year/i);
  await expectReject('rechaza sin actores', () => videoService.create({ ...baseVideo, main_actors: [] }), /actor|main_actors/i);
  await expectReject('rechaza sin costo unitario', () => videoService.create({ ...baseVideo, unit_cost: undefined }), /unit_cost|obligatorio/i);
  await expectReject('rechaza unidades < 1', () => videoService.create({ ...baseVideo, units_acquired: 0 }), /units_acquired|>= 1/i);

  // ---- V2: Registrar nuevas copias para una película -------------------
  req('V2', 'Registrar nuevas copias para una película');
  await expectOk('POST /api/videos/:id/copies agrega 3 copias', async () => {
    await videoService.addCopies(video._id, { count: 3 });
    const v = await rawGet(video._id);
    A(v.copies.length === 8, `esperaba 8 copias, hay ${v.copies.length}`);
    A(v.copies.slice(5).every((c) => c.status === 'available'), 'las nuevas no están disponibles');
    A(v.copies[7].copy_id === 'c8', `correlativo incorrecto: ${v.copies[7].copy_id}`);
    A(v.units_acquired === 8, `units_acquired no acumuló: ${v.units_acquired}`);
    return 'c6..c8 agregadas, units_acquired=8';
  });
  await expectReject('rechaza count < 1', () => videoService.addCopies(video._id, { count: 0 }), /count|>= 1/i);

  // ---- V3: Registrar bajas de copias (fecha + razón) ------------------
  req('V3', 'Registrar bajas de copias (fecha de baja + razón: no devuelto, robo, etc.)');
  await expectOk('baja de copia disponible con razón "robo" y fecha explícita', async () => {
    const fecha = new Date('2026-03-15T12:00:00Z').toISOString();
    await videoService.retireCopy(video._id, 'c8', { reason: 'robo', date: fecha });
    const v = await rawGet(video._id);
    const c8 = v.copies.find((c) => c.copy_id === 'c8');
    A(c8.status === 'retired', `estado ${c8.status}`);
    A(c8.retirement.reason === 'robo', 'razón no persistida');
    A(c8.retirement.date === fecha, 'fecha de baja no persistida tal cual');
    return 'c8 retirada por robo, fecha 2026-03-15';
  });
  await expectOk('acepta razón arbitraria ("daño irreparable")', async () => {
    await videoService.retireCopy(video._id, 'c7', { reason: 'daño irreparable' });
    const v = await rawGet(video._id);
    A(v.copies.find((c) => c.copy_id === 'c7').retirement.reason === 'daño irreparable', 'no persistió');
    return 'razón libre aceptada';
  });
  await expectReject('rechaza baja sin razón', () => videoService.retireCopy(video._id, 'c6', { reason: '' }), /reason|razón/i);
  await expectReject('rechaza baja de copia ya dada de baja', () => videoService.retireCopy(video._id, 'c8', { reason: 'robo' }), /ya está dada de baja/i);

  /* =====================================================================
   * GESTIÓN DE CLIENTES
   * ==================================================================== */

  // ---- C1: Registrar nuevos clientes con todos los campos --------------
  req('C1', 'Registrar nuevos clientes (nombre + apellidos paterno/materno, celular, correo, nacimiento, dirección, geolocalización, fecha de registro)');

  // Zona de prueba: la geolocalización de la dirección ahora se resuelve
  // por REFERENCIA a una zona preconfigurada (ver zoneService.js), no por
  // lat/lng tecleados a mano.
  const zona = await zoneService.create({ name: `${RUN}_zona`, geo: { lat: -16.5, lng: -68.15 } });
  created.zones.push(zona._id);

  let client;
  await expectOk('POST /api/clients crea el cliente con todos los campos', async () => {
    client = await clientService.create({
      first_name: 'John', paternal_surname: 'Audit', maternal_surname: 'Doe',
      phone_mobile: '71234567', email: `${RUN.toLowerCase()}@example.com`,
      birth_date: '1990-05-20',
      address: { text: 'Av. Auditoría 100, La Paz', zone_id: zona._id },
      registered_at: '2025-12-01T10:00:00.000Z',
    });
    created.clients.push(client._id);
    return `id=${client._id}`;
  });
  const cdb = await rawGet(client._id);
  check('nombre + apellido paterno + apellido materno persistidos', cdb.first_name === 'John' && cdb.paternal_surname === 'Audit' && cdb.maternal_surname === 'Doe');
  check('teléfono celular persistido', cdb.phone_mobile === '71234567');
  check('correo persistido', cdb.email === `${RUN.toLowerCase()}@example.com`);
  check('fecha de nacimiento persistida', cdb.birth_date === '1990-05-20');
  check('dirección persistida', cdb.address.text.includes('Av. Auditoría'));
  check('geolocalización de la dirección persistida (referencia a zona)', cdb.address.zone_id === zona._id);
  check('fecha de registro persistida', cdb.registered_at === '2025-12-01T10:00:00.000Z');
  check('nace NO bloqueado', cdb.blocked && cdb.blocked.is_blocked === false);

  await expectOk('permite cliente SIN apellido materno (campo opcional "si tiene ambos")', async () => {
    const c2 = await clientService.create({
      first_name: 'Anna', paternal_surname: 'Solo',
      phone_mobile: '70000000', email: `${RUN.toLowerCase()}.anna@example.com`,
      birth_date: '1995-01-01', address: { text: 'Calle Sola 1', zone_id: null },
    });
    created.clients.push(c2._id);
    const fresh = await rawGet(c2._id);
    A(fresh.maternal_surname === null, `materno debería ser null, es ${JSON.stringify(fresh.maternal_surname)}`);
    return 'materno = null';
  });

  await expectOk('permite cliente SIN correo (opcional — el enunciado lo lista pero no lo exige)', async () => {
    const c3 = await clientService.create({
      first_name: 'Mark', paternal_surname: 'NoEmail',
      phone_mobile: '70000002', birth_date: '1992-02-02',
      address: { text: 'Calle Sin Correo 1', zone_id: null },
    });
    created.clients.push(c3._id);
    const fresh = await rawGet(c3._id);
    A(fresh.email === null, `email debería ser null, es ${JSON.stringify(fresh.email)}`);
    return 'email = null';
  });

  const baseClient = {
    first_name: 'Test', paternal_surname: 'Test', phone_mobile: '70000001',
    email: `${RUN.toLowerCase()}.v@example.com`, birth_date: '1990-01-01',
    address: { text: 'Calle 1', zone_id: null },
  };
  await expectReject('rechaza sin nombre', () => clientService.create({ ...baseClient, first_name: '' }), /obligatorio|first_name/i);
  await expectReject('rechaza sin apellido paterno', () => clientService.create({ ...baseClient, paternal_surname: '' }), /obligatorio|paternal/i);
  await expectReject('rechaza sin teléfono', () => clientService.create({ ...baseClient, phone_mobile: '' }), /obligatorio|phone/i);
  await expectReject('rechaza correo con formato inválido', () => clientService.create({ ...baseClient, email: 'no-es-correo' }), /email|formato/i);
  await expectReject('rechaza sin fecha de nacimiento', () => clientService.create({ ...baseClient, birth_date: '' }), /obligatorio|birth_date/i);
  await expectReject('rechaza fecha de nacimiento futura', () => clientService.create({ ...baseClient, birth_date: '2999-01-01' }), /futura|birth_date/i);
  await expectReject('rechaza sin dirección', () => clientService.create({ ...baseClient, address: { text: '', zone_id: null } }), /dirección|address/i);
  await expectReject('rechaza zona inexistente', () => clientService.create({ ...baseClient, address: { text: 'x', zone_id: 'zone:no-existe' } }), /zona|zone/i);

  // ---- C2: Actualizar datos de clientes -------------------------------
  req('C2', 'Actualizar datos de clientes');
  await expectOk('PUT /api/clients/:id aplica el cambio sin duplicar', async () => {
    await clientService.update(client._id, { phone_mobile: '79999999' });
    const fresh = await rawGet(client._id);
    A(fresh.phone_mobile === '79999999', 'no se aplicó');
    const dupes = (await db.list({ key: client._id })).rows.length;
    A(dupes === 1, `hay ${dupes} documentos con ese _id`);
    A(fresh.blocked.is_blocked === false, 'el update NO debe tocar el estado de bloqueo');
    return 'teléfono actualizado, 1 solo documento, bloqueo intacto';
  });
  await expectOk('PUT /api/clients/:id fusiona la dirección', async () => {
    await clientService.update(client._id, { address: { text: 'Nueva dirección 200' } });
    const fresh = await rawGet(client._id);
    A(fresh.address.text === 'Nueva dirección 200', 'texto no actualizado');
    return 'dirección fusionada';
  });

  // ---- C3: Bloquear clientes (fecha + razón); bloqueados no rentan ----
  req('C3', 'Bloquear clientes (fecha + razón del bloqueo); un cliente bloqueado NO puede rentar');
  await expectOk('POST /api/clients/:id/block registra fecha y razón', async () => {
    const fecha = new Date('2026-02-10T09:00:00Z').toISOString();
    await clientService.block(client._id, { reason: 'Copias no devueltas', date: fecha });
    const fresh = await rawGet(client._id);
    A(fresh.blocked.is_blocked === true, 'no quedó bloqueado');
    A(fresh.blocked.reason === 'Copias no devueltas', 'razón no persistida');
    A(fresh.blocked.date === fecha, 'fecha no persistida');
    return 'bloqueado con fecha + razón';
  });
  await expectReject('un cliente BLOQUEADO NO puede generar un préstamo', () =>
    loanService.createLoan({ client_id: client._id, items: [{ video_id: video._id }], days: 1 }),
    /bloquead/i
  );
  await expectReject('rechaza bloquear un cliente ya bloqueado', () => clientService.block(client._id, { reason: 'otra' }), /ya está bloqueado/i);
  await expectReject('rechaza bloquear sin razón', () => clientService.block(client._id, { reason: '' }), /reason|razón/i);
  await expectOk('POST /api/clients/:id/unblock lo reactiva y ya puede rentar', async () => {
    await clientService.unblock(client._id);
    const fresh = await rawGet(client._id);
    A(fresh.blocked.is_blocked === false, 'sigue bloqueado');
    const r = await loanService.createLoan({ client_id: client._id, items: [{ video_id: video._id, copy_id: 'c1' }], days: 1 });
    created.loans.push(r.loan._id);
    created.invoices.push(r.invoice._id);
    await loanService.returnLoan(r.loan._id, {}); // se devuelve para liberar la copia
    return 'desbloqueado y préstamo de prueba OK';
  });
  await expectReject('rechaza desbloquear un cliente no bloqueado', () => clientService.unblock(client._id), /no está bloqueado/i);

  /* =====================================================================
   * GESTIÓN DE PRÉSTAMOS
   * ==================================================================== */

  // ---- P1: Buscar película por nombre / género / actor / nominación ---
  req('P1', 'Buscar película por nombre, género, actor o nominación al Oscar (MUY IMPORTANTE)');
  await expectOk('búsqueda por NOMBRE (insensible a acentos): "alt dos" encuentra "Alt Dós"', async () => {
    const res = await videoService.search({ title: `${RUN} alt dos` });
    A(res.some((v) => v._id === video._id), 'no encontró el video de auditoría');
    return `${res.length} resultado(s)`;
  });
  await expectOk('búsqueda por GÉNERO (por id normalizado) devuelve solo videos de ese género', async () => {
    const res = await videoService.search({ genreId: g1._id });
    A(res.some((v) => v._id === video._id), 'no encontró el video');
    A(res.every((v) => (v.genre_ids || []).includes(g1._id)), 'algún resultado no tiene ese género');
    return `${res.length} resultado(s), todos del género`;
  });
  await expectOk('búsqueda por ACTOR devuelve solo videos con ese actor', async () => {
    const res = await videoService.search({ actor: `${RUN} Actor A` });
    A(res.some((v) => v._id === video._id), 'no encontró el video');
    A(res.every((v) => (v.main_actors || []).some((a) => a.includes(`${RUN} Actor A`))), 'resultado sin ese actor');
    return `${res.length} resultado(s)`;
  });
  await expectOk('búsqueda por NOMINACIÓN al Oscar (categoría) filtra por esa categoría', async () => {
    const res = await videoService.search({ oscarNomination: 'Best Film Editing' });
    A(res.some((v) => v._id === video._id), 'no encontró el video');
    A(res.every((v) => (v.oscar_nominations || []).some((c) => /best film editing/i.test(c))), 'resultado sin esa nominación');
    return `${res.length} resultado(s)`;
  });
  await expectOk('búsqueda combinada (nombre + género) intersecta', async () => {
    const res = await videoService.search({ title: RUN, genreId: g2._id });
    A(res.some((v) => v._id === video._id), 'no encontró el video');
    return `${res.length} resultado(s)`;
  });
  await expectReject('rechaza búsqueda sin ningún criterio', () => videoService.search({}), /criterio|indica/i);
  await expectOk('término inexistente -> 0 resultados (sin basura)', async () => {
    const res = await videoService.search({ actor: 'Zxqw Nadie Persona' });
    A(res.length === 0, `devolvió ${res.length}`);
    return '0 resultados';
  });

  // ---- P2: Registrar el préstamo (agregar películas, fecha devolución,
  //          calcular importe, emitir factura) --------------------------
  req('P2', 'Registrar préstamo: agregar película(s), buscar más si lleva varias, fecha de devolución, calcular importe, emitir factura con importe total');

  // Necesitamos copias disponibles: c1..c6 (c7,c8 de baja). c1 se devolvió arriba.
  const av = (await rawGet(video._id)).copies.filter((c) => c.status === 'available').map((c) => c.copy_id);
  A(av.length >= 6, `se esperaban >=6 copias disponibles, hay ${av.length}`);

  // Config por defecto: 1d=2, 2d=3, 3d=4, 4d=5, 5d=6 ; desc 3-5=5%, 6+=10%
  const escenarios = [
    { n: 1, days: 2, pct: 0, total: 3, label: '1 película, 2 días, sin descuento' },
    { n: 3, days: 3, pct: 5, total: 11.4, label: '3 películas, 3 días, 5% descuento' },
    { n: 5, days: 1, pct: 5, total: 9.5, label: '5 películas (borde), 1 día, 5% descuento' },
    { n: 6, days: 1, pct: 10, total: 10.8, label: '6 películas (>5), 1 día, 10% descuento' },
  ];
  for (const e of escenarios) {
    // Para juntar N "películas" usamos N copias del mismo video (se permite
    // repetir video_id: "el cliente lleva varias").
    const items = av.slice(0, e.n).map((cid) => ({ video_id: video._id, copy_id: cid }));
    const q = await loanService.quoteLoan({ client_id: client._id, items, days: e.days });
    const okQuote =
      q.pricing.movies_count === e.n &&
      q.pricing.discount_percent === e.pct &&
      q.pricing.total_amount === e.total;
    check(`cotización correcta — ${e.label}`, okQuote,
      `movies=${q.pricing.movies_count} desc=${q.pricing.discount_percent}% total=${q.pricing.total_amount} (esperado ${e.pct}% / ${e.total})`);

    const r = await loanService.createLoan({ client_id: client._id, items, days: e.days });
    created.loans.push(r.loan._id);
    created.invoices.push(r.invoice._id);
    const invDb = await rawGet(r.invoice._id);
    check(`factura emitida con importe total — ${e.label}`,
      invDb && invDb.number > 0 && invDb.total === e.total && invDb.total === r.loan.pricing.total_amount && Array.isArray(invDb.lines) && invDb.lines.length >= 1,
      `factura #${invDb && invDb.number}, total ${invDb && invDb.total}`);
    // Consistencia copia -> loaned
    const vNow = await rawGet(video._id);
    const allLoaned = r.loan.items.every((it) => vNow.copies.find((c) => c.copy_id === it.copy_id).status === 'loaned');
    check(`copias marcadas como prestadas (_bulk_docs) — ${e.label}`, allLoaned);
    // Devolver para liberar y no agotar el inventario de prueba
    await loanService.returnLoan(r.loan._id, {});
  }

  await expectOk('"fecha de devolución" por due_date (días de CALENDARIO): lunes -> jueves = 3 días', async () => {
    const q = await loanService.quoteLoan({
      client_id: client._id,
      items: [{ video_id: video._id, copy_id: av[0] }],
      loan_date: '2026-05-04T09:00:00.000Z', // lunes
      due_date: '2026-05-07T20:00:00.000Z', // jueves (la hora no debe afectar)
    });
    A(q.days === 3, `days calculado = ${q.days} (esperado 3)`);
    A(q.pricing.total_amount === 4, `total ${q.pricing.total_amount} (esperado 4)`);
    return 'due_date lunes->jueves = 3 días, total 4 Bs (insensible a la hora)';
  });
  await expectOk('devolución EL MISMO DÍA es válida y se factura como 1 día (mínimo de la tabla)', async () => {
    const q = await loanService.quoteLoan({
      client_id: client._id,
      items: [{ video_id: video._id, copy_id: av[0] }],
      loan_date: '2026-05-04T09:00:00.000Z',
      due_date: '2026-05-04T22:00:00.000Z', // mismo día, más tarde
    });
    A(q.days === 1, `days = ${q.days} (esperado 1)`);
    A(q.pricing.total_amount === 2, `total ${q.pricing.total_amount} (esperado 2 = tarifa de 1 día)`);
    // Y también a nivel de CREACIÓN (persiste + factura).
    const r = await loanService.createLoan({
      client_id: client._id,
      items: [{ video_id: video._id, copy_id: av[0] }],
      loan_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 3600000).toISOString(), // hoy, 1h después
    });
    created.loans.push(r.loan._id);
    created.invoices.push(r.invoice._id);
    A(r.loan.days === 1, `préstamo creado con days=${r.loan.days}`);
    await loanService.returnLoan(r.loan._id, {});
    return 'mismo día -> 1 día, 2 Bs (cotización y creación)';
  });
  await expectReject('due_date de un día ANTERIOR al préstamo sigue rechazándose', () =>
    loanService.quoteLoan({
      client_id: client._id,
      items: [{ video_id: video._id, copy_id: av[0] }],
      loan_date: '2026-05-04T09:00:00.000Z',
      due_date: '2026-05-03T09:00:00.000Z',
    }),
    /anterior/i
  );

  await expectOk('registrar préstamo de VARIAS películas distintas (buscar más) — 2 videos', async () => {
    // Segundo video descartable para tener 2 títulos distintos.
    const v2 = await videoService.create({
      display_title: `${RUN} Segunda`, duration_minutes: 100, genre_ids: [g1._id],
      release_year: 2015, main_actors: ['Z'], unit_cost: 10, units_acquired: 2,
    });
    created.videos.push(v2._id);
    const r = await loanService.createLoan({
      client_id: client._id,
      items: [
        { video_id: video._id, copy_id: av[0] },
        { video_id: v2._id },
      ],
      days: 2,
    });
    created.loans.push(r.loan._id);
    created.invoices.push(r.invoice._id);
    A(r.loan.items.length === 2, 'no registró 2 ítems');
    A(new Set(r.loan.items.map((i) => i.video_id)).size === 2, 'no son de 2 videos distintos');
    await loanService.returnLoan(r.loan._id, {});
    return '2 películas distintas en un préstamo';
  });

  // ---- P3: No préstamos mayores a los días configurados ---------------
  req('P3', 'No deben permitirse préstamos mayores a los días configurados');
  const cfg0 = await configService.effectiveConfig();
  const max = cfg0.max_days;
  check(`máximo de días configurado = ${max} (mayor plazo con precio)`, max === 5);
  await expectReject(`cotización rechaza ${max + 1} días`, () =>
    loanService.quoteLoan({ client_id: client._id, items: [{ video_id: video._id, copy_id: av[0] }], days: max + 1 }),
    new RegExp(`m[aá]s de ${max}|422`, 'i')
  );
  await expectReject(`creación rechaza ${max + 1} días`, () =>
    loanService.createLoan({ client_id: client._id, items: [{ video_id: video._id, copy_id: av[0] }], days: max + 1 }),
    new RegExp(`m[aá]s de ${max}|422`, 'i')
  );
  await expectReject(`due_date que implica ${max + 3} días también se rechaza`, () =>
    loanService.quoteLoan({
      client_id: client._id,
      items: [{ video_id: video._id, copy_id: av[0] }],
      loan_date: new Date().toISOString(),
      due_date: new Date(Date.now() + (max + 3) * DAY).toISOString(),
    }),
    new RegExp(`m[aá]s de ${max}|422`, 'i')
  );
  await expectOk(`préstamo de exactamente ${max} días (borde) SÍ se acepta`, async () => {
    const q = await loanService.quoteLoan({ client_id: client._id, items: [{ video_id: video._id, copy_id: av[0] }], days: max });
    A(q.days === max, 'no aceptó el borde');
    return `${max} días aceptado`;
  });

  // ---- P4: Descuentos por cantidad, configurables --------------------
  req('P4', 'Definir y modificar descuentos por cantidad (default: 3-5 películas = 5%, más de 5 = 10%)');
  const dDef = await configService.getDiscounts();
  check('default: NO persistido (usa valores del enunciado)', dDef.persisted === false);
  const t35 = (dDef.tiers || []).find((t) => t.min_qty === 3);
  const t6 = (dDef.tiers || []).find((t) => t.min_qty === 6);
  check('default: 3 a 5 películas = 5%', t35 && t35.max_qty === 5 && t35.percent === 5);
  check('default: más de 5 (>=6) = 10%, sin tope', t6 && t6.max_qty === null && t6.percent === 10);
  await expectOk('modificar descuentos y ver el efecto en una nueva cotización, luego restaurar', async () => {
    await configService.setDiscounts({ tiers: [{ min_qty: 3, max_qty: 5, percent: 25 }, { min_qty: 6, max_qty: null, percent: 30 }] });
    const q = await loanService.quoteLoan({ client_id: client._id, items: av.slice(0, 4).map((c) => ({ video_id: video._id, copy_id: c })), days: 1 });
    A(q.pricing.discount_percent === 25, `descuento aplicado = ${q.pricing.discount_percent}%`);
    // restaurar: no había documento -> se elimina
    const doc = await db.get(configRepo.DISCOUNTS_ID);
    await db.destroy(doc._id, doc._rev);
    const back = await configService.getDiscounts();
    A(back.persisted === false, 'no volvió a defaults');
    return '25% aplicado tras el cambio; configuración restaurada a defaults';
  });
  await expectReject('PUT descuentos rechaza un tramo inválido', () => configService.setDiscounts({ tiers: [{ min_qty: 0, max_qty: 2, percent: 5 }] }), /min_qty|>= 1/i);

  // ---- P5: Costos por día, configurables ----------------------------
  req('P5', 'Definir y modificar costos por día de préstamo (default: 1d=2, 2d=3, 3d=4, 4d=5, 5d=6 Bs)');
  const pDef = await configService.getPricing();
  check('default: NO persistido (usa valores del enunciado)', pDef.persisted === false);
  check('default: tabla 1..5 = 2,3,4,5,6 Bs exactamente', JSON.stringify(pDef.price_by_days) === JSON.stringify({ 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }));
  check('default: máximo de días = 5 (mayor clave con precio)', pDef.max_days === 5);
  await expectOk('modificar precios y ver el efecto en una nueva cotización, luego restaurar', async () => {
    await configService.setPricing({ price_by_days: { 1: 10, 2: 3, 3: 4, 4: 5, 5: 6 } });
    const q = await loanService.quoteLoan({ client_id: client._id, items: [{ video_id: video._id, copy_id: av[0] }], days: 1 });
    A(q.pricing.total_amount === 10, `total 1 día = ${q.pricing.total_amount} (esperado 10)`);
    const doc = await db.get(configRepo.PRICING_ID);
    await db.destroy(doc._id, doc._rev);
    const back = await configService.getPricing();
    A(back.persisted === false && back.price_by_days[1] === 2, 'no volvió a defaults');
    return 'precio de 1 día = 10 tras el cambio; configuración restaurada';
  });
  await expectReject('PUT precios rechaza claves no consecutivas desde 1', () => configService.setPricing({ price_by_days: { 1: 2, 3: 4 } }), /1,2,3|huecos|consecut/i);
  await expectReject('PUT precios rechaza precio <= 0', () => configService.setPricing({ price_by_days: { 1: 0 } }), /> 0|precio/i);

  // ---- P2 (cont.): "calcular el importe según la fecha de devolución"
  //       en la DEVOLUCIÓN real (tardía) ------------------------------
  req('P2-dev', 'Devolución: recalcular el importe según la fecha real de devolución (atraso reflejado en la factura)');
  await expectOk('préstamo devuelto tarde -> importe recalculado y nota de atraso en la factura', async () => {
    const loanDate = new Date(Date.now() - 12 * DAY).toISOString();
    const r = await loanService.createLoan({
      client_id: client._id, items: [{ video_id: video._id, copy_id: av[0] }],
      loan_date: loanDate, days: 2,
    });
    created.loans.push(r.loan._id);
    created.invoices.push(r.invoice._id);
    const ret = await loanService.returnLoan(r.loan._id, {}); // devuelto hoy => 12 días reales
    const loanDb = await rawGet(r.loan._id);
    A(loanDb.status === 'returned', `status ${loanDb.status}`);
    A(loanDb.returned_late === true, 'no marcó returned_late');
    A(loanDb.actual_days > loanDb.days, `actual_days ${loanDb.actual_days} no > ${loanDb.days}`);
    const invDb = await rawGet(r.invoice._id);
    A(/tard[ií]a|atraso/i.test(invDb.note || ''), `factura sin nota de atraso: "${invDb.note}"`);
    return `12 días reales vs 2 pactados; nota: "${invDb.note}"`;
  });

  // ---- Baja "no devuelto" sobre copia prestada (integra V3 + préstamos)
  req('V3-nd', 'Baja de copia con razón "no devuelto" sobre una copia PRESTADA (préstamo vencido nunca devuelto)');
  await expectOk('retireCopy("no devuelto") sobre copia prestada -> copia retired + préstamo cerrado "unreturned"', async () => {
    const loanDate = new Date(Date.now() - 20 * DAY).toISOString();
    const r = await loanService.createLoan({
      client_id: client._id, items: [{ video_id: video._id, copy_id: av[1] }],
      loan_date: loanDate, days: 3,
    });
    created.loans.push(r.loan._id);
    created.invoices.push(r.invoice._id);
    await videoService.retireCopy(video._id, av[1], { reason: 'no devuelto' });
    const v = await rawGet(video._id);
    A(v.copies.find((c) => c.copy_id === av[1]).status === 'retired', 'la copia no quedó retired');
    const loanDb = await rawGet(r.loan._id);
    A(loanDb.status === 'unreturned', `el préstamo quedó "${loanDb.status}"`);
    A(loanDb.return_date === null, 'no debería tener return_date');
    return 'copia retired + préstamo unreturned';
  });
  await expectReject('retireCopy("robo") sobre copia prestada se rechaza (hay que devolver primero)', async () => {
    const r = await loanService.createLoan({
      client_id: client._id, items: [{ video_id: video._id, copy_id: av[2] }], days: 1,
    });
    created.loans.push(r.loan._id);
    created.invoices.push(r.invoice._id);
    await videoService.retireCopy(video._id, av[2], { reason: 'robo' });
  }, /prestada|devoluci/i);

  await limpiar();
  reporte();
}

// ---------------------------------------------------------------------------
async function limpiar() {
  console.log('\n── LIMPIEZA ────────────────────────────────────────────');
  const grupos = [
    ['invoice', created.invoices], ['loan', created.loans],
    ['video', created.videos], ['client', created.clients], ['genre', created.genres],
    ['zone', created.zones],
  ];
  let n = 0;
  for (const [, ids] of grupos) {
    for (const id of [...new Set(ids)]) {
      try {
        const d = await rawGet(id);
        if (d) { await db.destroy(d._id, d._rev); n++; }
      } catch (e) {
        console.log(`  [AVISO] ${id}: ${e.message}`);
      }
    }
  }
  // Barrido por marca + limpieza de docs de config que hayan quedado.
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
    console.log(`  [AVISO] barrido: ${e.message}`);
  }
  for (const cid of ['config:pricing', 'config:discounts']) {
    const d = await rawGet(cid);
    if (d) {
      await db.destroy(d._id, d._rev);
      console.log(`  [AVISO] se eliminó ${cid} residual de una prueba de config`);
      n++;
    }
  }
  console.log(`  ${n} documento(s) descartable(s) eliminado(s). Datos reales intactos.`);
}

function reporte() {
  console.log('\n============================================================');
  console.log(' REPORTE POR REQUISITO');
  console.log('============================================================');
  let lastReq = null;
  let pass = 0;
  let fail = 0;
  for (const r of rows) {
    if (r.req !== lastReq) {
      console.log(`\n▸ ${r.req}`);
      lastReq = r.req;
    }
    console.log(`   ${r.ok ? '✅' : '❌'} ${r.desc}`);
    if (!r.ok && r.detail) console.log(`       ${r.detail}`);
    r.ok ? pass++ : fail++;
  }
  console.log('\n------------------------------------------------------------');
  console.log(`  TOTAL: ${pass} PASS · ${fail} FAIL · ${rows.length} verificaciones`);
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\n[ERROR NO CONTROLADO]', err);
  try { await limpiar(); } catch (e) { console.error('limpieza:', e.message); }
  process.exit(1);
});
