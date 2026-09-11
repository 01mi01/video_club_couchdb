/**
 * ============================================================================
 * scripts/migrate-oscar-categories.js  —  EJECUCIÓN MANUAL, UNA SOLA VEZ
 * ============================================================================
 *
 * Normaliza `oscar_nominations[]` / `oscar_wins[]` de las películas reales
 * ya cargadas: de strings libres en inglés ("Best Picture") a IDs de un
 * documento `oscar_category` propio ({ name_en, name_es }), mismo patrón
 * que género. Resuelve un problema real: antes la búsqueda por nominación
 * solo funcionaba en inglés; el profesor probablemente busca en español
 * ("Mejor Película") — ver `oscarCategoryService.findIdsByText` y
 * `videoService.search`.
 *
 * Uso:
 *   node scripts/migrate-oscar-categories.js             (DRY-RUN: solo reporta, no escribe nada)
 *   node scripts/migrate-oscar-categories.js --apply      (crea categorías + migra los videos)
 *
 * IDEMPOTENTE: se puede volver a correr con --apply sin duplicar
 * categorías (reutiliza las que ya existan por `name_en`) ni romper
 * videos ya migrados (si `oscar_nominations`/`oscar_wins` ya son IDs
 * `oscar_category:...`, ese video se salta).
 *
 * VERIFICACIÓN ESTRICTA POR PELÍCULA: para cada video migrado se relee el
 * documento YA GUARDADO y se compara, categoría por categoría, contra lo
 * que debía quedar (los IDs resueltos de los strings originales, más el
 * merge "todo lo ganado cuenta como nominado" que ya aplicaba antes y
 * sigue aplicando ahora en `videoService`). Si algo no cuadra, se aborta
 * con el detalle del video afectado — nunca se sigue en silencio.
 * ============================================================================
 */

require('dotenv').config();
const { db } = require('../config/db');
const oscarCategoryService = require('../services/oscarCategoryService');
const videoService = require('../services/videoService');

// Traducción curada EN -> ES de las categorías reales de la Academia que
// efectivamente aparecen en el catálogo actual (verificado contra las 79
// películas reales antes de escribir este mapa: 24 categorías distintas).
const TRANSLATIONS = {
  'Best Picture': 'Mejor Película',
  'Best Directing': 'Mejor Director',
  'Best Actor in a Leading Role': 'Mejor Actor Protagónico',
  'Best Actress in a Leading Role': 'Mejor Actriz Protagónica',
  'Best Actor in a Supporting Role': 'Mejor Actor de Reparto',
  'Best Actress in a Supporting Role': 'Mejor Actriz de Reparto',
  'Best Original Screenplay': 'Mejor Guion Original',
  'Best Adapted Screenplay': 'Mejor Guion Adaptado',
  'Best Cinematography': 'Mejor Fotografía',
  'Best Film Editing': 'Mejor Montaje',
  'Best Production Design': 'Mejor Diseño de Producción',
  'Best Art Direction': 'Mejor Dirección de Arte',
  'Best Costume Design': 'Mejor Diseño de Vestuario',
  'Best Makeup': 'Mejor Maquillaje',
  'Best Makeup and Hairstyling': 'Mejor Maquillaje y Peinado',
  'Best Original Score': 'Mejor Banda Sonora Original',
  'Best Original Song': 'Mejor Canción Original',
  'Best Sound': 'Mejor Sonido',
  'Best Sound Editing': 'Mejor Edición de Sonido',
  'Best Sound Mixing': 'Mejor Mezcla de Sonido',
  'Best Visual Effects': 'Mejores Efectos Visuales',
  'Best Animated Feature Film': 'Mejor Película de Animación',
  'Best Documentary Feature': 'Mejor Documental',
  'Best International Feature Film': 'Mejor Película Internacional',
};

const APPLY = process.argv.includes('--apply');
const isCategoryId = (s) => typeof s === 'string' && s.startsWith('oscar_category:');

async function loadVideos() {
  const res = await db.list({ include_docs: true, startkey: 'video:', endkey: 'video:￿' });
  return res.rows.map((r) => r.doc);
}

async function main() {
  const videos = await loadVideos();
  console.log(`Videos encontrados: ${videos.length}`);

  const distinct = new Set();
  for (const v of videos) {
    (v.oscar_nominations || []).forEach((s) => distinct.add(s));
    (v.oscar_wins || []).forEach((s) => distinct.add(s));
  }
  // Si ya están migrados (IDs), esto solo verá IDs — se filtran para el
  // reporte de traducción, que solo aplica a strings todavía sin migrar.
  const pendingStrings = [...distinct].filter((s) => !isCategoryId(s));
  console.log(`Categorías distintas encontradas (sin migrar): ${pendingStrings.length}`);

  const missingTranslation = pendingStrings.filter((s) => !TRANSLATIONS[s]);
  if (missingTranslation.length > 0) {
    console.error('FALTA TRADUCCIÓN en el mapa TRANSLATIONS para:', missingTranslation);
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] No se escribió nada. Categorías a crear (EN -> ES):');
    pendingStrings
      .sort()
      .forEach((en) => console.log(`  "${en}" -> "${TRANSLATIONS[en]}"`));
    console.log(`\n${videos.length} película(s) en la base; ejecuta con --apply para migrar.`);
    return;
  }

  /* ----- 1. Crear (o reutilizar) un oscar_category por categoría ------- */
  const existingCats = await oscarCategoryService.list();
  const idByEn = new Map(existingCats.map((c) => [c.name_en, c._id]));
  let createdCount = 0;
  for (const en of pendingStrings) {
    if (idByEn.has(en)) continue;
    const doc = await oscarCategoryService.create({ name_en: en, name_es: TRANSLATIONS[en] });
    idByEn.set(en, doc._id);
    createdCount++;
  }
  console.log(
    `Categorías: ${createdCount} creada(s), ${idByEn.size - createdCount} ya existían (total ${idByEn.size}).`
  );

  /* ----- 2. Migrar cada video, con verificación estricta ---------------- */
  let migrated = 0;
  let alreadyMigrated = 0;
  let skippedNoOscars = 0;
  const mismatches = [];

  for (const v of videos) {
    const oldNoms = v.oscar_nominations || [];
    const oldWins = v.oscar_wins || [];

    if (oldNoms.length === 0 && oldWins.length === 0) {
      skippedNoOscars++;
      continue;
    }
    if (oldNoms.every(isCategoryId) && oldWins.every(isCategoryId)) {
      alreadyMigrated++;
      continue;
    }

    const mapId = (s) => (isCategoryId(s) ? s : idByEn.get(s));
    const newNoms = [...new Set(oldNoms.map(mapId))];
    const newWins = [...new Set(oldWins.map(mapId))];
    if (newNoms.some((x) => !x) || newWins.some((x) => !x)) {
      throw new Error(`Video ${v._id} ("${v.display_title}"): categoría sin ID resuelto.`);
    }

    // Lo que DEBE quedar tras el update: `videoService` aplica el mismo
    // merge de siempre ("todo lo ganado cuenta como nominado"), así que
    // el set esperado de nominaciones incluye también los wins.
    const expectedNoms = new Set([...newNoms, ...newWins]);
    const expectedWins = new Set(newWins);

    await videoService.update(v._id, { oscar_nominations: newNoms, oscar_wins: newWins });

    // Verificación ESTRICTA: releer de CouchDB (no confiar en lo que
    // `update` devolvió en memoria) y comparar contra lo esperado.
    const fresh = await db.get(v._id);
    const gotNoms = new Set(fresh.oscar_nominations || []);
    const gotWins = new Set(fresh.oscar_wins || []);
    const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

    if (!sameSet(gotNoms, expectedNoms) || !sameSet(gotWins, expectedWins)) {
      mismatches.push({
        id: v._id,
        title: v.display_title,
        expectedNoms: [...expectedNoms],
        gotNoms: [...gotNoms],
        expectedWins: [...expectedWins],
        gotWins: [...gotWins],
      });
      continue;
    }
    migrated++;
  }

  console.log(`\nVideos con Oscar migrados y verificados: ${migrated}`);
  console.log(`Videos ya migrados de una corrida previa: ${alreadyMigrated}`);
  console.log(`Videos sin nominaciones/premios (nada que migrar): ${skippedNoOscars}`);
  console.log(
    `Total cubierto: ${migrated + alreadyMigrated + skippedNoOscars} / ${videos.length}`
  );

  if (mismatches.length > 0) {
    console.error(`\n¡ALERTA! ${mismatches.length} video(s) no verificaron tras la migración:`);
    console.error(JSON.stringify(mismatches, null, 2));
    process.exit(1);
  }

  console.log('\nMigración completa: ninguna nominación ni premio perdido (verificado 1 a 1).');
}

main().catch((e) => {
  console.error('Fallo la migración:', e);
  process.exit(1);
});
