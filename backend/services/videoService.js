/**
 * ============================================================================
 * Servicio de VIDEOS (películas) — Gestión de Videos del enunciado
 * ============================================================================
 *
 *  1. Registrar un nuevo video (con géneros por ID, títulos alternativos,
 *     Oscars, actores, costo unitario y nº de unidades -> se generan las
 *     copias).
 *  2. Registrar nuevas copias para una película.
 *  3. Registrar bajas de copias (fecha + razón).
 *  + Búsqueda por nombre / género / actor / nominación al Oscar (índices
 *    Mango). MUY IMPORTANTE según el profesor.
 * ============================================================================
 */

const videoRepo = require('../repositories/videoRepository');
const genreRepo = require('../repositories/genreRepository');
const loanRepo = require('../repositories/loanRepository');
const { badRequest, notFound, conflict } = require('../utils/errors');

/* ---------------------------------------------------------------------------
 * Helpers de títulos
 * ------------------------------------------------------------------------- */

/**
 * Construye el arreglo plano `all_titles` (sin vacíos ni duplicados) a
 * partir de los campos estructurados. `all_titles` se conserva TAL CUAL
 * (con acentos y mayúsculas) para mostrarlo en la app / API.
 * La búsqueda NO se hace contra este campo, sino contra `search_titles`
 * (ver `foldForSearch` / `buildSearchTitles`).
 */
function buildAllTitles({ display_title, original_title, english_title, alternative_titles }) {
  const all = [display_title, original_title, english_title, ...(alternative_titles || [])]
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean);
  return [...new Set(all)];
}

/**
 * NORMALIZACIÓN PARA BÚSQUEDA POR NOMBRE  (problema complejo resuelto)
 * ---------------------------------------------------------------------------
 * CouchDB/Mango NO tiene búsqueda "collation-aware": `$regex` distingue
 * acentos ("nomadas" != "nómadas") y no existe un operador que haga
 * *folding* de diacríticos. `(?i)` solo cubre mayúsculas/minúsculas.
 *
 * Como el enunciado exige buscar películas por nombre y el español usa
 * acentos constantemente, se resuelve DENORMALIZANDO: en cada escritura se
 * calcula `search_titles` = cada título de `all_titles` pasado por
 * `foldForSearch` (Unicode NFD -> se quitan las marcas diacríticas
 * combinantes U+0300–U+036F -> minúsculas -> espacios colapsados). La
 * consulta aplica EXACTAMENTE la misma transformación al texto buscado y
 * hace un `$regex` de subcadena contra `search_titles`. Así "nomadas",
 * "NÓMADAS" y "Nómadas" caen todas en la misma forma canónica.
 *
 * Es el mismo patrón que ya se usaba con `all_titles` (aplanar varios
 * campos en un arreglo indexable), llevado un paso más allá para que la
 * comparación sea insensible a acentos y a mayúsculas.
 *
 * NOTA (Parte A: Consistencia): `search_titles` es un campo derivado que
 * se recalcula en la aplicación en cada `create`/`update`; el índice Mango
 * sobre él se reconstruye de forma asíncrona -> consistencia eventual.
 */
function foldForSearch(s) {
  return String(s || '')
    .normalize('NFD') // separa cada letra acentuada en letra base + marca combinante
    .replace(/\p{M}/gu, '') // elimina esas marcas: á->a, ñ->n, ü->u, é->e ...
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** `all_titles` -> forma canónica para búsqueda (sin acentos, minúsculas). */
function buildSearchTitles(allTitles) {
  return [...new Set((allTitles || []).map(foldForSearch).filter(Boolean))];
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ---------------------------------------------------------------------------
 * Validación y normalización de entrada
 * ------------------------------------------------------------------------- */

async function normalizeVideoInput(body, { partial = false } = {}) {
  const out = {};

  // --- Títulos ---
  const display_title = (body.display_title || '').trim();
  if (!partial && !display_title) throw badRequest('`display_title` es obligatorio.');
  if (display_title || !partial) {
    out.display_title = display_title;
    out.original_title = (body.original_title || '').trim() || display_title;
    out.original_language = (body.original_language || '').trim() || null;
    out.english_title = (body.english_title || '').trim() || null;
    out.alternative_titles = Array.isArray(body.alternative_titles)
      ? body.alternative_titles.map((t) => String(t).trim()).filter(Boolean)
      : [];
    out.all_titles = buildAllTitles(out); // para mostrar (con acentos)
    out.search_titles = buildSearchTitles(out.all_titles); // para buscar (sin acentos, minúsculas)
  }

  // --- Duración ---
  if (body.duration_minutes !== undefined) {
    const d = Number(body.duration_minutes);
    if (!Number.isFinite(d) || d <= 0) throw badRequest('`duration_minutes` debe ser > 0.');
    out.duration_minutes = d;
  } else if (!partial) {
    throw badRequest('`duration_minutes` es obligatorio.');
  }

  // --- Géneros (referencia a documentos normalizados) ---
  if (body.genre_ids !== undefined || !partial) {
    const ids = Array.isArray(body.genre_ids) ? [...new Set(body.genre_ids)] : [];
    if (ids.length === 0) throw badRequest('`genre_ids` debe tener al menos un género.');
    // Se valida que cada género exista: CouchDB no tiene claves foráneas.
    for (const gid of ids) {
      const g = await genreRepo.tryGetById(gid);
      if (!g || g.type !== 'genre') throw badRequest(`Género inexistente: ${gid}`);
    }
    out.genre_ids = ids;
  }

  // --- Año ---
  if (body.release_year !== undefined) {
    const y = Number(body.release_year);
    if (!Number.isInteger(y) || y < 1888 || y > 2100) {
      throw badRequest('`release_year` fuera de rango.');
    }
    out.release_year = y;
  } else if (!partial) {
    throw badRequest('`release_year` es obligatorio.');
  }

  // --- Oscars: arreglos planos de categorías (indexables) ---
  if (body.oscar_nominations !== undefined || !partial) {
    out.oscar_nominations = Array.isArray(body.oscar_nominations)
      ? body.oscar_nominations.map((s) => String(s).trim()).filter(Boolean)
      : [];
  }
  if (body.oscar_wins !== undefined || !partial) {
    out.oscar_wins = Array.isArray(body.oscar_wins)
      ? body.oscar_wins.map((s) => String(s).trim()).filter(Boolean)
      : [];
  }
  // Coherencia: todo lo ganado tuvo que ser nominado.
  if (out.oscar_wins && out.oscar_nominations) {
    const noms = new Set(out.oscar_nominations);
    for (const w of out.oscar_wins) {
      if (!noms.has(w)) out.oscar_nominations.push(w);
    }
  }

  // --- Actores: arreglo plano de strings (indexable para búsqueda) ---
  if (body.main_actors !== undefined || !partial) {
    out.main_actors = Array.isArray(body.main_actors)
      ? body.main_actors.map((s) => String(s).trim()).filter(Boolean)
      : [];
    if (!partial && out.main_actors.length === 0) {
      throw badRequest('`main_actors` debe tener al menos un actor.');
    }
  }

  // --- Costo unitario del DVD ---
  if (body.unit_cost !== undefined) {
    const c = Number(body.unit_cost);
    if (!Number.isFinite(c) || c < 0) throw badRequest('`unit_cost` debe ser >= 0.');
    out.unit_cost = c;
  } else if (!partial) {
    throw badRequest('`unit_cost` es obligatorio.');
  }

  return out;
}

/* ---------------------------------------------------------------------------
 * Copias (embebidas en el documento del video)
 * ------------------------------------------------------------------------- */

function makeCopies(count, startSeq, acquisitionDate) {
  const copies = [];
  for (let i = 0; i < count; i++) {
    copies.push({
      copy_id: `c${startSeq + i}`,
      acquisition_date: acquisitionDate,
      status: 'available',
      retirement: null,
    });
  }
  return copies;
}

/* ---------------------------------------------------------------------------
 * Casos de uso
 * ------------------------------------------------------------------------- */

/** 1. Registrar un nuevo video. Genera `units_acquired` copias iniciales. */
async function create(body) {
  const data = await normalizeVideoInput(body, { partial: false });

  const units = Number(body.units_acquired);
  if (!Number.isInteger(units) || units < 1) {
    throw badRequest('`units_acquired` (nº de unidades adquiridas) debe ser entero >= 1.');
  }
  const acqDate = body.acquisition_date || new Date().toISOString();

  data.units_acquired = units;
  data.copy_seq = units; // último correlativo de copia usado
  data.copies = makeCopies(units, 1, acqDate);

  return videoRepo.create(data);
}

async function list(opts) {
  return videoRepo.list(opts);
}

async function getById(id) {
  return videoRepo.getById(id);
}

/** Actualiza metadatos. NUNCA toca `copies` / `copy_seq` (eso va por sus
 *  propios endpoints), para no pisar el estado de las copias por una
 *  edición de metadatos concurrente. */
async function update(id, body) {
  const patch = await normalizeVideoInput(body, { partial: true });
  return videoRepo.update(id, (doc) => {
    Object.assign(doc, patch);
    // Si cambió algún título, `all_titles` (para mostrar) y `search_titles`
    // (forma canónica sin acentos, para buscar) se reconstruyen con los
    // valores ya fusionados en el documento.
    doc.all_titles = buildAllTitles(doc);
    doc.search_titles = buildSearchTitles(doc.all_titles);
    return doc;
  });
}

/** 2. Registrar nuevas copias para una película. */
async function addCopies(id, body) {
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1) {
    throw badRequest('`count` debe ser un entero >= 1.');
  }
  const acqDate = body.acquisition_date || new Date().toISOString();

  return videoRepo.update(id, (doc) => {
    const startSeq = (doc.copy_seq || doc.copies.length) + 1;
    const nuevas = makeCopies(count, startSeq, acqDate);
    doc.copies.push(...nuevas);
    doc.copy_seq = startSeq + count - 1;
    doc.units_acquired = (doc.units_acquired || 0) + count;
    return doc;
  });
}

/**
 * 3. Registrar la BAJA de una copia (fecha + razón).
 *
 * Casos (el enunciado exige explícitamente la razón "no devuelto"):
 *
 *  - Copia DISPONIBLE  -> baja directa (un solo documento).
 *  - Copia PRESTADA + razón de NO DEVOLUCIÓN ("no devuelto", "not
 *    returned", "perdida"...) -> es la salida manual para un préstamo
 *    vencido que nunca volvió: se delega en
 *    `loanService.writeOffUnreturned`, que da de baja la copia Y cierra el
 *    préstamo asociado como "unreturned" en una sola operación
 *    `_bulk_docs` (video + préstamo + factura). Sin esto quedaría un
 *    préstamo "active" apuntando a una copia "retired" -> inconsistencia.
 *  - Copia PRESTADA + cualquier otra razón (p.ej. "robo") -> se sigue
 *    exigiendo registrar antes la devolución: una copia que físicamente
 *    está con un cliente no se "roba" del videoclub.
 *
 * NOTA: NINGÚN proceso automático da de baja copias. Un préstamo vencido
 * permanece "active" y su copia "loaned" hasta que el propietario ejecuta
 * una de las dos salidas manuales (devolución tardía o esta baja).
 */
// Se compara contra la razón YA PLEGADA (sin acentos, minúsculas) para que
// "pérdida", "no devolución", "extraviada" también cuenten como no devolución.
const NO_RETURN_REASON = /no\s*devuelt|not\s*returned|sin\s*devoluci|no\s*devoluci|perdid|extravi|lost/i;

async function retireCopy(id, copyId, body) {
  const reason = (body.reason || '').trim();
  if (!reason) throw badRequest('La baja requiere `reason` (no devuelto, robo, etc.).');
  const date = body.date || new Date().toISOString();
  const isNoReturn = NO_RETURN_REASON.test(foldForSearch(reason));

  // Lectura previa para decidir el camino (disponible vs prestada).
  const video = await videoRepo.getById(id);
  const copy = (video.copies || []).find((c) => c.copy_id === copyId);
  if (!copy) throw notFound(`Copia ${copyId} no existe en el video ${id}.`);
  if (copy.status === 'retired') {
    throw conflict(`La copia ${copyId} ya está dada de baja.`);
  }

  if (copy.status === 'loaned') {
    if (!isNoReturn) {
      throw conflict(
        `La copia ${copyId} está prestada. Registra su devolución antes de darla de baja ` +
          `(salvo que la razón sea "no devuelto").`
      );
    }
    // Buscar el préstamo activo que tiene esta copia y cerrarlo como no
    // devuelto. `require` diferido para no crear ciclo de módulos.
    const loans = await loanRepo.listLoans();
    const loan = loans.find(
      (l) =>
        l.status === 'active' &&
        (l.items || []).some((it) => it.video_id === id && it.copy_id === copyId)
    );
    if (loan) {
      const loanService = require('./loanService');
      return loanService.writeOffUnreturned(loan._id, { reason, date });
    }
    // Copia "loaned" sin préstamo activo asociado (inconsistencia previa):
    // se da de baja igual, best-effort.
  }

  return videoRepo.update(id, (doc) => {
    const c = (doc.copies || []).find((x) => x.copy_id === copyId);
    if (!c) throw notFound(`Copia ${copyId} no existe en el video ${id}.`);
    if (c.status === 'retired') throw conflict(`La copia ${copyId} ya está dada de baja.`);
    c.status = 'retired';
    c.retirement = { date, reason };
    return doc;
  });
}

/* ---------------------------------------------------------------------------
 * BÚSQUEDA con índices Mango  (requerimiento explícito del profesor)
 * ------------------------------------------------------------------------- *
 * Cada parámetro se resuelve contra el índice creado a propósito en
 * `scripts/create-indexes.js`. Se pasa `use_index` para que la elección
 * del índice sea DETERMINISTA y demostrable en el video (y no dependa del
 * query planner de CouchDB).
 *
 * Si se combinan varios criterios, Mango usa UN índice y filtra el resto
 * en memoria: es una limitación real del motor y conviene mencionarla.
 * ------------------------------------------------------------------------- */
async function search(query) {
  const { title, genreId, actor, oscarNomination, oscarNominated } = query;
  const and = [];
  let useIndex;

  if (title && title.trim()) {
    // Índice: idx-search-titles sobre `search_titles` -> búsqueda por NOMBRE.
    //
    // `search_titles` guarda cada título ya "plegado" (sin acentos, en
    // minúsculas). Se aplica la MISMA transformación (`foldForSearch`) al
    // texto buscado, así la comparación es insensible a acentos y a
    // mayúsculas: "nomadas", "NÓMADAS" y "Nómadas" buscan lo mismo.
    // Como ambos lados ya están en minúsculas y sin acentos, el `$regex`
    // es una simple coincidencia de subcadena (sin `(?i)`).
    const needle = foldForSearch(title);
    and.push({ search_titles: { $elemMatch: { $regex: escapeRegex(needle) } } });
    useIndex = useIndex || 'idx-search-titles';
  }
  if (genreId && genreId.trim()) {
    // Índice: idx-genres  sobre `genre_ids`  -> búsqueda por GÉNERO
    // (por ID del documento de género normalizado).
    and.push({ genre_ids: { $elemMatch: { $eq: genreId.trim() } } });
    useIndex = useIndex || 'idx-genres';
  }
  if (actor && actor.trim()) {
    // Índice: idx-actors  sobre `main_actors`  -> búsqueda por ACTOR.
    and.push({ main_actors: { $elemMatch: { $regex: `(?i)${escapeRegex(actor.trim())}` } } });
    useIndex = useIndex || 'idx-actors';
  }
  if (oscarNomination && oscarNomination.trim()) {
    // Índice: idx-oscar-nominations sobre `oscar_nominations` -> búsqueda
    // por NOMINACIÓN al Oscar (por categoría).
    and.push({
      oscar_nominations: { $elemMatch: { $regex: `(?i)${escapeRegex(oscarNomination.trim())}` } },
    });
    useIndex = useIndex || 'idx-oscar-nominations';
  } else if (oscarNominated === 'true' || oscarNominated === true) {
    // "Películas que tuvieron alguna nominación al Oscar".
    and.push({ oscar_nominations: { $elemMatch: { $gt: null } } });
    useIndex = useIndex || 'idx-oscar-nominations';
  }

  if (and.length === 0) {
    throw badRequest(
      'Indica al menos un criterio: title, genreId, actor, oscarNomination u oscarNominated=true.'
    );
  }

  const selector = and.length === 1 ? and[0] : { $and: and };
  // `?limit=` opcional: ausente / vacío / no numérico => 100 por defecto.
  // `Number('') || 100` y `Number('abc') || 100` resuelven a 100, así que
  // aquí nunca se propaga `undefined`/`NaN` a la consulta Mango. Tope 500
  // (búsqueda puede querer más resultados que un listado normal).
  const limit = Math.min(Number(query.limit) || 100, 500);

  return videoRepo.find(selector, { use_index: useIndex, limit });
}

module.exports = {
  create,
  list,
  getById,
  update,
  addCopies,
  retireCopy,
  search,
  // exportado para pruebas manuales / reuso y para el backfill
  // (`scripts/backfill-search-titles.js`) — fuente única de la lógica de
  // plegado, para que la forma guardada y la forma buscada nunca difieran.
  buildAllTitles,
  buildSearchTitles,
  foldForSearch,
};
