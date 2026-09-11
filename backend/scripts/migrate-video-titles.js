/**
 * ============================================================================
 * scripts/migrate-video-titles.js  —  EJECUCIÓN MANUAL, UNA SOLA VEZ
 * ============================================================================
 *
 * Simplifica el modelo de títulos de video (ver CLAUDE.md, sección
 * "Ajuste al modelo de video — simplificación de títulos + director"):
 *
 *   - Elimina el campo `english_title` (redundante con `alternative_titles[]`).
 *   - Antes de borrarlo, para cada película: si `english_title` tenía un
 *     valor distinto de `display_title`/`original_title` y NO estaba ya en
 *     `alternative_titles[]`, se agrega ahí — ningún dato se pierde.
 *   - Agrega `director` (string) con el director real de cada película,
 *     tomado del mapa DIRECTORS de abajo (investigado, dato real verificable,
 *     no inventado).
 *   - Recalcula `all_titles`/`search_titles` con `videoService.buildAllTitles`
 *     / `buildSearchTitles` YA actualizados (sin `english_title`).
 *
 * Uso:
 *   node scripts/migrate-video-titles.js             (DRY-RUN: solo reporta, no escribe nada)
 *   node scripts/migrate-video-titles.js --apply      (migra los videos)
 *
 * IDEMPOTENTE: si un video ya no tiene `english_title` (migración previa),
 * se saltea (salvo que le falte `director`, en cuyo caso solo se le agrega
 * el director sin tocar títulos).
 *
 * VERIFICACIÓN ESTRICTA POR PELÍCULA: tras cada `update` se relee el
 * documento YA GUARDADO en CouchDB (no lo que `update` devuelve en memoria)
 * y se compara contra lo esperado: `english_title` ausente, `director`
 * presente, y CADA título que tenía `english_title` presente en
 * `alternative_titles[]`. Si algo no cuadra, se aborta con el detalle del
 * video afectado — nunca se sigue en silencio.
 * ============================================================================
 */

require('dotenv').config();
const { db } = require('../config/db');
const videoRepo = require('../repositories/videoRepository');
const videoService = require('../services/videoService');

const APPLY = process.argv.includes('--apply');

// Director real de cada película (verificado), por `display_title`. Se usa
// `display_title` como clave porque para este catálogo ya es único (ver
// verificación de unicidad hecha antes de escribir este script).
const DIRECTORS = {
  'Waltz with Bashir': 'Ari Folman',
  'No Country for Old Men': 'Joel Coen, Ethan Coen',
  'Mulholland Drive': 'David Lynch',
  'Man on Wire': 'James Marsh',
  'Free Solo': 'Elizabeth Chai Vasarhelyi, Jimmy Chin',
  Nightcrawler: 'Dan Gilroy',
  Persepolis: 'Marjane Satrapi, Vincent Paronnaud',
  'Little Miss Sunshine': 'Jonathan Dayton, Valerie Faris',
  'La La Land': 'Damien Chazelle',
  Zodiac: 'David Fincher',
  'True Grit': 'Joel Coen, Ethan Coen',
  'Searching for Sugar Man': 'Malik Bendjelloul',
  'Blade Runner 2049': 'Denis Villeneuve',
  'The Tree of Life': 'Terrence Malick',
  Whiplash: 'Damien Chazelle',
  'WALL·E': 'Andrew Stanton',
  'A Prophet': 'Jacques Audiard',
  'Uncle Boonmee Who Can Recall His Past Lives': 'Apichatpong Weerasethakul',
  'Life of Pi': 'Ang Lee',
  'The Assassination of Jesse James by the Coward Robert Ford': 'Andrew Dominik',
  'The Square': 'Ruben Östlund',
  Roma: 'Alfonso Cuarón',
  'The Theory of Everything': 'James Marsh',
  Parasite: 'Bong Joon-ho',
  'In Bruges': 'Martin McDonagh',
  'Portrait of a Lady on Fire': 'Céline Sciamma',
  'Les Misérables': 'Tom Hooper',
  'Under the Skin': 'Jonathan Glazer',
  Arrival: 'Denis Villeneuve',
  'Children of Men': 'Alfonso Cuarón',
  Aftersun: 'Charlotte Wells',
  'Lady Bird': 'Greta Gerwig',
  'The Witch': 'Robert Eggers',
  "Pan's Labyrinth": 'Guillermo del Toro',
  Nomadland: 'Chloé Zhao',
  'Black Swan': 'Darren Aronofsky',
  'Call Me by Your Name': 'Luca Guadagnino',
  '12 Years a Slave': 'Steve McQueen',
  Oldboy: 'Park Chan-wook',
  'The Shape of Water': 'Guillermo del Toro',
  Dunkirk: 'Christopher Nolan',
  'Three Billboards Outside Ebbing, Missouri': 'Martin McDonagh',
  'City of God': 'Fernando Meirelles, Kátia Lund',
  'Before Sunset': 'Richard Linklater',
  Annihilation: 'Alex Garland',
  'Memories of Murder': 'Bong Joon-ho',
  'Get Out': 'Jordan Peele',
  Dogtooth: 'Yorgos Lanthimos',
  'The Favourite': 'Yorgos Lanthimos',
  'The Lobster': 'Yorgos Lanthimos',
  Titane: 'Julia Ducournau',
  'The Dark Knight': 'Christopher Nolan',
  'Triangle of Sadness': 'Ruben Östlund',
  Drive: 'Nicolas Winding Refn',
  Prisoners: 'Denis Villeneuve',
  'The Power of the Dog': 'Jane Campion',
  'Brokeback Mountain': 'Ang Lee',
  'Jojo Rabbit': 'Taika Waititi',
  'Dancer in the Dark': 'Lars von Trier',
  'Drive My Car': 'Ryusuke Hamaguchi',
  1917: 'Sam Mendes',
  'The Fly': 'David Cronenberg',
  Hereditary: 'Ari Aster',
  Snowpiercer: 'Bong Joon-ho',
  'Mad Max: Fury Road': 'George Miller',
  'In the Mood for Love': 'Wong Kar-wai',
  'The Piano Teacher': 'Michael Haneke',
  'Spirited Away': 'Hayao Miyazaki',
  'The Death of Stalin': 'Armando Iannucci',
  'Eternal Sunshine of the Spotless Mind': 'Michel Gondry',
  'The Pianist': 'Roman Polanski',
  'A Star Is Born': 'Bradley Cooper',
  'The Lord of the Rings: The Fellowship of the Ring': 'Peter Jackson',
  Carol: 'Todd Haynes',
  'Spider-Man: Into the Spider-Verse': 'Bob Persichetti, Peter Ramsey, Rodney Rothman',
  'The Social Network': 'David Fincher',
  Moonlight: 'Barry Jenkins',
  'The Grand Budapest Hotel': 'Wes Anderson',
  'Another Round': 'Thomas Vinterberg',
  Boyhood: 'Richard Linklater',
};

async function main() {
  const videos = await videoRepo.list();
  console.log(`Videos encontrados: ${videos.length}`);

  const missingDirector = videos.filter((v) => !DIRECTORS[v.display_title]);
  if (missingDirector.length > 0) {
    console.error(
      'FALTA director en el mapa DIRECTORS para:',
      missingDirector.map((v) => v.display_title)
    );
    process.exit(1);
  }

  // Reporte previo: cuántos títulos en inglés se moverán a alternative_titles.
  let toMove = 0;
  const plan = videos.map((v) => {
    const already = new Set(v.alternative_titles || []);
    const english = (v.english_title || '').trim();
    const needsMove =
      english && english !== v.display_title && english !== v.original_title && !already.has(english);
    if (needsMove) toMove++;
    return { v, english, needsMove };
  });

  console.log(`Títulos en inglés a mover a alternative_titles[]: ${toMove}`);

  if (!APPLY) {
    console.log('\n[DRY-RUN] No se escribió nada. Ejecuta con --apply para migrar.');
    plan
      .filter((p) => p.needsMove)
      .forEach((p) => console.log(`  "${p.v.display_title}": english_title="${p.english}" -> alternative_titles[]`));
    return;
  }

  let migrated = 0;
  let alreadyMigrated = 0;
  const mismatches = [];

  for (const { v, english, needsMove } of plan) {
    const hasEnglishField = Object.prototype.hasOwnProperty.call(v, 'english_title');
    const hasDirector = !!v.director;

    if (!hasEnglishField && hasDirector) {
      alreadyMigrated++;
      continue;
    }

    const director = DIRECTORS[v.display_title];
    const expectedAlt = [...(v.alternative_titles || [])];
    if (needsMove) expectedAlt.push(english);
    const expectedAllTitles = videoService.buildAllTitles({
      display_title: v.display_title,
      original_title: v.original_title,
      alternative_titles: expectedAlt,
    });
    const expectedSearchTitles = videoService.buildSearchTitles(expectedAllTitles);

    await videoRepo.update(v._id, (doc) => {
      if (needsMove && !(doc.alternative_titles || []).includes(english)) {
        doc.alternative_titles = [...(doc.alternative_titles || []), english];
      }
      delete doc.english_title;
      doc.director = director;
      doc.all_titles = videoService.buildAllTitles(doc);
      doc.search_titles = videoService.buildSearchTitles(doc.all_titles);
      return doc;
    });

    // Verificación ESTRICTA: releer de CouchDB (no confiar en memoria).
    const fresh = await db.get(v._id);
    const sameArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
    const problems = [];
    if (Object.prototype.hasOwnProperty.call(fresh, 'english_title')) {
      problems.push('english_title todavía presente');
    }
    if (fresh.director !== director) {
      problems.push(`director esperado "${director}", quedó "${fresh.director}"`);
    }
    if (needsMove && !(fresh.alternative_titles || []).includes(english)) {
      problems.push(`título en inglés "${english}" no quedó en alternative_titles[]`);
    }
    if (!sameArr([...new Set(fresh.all_titles)], [...new Set(expectedAllTitles)])) {
      problems.push('all_titles no coincide con lo esperado');
    }
    if (!sameArr([...new Set(fresh.search_titles)], [...new Set(expectedSearchTitles)])) {
      problems.push('search_titles no coincide con lo esperado');
    }

    if (problems.length > 0) {
      mismatches.push({ id: v._id, title: v.display_title, problems });
      continue;
    }
    migrated++;
  }

  console.log(`\nVideos migrados y verificados: ${migrated}`);
  console.log(`Videos ya migrados de una corrida previa: ${alreadyMigrated}`);
  console.log(`Total cubierto: ${migrated + alreadyMigrated} / ${videos.length}`);
  console.log(`Títulos en inglés movidos a alternative_titles[]: ${toMove}`);
  console.log(`Videos con director asignado: ${videos.length} / ${videos.length} (todos, vía DIRECTORS)`);

  if (mismatches.length > 0) {
    console.error(`\n¡ALERTA! ${mismatches.length} video(s) no verificaron tras la migración:`);
    console.error(JSON.stringify(mismatches, null, 2));
    process.exit(1);
  }

  console.log('\nMigración completa: ningún título alternativo perdido (verificado 1 a 1).');
}

main().catch((e) => {
  console.error('Fallo la migración:', e);
  process.exit(1);
});
