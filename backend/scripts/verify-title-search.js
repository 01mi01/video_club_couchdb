/**
 * ============================================================================
 * scripts/verify-title-search.js  —  VERIFICACIÓN de la búsqueda por nombre
 * ============================================================================
 *
 *     node scripts/verify-title-search.js
 *
 * Comprueba contra los DATOS REALES ya cargados que /api/videos/search
 * (title=...) cumple:
 *   1. Busca sobre TODOS los títulos (all_titles / search_titles), no solo
 *      el principal.
 *   2. Es insensible a mayúsculas/minúsculas.
 *   3. Es insensible a acentos: "nomadas" encuentra "Nómadas".
 *
 * Solo lee (usa videoService.search). No modifica nada.
 * ============================================================================
 */

require('dotenv').config();
const videoService = require('../services/videoService');

let ok = 0;
let fail = 0;

/** Ejecuta una búsqueda y verifica que `expectedTitle` esté (o no) entre los resultados. */
async function check(desc, query, expectedTitle, shouldMatch = true) {
  const res = await videoService.search(query);
  const titles = res.map((v) => v.display_title);
  const hit = titles.includes(expectedTitle);
  const pass = shouldMatch ? hit : !hit;
  if (pass) ok++; else fail++;
  console.log(
    `  [${pass ? 'OK  ' : 'FALLA'}] ${desc}\n` +
      `        query=${JSON.stringify(query)}  ->  ${titles.length ? titles.join(' | ') : '(vacío)'}` +
      (pass ? '' : `\n        SE ESPERABA ${shouldMatch ? 'encontrar' : 'NO encontrar'} "${expectedTitle}"`)
  );
}

async function main() {
  console.log('============================================================');
  console.log(' VERIFICACIÓN: búsqueda por nombre (title=)');
  console.log('============================================================');

  console.log('\n1) BUSCA SOBRE TODOS LOS TÍTULOS (no solo el principal)');
  // "Nomadland" tiene display_title inglés y alternativo español
  // "Nomadland: Tierra de nómadas".
  await check('por título principal en inglés', { title: 'Nomadland' }, 'Nomadland');
  await check('por fragmento del título alternativo en español', { title: 'Tierra de' }, 'Nomadland');
  // "Parasite": alternativo "Parásitos".
  await check('por título alternativo "Parásitos"', { title: 'Parásitos' }, 'Parasite');
  // "The Dark Knight": alternativo "El caballero de la noche".
  await check('por título alternativo "caballero de la noche"', { title: 'caballero de la noche' }, 'The Dark Knight');
  // "Memories of Murder": alternativo "Crónica de un asesino en serie".
  await check('por título alternativo "Crónica de un asesino"', { title: 'Crónica de un asesino' }, 'Memories of Murder');

  console.log('\n2) INSENSIBLE A MAYÚSCULAS / MINÚSCULAS');
  await check('todo mayúsculas', { title: 'PARASITE' }, 'Parasite');
  await check('todo minúsculas', { title: 'parasite' }, 'Parasite');
  await check('mayúsculas mixtas', { title: 'PaRaSiTe' }, 'Parasite');
  await check('mayúsculas en alternativo español', { title: 'PARÁSITOS' }, 'Parasite');

  console.log('\n3) INSENSIBLE A ACENTOS  (el punto que estaba roto)');
  await check('"nomadas" (sin tilde, minúscula) encuentra "…nómadas"', { title: 'nomadas' }, 'Nomadland');
  await check('"NÓMADAS" (mayúscula CON tilde)', { title: 'NÓMADAS' }, 'Nomadland');
  await check('"Tierra de Nomadas" (frase sin tilde)', { title: 'Tierra de Nomadas' }, 'Nomadland');
  await check('"parasitos" (sin tilde) encuentra "Parásitos"', { title: 'parasitos' }, 'Parasite');
  await check('"cronica" (sin tilde) encuentra "Crónica…"', { title: 'cronica' }, 'Memories of Murder');
  await check('"miserables" (sin tilde) encuentra "Misérables"', { title: 'miserables' }, 'Les Misérables');
  await check('"persepolis" (sin tilde) encuentra "Persépolis"', { title: 'persepolis' }, 'Persepolis');
  await check('"batallon" (sin tilde) encuentra "…Batallón de limpieza"', { title: 'batallon de limpieza' }, 'WALL·E');
  await check('acento AL REVÉS: "Cronica" con tilde encuentra el alternativo sin tilde', { title: 'crónica' }, 'Memories of Murder');

  console.log('\n4) CONTROL NEGATIVO (no debe traer basura)');
  await check('texto inexistente', { title: 'zzxq no existe pelicula' }, 'Nomadland', false);

  console.log('\n============================================================');
  console.log(`  ${ok}/${ok + fail} comprobaciones OK` + (fail ? `  |  ${fail} FALLA(S)` : ''));
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error('Error en la verificación:', err);
  process.exit(1);
});
