/**
 * Migración puntual: crea `idx-search-titles`, recalcula `search_titles`
 * en las películas ya cargadas y borra el índice viejo `idx-titles`.
 * Idempotente.
 *
 *     node scripts/backfill-search-titles.js
 */

require('dotenv').config();

const { db } = require('../config/db');
const videoRepo = require('../repositories/videoRepository');
const { buildAllTitles, buildSearchTitles } = require('../services/videoService');

async function main() {
  console.log('============================================================');
  console.log(' BACKFILL search_titles + índice idx-search-titles');
  console.log(` Base: ${process.env.COUCHDB_DB}`);
  console.log('============================================================');

  // 1) Índice nuevo (idempotente).
  const idxRes = await db.createIndex({
    index: { fields: ['search_titles'] },
    ddoc: 'idx-search-titles',
    name: 'idx-search-titles',
    type: 'json',
  });
  console.log(`\n[${idxRes.result}] índice idx-search-titles (campo: search_titles)`);

  // 2) Backfill de search_titles en cada película.
  const videos = await videoRepo.list();
  console.log(`\nPelículas a revisar: ${videos.length}`);

  let actualizadas = 0;
  let yaOk = 0;
  for (const v of videos) {
    // Recalcular desde los campos estructurados (robusto aunque all_titles
    // faltara o estuviera desactualizado).
    const allTitles = buildAllTitles(v);
    const searchTitles = buildSearchTitles(allTitles);

    const igual =
      Array.isArray(v.search_titles) &&
      v.search_titles.length === searchTitles.length &&
      v.search_titles.every((x, i) => x === searchTitles[i]) &&
      Array.isArray(v.all_titles) &&
      v.all_titles.length === allTitles.length &&
      v.all_titles.every((x, i) => x === allTitles[i]);

    if (igual) {
      yaOk++;
      continue;
    }

    await videoRepo.update(v._id, (doc) => {
      doc.all_titles = allTitles;
      doc.search_titles = searchTitles;
      return doc;
    });
    actualizadas++;
    console.log(`  [ok] "${v.display_title}"  search_titles=[${searchTitles.join(', ')}]`);
  }

  // 3) Eliminar el índice viejo idx-titles (ya no se usa).
  let idxViejo = 'no encontrado';
  try {
    const dd = await db.get('_design/idx-titles');
    await db.destroy(dd._id, dd._rev);
    idxViejo = 'eliminado';
  } catch (err) {
    idxViejo = err.statusCode === 404 ? 'no existía' : `error: ${err.message}`;
  }

  console.log('\n============================================================');
  console.log(` search_titles: ${actualizadas} actualizada(s), ${yaOk} ya estaban al día`);
  console.log(` índice viejo idx-titles: ${idxViejo}`);
  console.log('============================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fallo en el backfill:', err);
  process.exit(1);
});
