/**
 * Servicio de VIDEOS (películas).
 *   1. Registrar un video (géneros por ID, títulos, Oscars, actores,
 *      costo unitario y nº de unidades -> genera las copias).
 *   2. Registrar nuevas copias.
 *   3. Dar de baja copias (fecha + razón).
 *   + Búsqueda por nombre / género / actor / nominación al Oscar (índices Mango).
 */

const videoRepo = require('../repositories/videoRepository');
const genreRepo = require('../repositories/genreRepository');
const oscarCategoryRepo = require('../repositories/oscarCategoryRepository');
const oscarCategoryService = require('./oscarCategoryService');
const loanRepo = require('../repositories/loanRepository');
const { foldForSearch } = require('../utils/textFold');
const { badRequest, notFound, conflict } = require('../utils/errors');

/**
 * `all_titles` (para mostrar, con acentos) a partir de los campos
 * estructurados. La búsqueda usa `search_titles` (ver `buildSearchTitles`),
 * no este campo.
 */
function buildAllTitles({ display_title, original_title, alternative_titles }) {
  const all = [display_title, original_title, ...(alternative_titles || [])]
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean);
  return [...new Set(all)];
}

/**
 * `all_titles` plegado (Unicode NFD, sin diacríticos, minúsculas) para
 * búsqueda insensible a acentos — Mango `$regex` no hace folding. Ver
 * `foldForSearch` en utils/textFold.js.
 */
function buildSearchTitles(allTitles) {
  return [...new Set((allTitles || []).map(foldForSearch).filter(Boolean))];
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resuelve IDs de `oscar_category`, validando que existan y que una
 * categoría inactiva no se pueda asignar a un video nuevo (conservarla en
 * una edición sí se permite). Mismo patrón que `genre_ids` más abajo.
 */
async function resolveCategoryIds(rawIds, existingIds = []) {
  const ids = Array.isArray(rawIds) ? [...new Set(rawIds)] : [];
  const existingSet = new Set(existingIds);
  for (const cid of ids) {
    const cat = await oscarCategoryRepo.tryGetById(cid);
    if (!cat || cat.type !== 'oscar_category') {
      throw badRequest(`Categoría de Oscar inexistente: ${cid}`);
    }
    if (cat.active === false && !existingSet.has(cid)) {
      throw badRequest(
        `La categoría de Oscar "${cat.name_es}" está inactiva: no se puede asignar a películas nuevas ni agregar en una edición.`
      );
    }
  }
  return ids;
}

async function normalizeVideoInput(
  body,
  {
    partial = false,
    existingGenreIds = [],
    existingOscarNominationIds = [],
    existingOscarWinIds = [],
  } = {}
) {
  const out = {};

  const display_title = (body.display_title || '').trim();
  if (!partial && !display_title) throw badRequest('`display_title` es obligatorio.');
  if (display_title || !partial) {
    out.display_title = display_title;
    out.original_title = (body.original_title || '').trim() || display_title;
    out.original_language = (body.original_language || '').trim() || null;
    out.alternative_titles = Array.isArray(body.alternative_titles)
      ? body.alternative_titles.map((t) => String(t).trim()).filter(Boolean)
      : [];
    out.all_titles = buildAllTitles(out);
    out.search_titles = buildSearchTitles(out.all_titles);
  }

  if (body.director !== undefined) {
    out.director = (body.director || '').trim() || null;
  }

  if (body.duration_minutes !== undefined) {
    const d = Number(body.duration_minutes);
    if (!Number.isFinite(d) || d <= 0) throw badRequest('`duration_minutes` debe ser > 0.');
    out.duration_minutes = d;
  } else if (!partial) {
    throw badRequest('`duration_minutes` es obligatorio.');
  }

  if (body.genre_ids !== undefined || !partial) {
    const ids = Array.isArray(body.genre_ids) ? [...new Set(body.genre_ids)] : [];
    if (ids.length === 0) throw badRequest('`genre_ids` debe tener al menos un género.');
    const existingSet = new Set(existingGenreIds);
    for (const gid of ids) {
      const g = await genreRepo.tryGetById(gid);
      if (!g || g.type !== 'genre') throw badRequest(`Género inexistente: ${gid}`);
      if (g.active === false && !existingSet.has(gid)) {
        throw badRequest(
          `El género "${g.name}" está inactivo: no se puede asignar a películas nuevas ni agregar en una edición.`
        );
      }
    }
    out.genre_ids = ids;
  }

  if (body.release_year !== undefined) {
    const y = Number(body.release_year);
    if (!Number.isInteger(y) || y < 1888 || y > 2100) {
      throw badRequest('`release_year` fuera de rango.');
    }
    out.release_year = y;
  } else if (!partial) {
    throw badRequest('`release_year` es obligatorio.');
  }

  // oscar_nominations/oscar_wins referencian oscar_category (no strings
  // libres) para que la búsqueda funcione en español e inglés.
  if (body.oscar_nominations !== undefined || !partial) {
    out.oscar_nominations = await resolveCategoryIds(
      body.oscar_nominations,
      existingOscarNominationIds
    );
  }
  if (body.oscar_wins !== undefined || !partial) {
    out.oscar_wins = await resolveCategoryIds(body.oscar_wins, existingOscarWinIds);
  }
  // Todo lo ganado cuenta también como nominado.
  if (out.oscar_wins && out.oscar_nominations) {
    const noms = new Set(out.oscar_nominations);
    for (const w of out.oscar_wins) {
      if (!noms.has(w)) out.oscar_nominations.push(w);
    }
  }

  if (body.main_actors !== undefined || !partial) {
    out.main_actors = Array.isArray(body.main_actors)
      ? body.main_actors.map((s) => String(s).trim()).filter(Boolean)
      : [];
    if (!partial && out.main_actors.length === 0) {
      throw badRequest('`main_actors` debe tener al menos un actor.');
    }
  }

  if (body.unit_cost !== undefined) {
    const c = Number(body.unit_cost);
    if (!Number.isFinite(c) || c < 0) throw badRequest('`unit_cost` debe ser >= 0.');
    out.unit_cost = c;
  } else if (!partial) {
    throw badRequest('`unit_cost` es obligatorio.');
  }

  return out;
}

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

/** 1. Registrar un nuevo video. Genera `units_acquired` copias iniciales. */
async function create(body) {
  const data = await normalizeVideoInput(body, { partial: false });

  const units = Number(body.units_acquired);
  if (!Number.isInteger(units) || units < 1) {
    throw badRequest('`units_acquired` (nº de unidades adquiridas) debe ser entero >= 1.');
  }
  const acqDate = body.acquisition_date || new Date().toISOString();

  data.units_acquired = units;
  data.copy_seq = units;
  data.copies = makeCopies(units, 1, acqDate);

  return videoRepo.create(data);
}

async function list(opts) {
  return videoRepo.list(opts);
}

async function getById(id) {
  return videoRepo.getById(id);
}

/** Actualiza metadatos. Nunca toca `copies`/`copy_seq` (van por sus propios
 *  endpoints), para no pisar el estado de las copias en una edición
 *  concurrente. */
async function update(id, body) {
  const current = await videoRepo.getById(id);
  const patch = await normalizeVideoInput(body, {
    partial: true,
    existingGenreIds: current.genre_ids || [],
    existingOscarNominationIds: current.oscar_nominations || [],
    existingOscarWinIds: current.oscar_wins || [],
  });
  return videoRepo.update(id, (doc) => {
    Object.assign(doc, patch);
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
 * 3. Dar de baja una copia (fecha + razón).
 * Estados: available -> loaned -> missing (recuperable) -> retired
 * (definitiva). Solo "daño irreparable" es definitiva desde el inicio.
 * Copia prestada + razón recuperable delega en
 * `loanService.writeOffUnreturned` (_bulk_docs con el préstamo).
 */
const PERMANENT_REASON = /da[ñn]o|irreparabl|destru|inservible|rot[ao]|quebrad/i;

async function retireCopy(id, copyId, body) {
  const reason = (body.reason || '').trim();
  if (!reason) throw badRequest('La baja requiere `reason` (no devuelto, robo, etc.).');
  const date = body.date || new Date().toISOString();
  const isNoReturn = !PERMANENT_REASON.test(foldForSearch(reason));

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
          `(salvo que la razón sea "no devuelto", "pérdida" o "robo").`
      );
    }
    const loans = await loanRepo.listLoans();
    const loan = loans.find(
      (l) =>
        l.status === 'active' &&
        (l.items || []).some((it) => it.video_id === id && it.copy_id === copyId)
    );
    if (loan) {
      const loanService = require('./loanService'); // require diferido: evita ciclo de módulos
      return loanService.writeOffUnreturned(loan._id, { reason, date });
    }
    // Copia "loaned" sin préstamo activo asociado (inconsistencia previa):
    // cae al camino "missing" de abajo, sin préstamo que cerrar.
  }

  if (copy.status === 'missing') {
    return videoRepo.update(id, (doc) => {
      const c = (doc.copies || []).find((x) => x.copy_id === copyId);
      if (!c) throw notFound(`Copia ${copyId} no existe en el video ${id}.`);
      if (c.status !== 'missing') throw conflict(`La copia ${copyId} ya no está "missing" (está "${c.status}").`);
      c.status = 'retired';
      c.retirement = { date, reason };
      return doc;
    });
  }

  return videoRepo.update(id, (doc) => {
    const c = (doc.copies || []).find((x) => x.copy_id === copyId);
    if (!c) throw notFound(`Copia ${copyId} no existe en el video ${id}.`);
    if (c.status === 'retired') throw conflict(`La copia ${copyId} ya está dada de baja.`);
    c.status = isNoReturn ? 'missing' : 'retired';
    c.retirement = { date, reason };
    return doc;
  });
}

/**
 * Recupera una copia "missing" que apareció: vuelve a "available". No
 * reabre el préstamo asociado (ver `loanService.returnLoan` para eso).
 */
async function recoverCopy(id, copyId) {
  return videoRepo.update(id, (doc) => {
    const c = (doc.copies || []).find((x) => x.copy_id === copyId);
    if (!c) throw notFound(`Copia ${copyId} no existe en el video ${id}.`);
    if (c.status !== 'missing') {
      throw conflict(
        `La copia ${copyId} no está en estado "missing" (está "${c.status}"); no hay nada que recuperar.`
      );
    }
    c.status = 'available';
    c.retirement = null;
    return doc;
  });
}

/**
 * Búsqueda por nombre / género / actor / nominación al Oscar, cada una
 * contra el índice Mango creado a propósito en `scripts/create-indexes.js`
 * (se pasa `use_index` para que la elección sea determinista). Si se
 * combinan varios criterios, Mango usa uno solo y filtra el resto en
 * memoria.
 */
async function search(query) {
  const { title, genreId, actor, oscarNomination, oscarNominated } = query;
  const and = [];
  let useIndex;

  if (title && title.trim()) {
    // idx-search-titles: mismo `foldForSearch` aplicado al texto buscado,
    // así "nomadas"/"NÓMADAS"/"Nómadas" caen en la misma forma canónica.
    const needle = foldForSearch(title);
    and.push({ search_titles: { $elemMatch: { $regex: escapeRegex(needle) } } });
    useIndex = useIndex || 'idx-search-titles';
  }
  if (genreId && genreId.trim()) {
    and.push({ genre_ids: { $elemMatch: { $eq: genreId.trim() } } }); // idx-genres
    useIndex = useIndex || 'idx-genres';
  }
  if (actor && actor.trim()) {
    and.push({ main_actors: { $elemMatch: { $regex: `(?i)${escapeRegex(actor.trim())}` } } }); // idx-actors
    useIndex = useIndex || 'idx-actors';
  }
  if (oscarNomination && oscarNomination.trim()) {
    // Traduce el texto (ES o EN) a IDs de oscar_category antes de
    // consultar Mango — ver oscarCategoryService.findIdsByText.
    const categoryIds = await oscarCategoryService.findIdsByText(oscarNomination.trim());
    if (categoryIds.length === 0) return [];
    and.push({ oscar_nominations: { $elemMatch: { $in: categoryIds } } });
    useIndex = useIndex || 'idx-oscar-nominations';
  } else if (oscarNominated === 'true' || oscarNominated === true) {
    and.push({ oscar_nominations: { $elemMatch: { $gt: null } } });
    useIndex = useIndex || 'idx-oscar-nominations';
  }

  if (and.length === 0) {
    throw badRequest(
      'Indica al menos un criterio: title, genreId, actor, oscarNomination u oscarNominated=true.'
    );
  }

  const selector = and.length === 1 ? and[0] : { $and: and };
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
  recoverCopy,
  search,
  // Exportado para el backfill (scripts/backfill-search-titles.js): fuente
  // única de la lógica de plegado.
  buildAllTitles,
  buildSearchTitles,
  foldForSearch,
};
