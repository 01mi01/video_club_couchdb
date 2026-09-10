/**
 * ============================================================================
 * scripts/seed-movies.js  —  CARGA DE PELÍCULAS REALES (ejecución manual)
 * ============================================================================
 *
 * Autorizado por CLAUDE.md, sección "Contenido de datos — películas y
 * clientes" + regla de trabajo 2. NO son datos de prueba descartables:
 * es el catálogo real de la base.
 *
 *     node scripts/seed-movies.js
 *
 * QUÉ HACE
 *   1. Lee los géneros reales de la base (equivalente a GET /api/genres) y
 *      arma un mapa nombre -> _id. NO se inventan IDs.
 *   2. Crea cada película con `videoService.create(...)`, exactamente el
 *      mismo camino de validación/normalización que usa POST /api/videos
 *      (el servidor HTTP no se levanta; regla de trabajo 1).
 *   3. Es idempotente: si ya existe un video con el mismo `display_title` y
 *      `release_year`, lo salta (re-ejecutar no duplica).
 *   4. Al final informa cuántas películas quedaron por género y verifica el
 *      mínimo de 2 exigido por CLAUDE.md.
 *
 * CRITERIOS APLICADOS EN LA SELECCIÓN (CLAUDE.md)
 *   - Mínimo 2 películas por cada uno de los 28 géneros. Varias películas
 *     cuentan para más de un género vía `genre_ids[]` cuando aplica de
 *     verdad (p.ej. "Parasite" -> Suspenso + Comedia Negra + Drama +
 *     Sátira + Crimen).
 *   - Prioridad a cine premiado/nominado en Cannes cuando encaja con el
 *     género: Palma de Oro (Parasite, El árbol de la vida, El pianista,
 *     Dancer in the Dark, The Square, Triangle of Sadness, Tío Boonmee,
 *     Titane, Bailar en la oscuridad), premios de actuación/dirección
 *     (In the Mood for Love, La Pianiste, Mulholland Drive, Drive, Carol,
 *     Drive My Car), Un Certain Regard (Dogtooth), Gran Premio
 *     (Oldboy, Un prophète).
 *   - `oscar_nominations[]` / `oscar_wins[]` reales y verificables (es un
 *     requisito funcional explícito del profesor, no decorativo).
 *   - Mezcla deliberada: cine de autor / festivalero / slow cinema
 *     (Malick, Haneke, Weerasethakul, Wong Kar-wai, Hamaguchi, Tarr-adjacent)
 *     junto con títulos mainstream premiados (The Dark Knight, Mad Max:
 *     Fury Road, LOTR, La La Land, Dune-adjacent Villeneuve).
 *   - Nada en blanco y negro / nada anterior a 1986; sin gore de
 *     explotación (el body horror incluido es de autor: Cronenberg,
 *     Ducournau, Garland).
 *   - `units_acquired` variado entre 1 y 5 (no siempre el mismo número).
 * ============================================================================
 */

require('dotenv').config();

const genreRepo = require('../repositories/genreRepository');
const videoRepo = require('../repositories/videoRepository');
const videoService = require('../services/videoService');

/* ---------------------------------------------------------------------------
 * Catálogo. `g` = nombres de género tal como están en la base (el script
 * los traduce a IDs). `noms` = nominaciones Oscar que NO ganó; `wins` =
 * categorías Oscar ganadas (el servicio ya garantiza que todo lo ganado
 * conste también como nominación).
 * ------------------------------------------------------------------------- */
const MOVIES = [
  // ---------------- Distopía / Ciencia Ficción -------------------------------
  {
    t: 'Children of Men', ot: 'Children of Men', ol: 'Inglés', et: 'Children of Men',
    alt: ['Hijos de los hombres', 'Niños del hombre'], dur: 109, year: 2006,
    g: ['Distopía', 'Ciencia Ficción', 'Suspenso', 'Drama'],
    noms: ['Best Adapted Screenplay', 'Best Cinematography', 'Best Film Editing'], wins: [],
    cast: ['Clive Owen', 'Julianne Moore', 'Michael Caine', 'Chiwetel Ejiofor', 'Clare-Hope Ashitey'],
    cost: 25, units: 3,
  },
  {
    t: 'Snowpiercer', ot: 'Snowpiercer', ol: 'Inglés', et: 'Snowpiercer',
    alt: ['Rompenieves', '설국열차', 'Seolgungnyeolcha'], dur: 126, year: 2013,
    g: ['Distopía', 'Ciencia Ficción', 'Acción'],
    noms: [], wins: [],
    cast: ['Chris Evans', 'Song Kang-ho', 'Tilda Swinton', 'Ed Harris', 'Jamie Bell', 'Octavia Spencer'],
    cost: 20, units: 4,
  },
  {
    t: 'The Lobster', ot: 'The Lobster', ol: 'Inglés', et: 'The Lobster',
    alt: ['La langosta'], dur: 119, year: 2015,
    g: ['Distopía', 'Comedia Negra', 'Romance', 'Ciencia Ficción'],
    noms: ['Best Original Screenplay'], wins: [],
    cast: ['Colin Farrell', 'Rachel Weisz', 'Léa Seydoux', 'Ben Whishaw', 'John C. Reilly'],
    cost: 22, units: 2,
  },
  {
    t: 'Dogtooth', ot: 'Κυνόδοντας', ol: 'Griego', et: 'Dogtooth',
    alt: ['Kynodontas', 'Canino', 'Colmillo'], dur: 97, year: 2009,
    g: ['Distopía', 'Drama Psicológico', 'Comedia Negra', 'Auteur'],
    noms: ['Best International Feature Film'], wins: [],
    cast: ['Christos Stergioglou', 'Michele Valley', 'Angeliki Papoulia', 'Hristos Passalis', 'Mary Tsoni'],
    cost: 18, units: 2,
  },

  // ---------------- Romance ------------------------------------------------
  {
    t: 'In the Mood for Love', ot: '花樣年華', ol: 'Cantonés', et: 'In the Mood for Love',
    alt: ['Fa yeung nin wa', 'Deseando amar', 'Con ánimo de amar'], dur: 98, year: 2000,
    g: ['Romance', 'Drama', 'Auteur', 'Slow Cinema'],
    noms: [], wins: [],
    cast: ['Tony Leung Chiu-wai', 'Maggie Cheung', 'Rebecca Pan', 'Lai Chin'],
    cost: 24, units: 3,
  },
  {
    t: 'Portrait of a Lady on Fire', ot: 'Portrait de la jeune fille en feu', ol: 'Francés',
    et: 'Portrait of a Lady on Fire', alt: ['Retrato de una mujer en llamas'], dur: 122, year: 2019,
    g: ['Romance', 'Drama', 'Cine LGBTQ+', 'Drama Histórico', 'Auteur'],
    noms: [], wins: [],
    cast: ['Noémie Merlant', 'Adèle Haenel', 'Luàna Bajrami', 'Valeria Golino'],
    cost: 22, units: 2,
  },
  {
    t: 'Call Me by Your Name', ot: 'Call Me by Your Name', ol: 'Inglés', et: 'Call Me by Your Name',
    alt: ['Llámame por tu nombre', 'Chiamami col tuo nome'], dur: 132, year: 2017,
    g: ['Romance', 'Drama', 'Cine LGBTQ+', 'Coming-of-age'],
    noms: ['Best Picture', 'Best Actor in a Leading Role', 'Best Original Song'],
    wins: ['Best Adapted Screenplay'],
    cast: ['Timothée Chalamet', 'Armie Hammer', 'Michael Stuhlbarg', 'Amira Casar', 'Esther Garrel'],
    cost: 20, units: 3,
  },
  {
    t: 'Eternal Sunshine of the Spotless Mind', ot: 'Eternal Sunshine of the Spotless Mind',
    ol: 'Inglés', et: 'Eternal Sunshine of the Spotless Mind',
    alt: ['¡Olvídate de mí!', 'Eterno resplandor de una mente sin recuerdos'], dur: 108, year: 2004,
    g: ['Romance', 'Ciencia Ficción', 'Drama', 'Comedia'],
    noms: ['Best Actress in a Leading Role'], wins: ['Best Original Screenplay'],
    cast: ['Jim Carrey', 'Kate Winslet', 'Kirsten Dunst', 'Mark Ruffalo', 'Elijah Wood', 'Tom Wilkinson'],
    cost: 18, units: 3,
  },
  {
    t: 'Before Sunset', ot: 'Before Sunset', ol: 'Inglés', et: 'Before Sunset',
    alt: ['Antes del atardecer', 'Antes del anochecer'], dur: 80, year: 2004,
    g: ['Romance', 'Drama'],
    noms: ['Best Adapted Screenplay'], wins: [],
    cast: ['Ethan Hawke', 'Julie Delpy'],
    cost: 15, units: 2,
  },

  // ---------------- Drama Psicológico ------------------------------------
  {
    t: 'Black Swan', ot: 'Black Swan', ol: 'Inglés', et: 'Black Swan',
    alt: ['Cisne negro', 'El cisne negro'], dur: 108, year: 2010,
    g: ['Drama Psicológico', 'Terror', 'Suspenso', 'Drama'],
    noms: ['Best Picture', 'Best Directing', 'Best Cinematography', 'Best Film Editing'],
    wins: ['Best Actress in a Leading Role'],
    cast: ['Natalie Portman', 'Mila Kunis', 'Vincent Cassel', 'Barbara Hershey', 'Winona Ryder'],
    cost: 20, units: 4,
  },
  {
    t: 'The Piano Teacher', ot: 'La Pianiste', ol: 'Francés', et: 'The Piano Teacher',
    alt: ['La pianista', 'Die Klavierspielerin'], dur: 131, year: 2001,
    g: ['Drama Psicológico', 'Auteur', 'Drama'],
    noms: [], wins: [],
    cast: ['Isabelle Huppert', 'Benoît Magimel', 'Annie Girardot'],
    cost: 18, units: 2,
  },
  {
    t: 'Whiplash', ot: 'Whiplash', ol: 'Inglés', et: 'Whiplash',
    alt: ['Whiplash: Música y obsesión'], dur: 106, year: 2014,
    g: ['Drama Psicológico', 'Drama'],
    noms: ['Best Picture', 'Best Adapted Screenplay'],
    wins: ['Best Actor in a Supporting Role', 'Best Film Editing', 'Best Sound Mixing'],
    cast: ['Miles Teller', 'J.K. Simmons', 'Paul Reiser', 'Melissa Benoist'],
    cost: 20, units: 3,
  },

  // ---------------- Suspenso / Neo-noir / Crimen -----------------------------
  {
    t: 'Parasite', ot: '기생충', ol: 'Coreano', et: 'Parasite',
    alt: ['Gisaengchung', 'Parásitos'], dur: 132, year: 2019,
    g: ['Suspenso', 'Comedia Negra', 'Drama', 'Sátira', 'Crimen'],
    noms: ['Best Film Editing', 'Best Production Design'],
    wins: ['Best Picture', 'Best Directing', 'Best Original Screenplay', 'Best International Feature Film'],
    cast: ['Song Kang-ho', 'Lee Sun-kyun', 'Cho Yeo-jeong', 'Choi Woo-shik', 'Park So-dam', 'Jang Hye-jin'],
    cost: 30, units: 5,
  },
  {
    t: 'No Country for Old Men', ot: 'No Country for Old Men', ol: 'Inglés', et: 'No Country for Old Men',
    alt: ['Sin lugar para los débiles', 'No es país para viejos'], dur: 122, year: 2007,
    g: ['Suspenso', 'Neo-noir', 'Crimen', 'Western', 'Drama'],
    noms: ['Best Cinematography', 'Best Film Editing', 'Best Sound Editing', 'Best Sound Mixing'],
    wins: ['Best Picture', 'Best Directing', 'Best Adapted Screenplay', 'Best Actor in a Supporting Role'],
    cast: ['Tommy Lee Jones', 'Javier Bardem', 'Josh Brolin', 'Woody Harrelson', 'Kelly Macdonald'],
    cost: 22, units: 3,
  },
  {
    t: 'Prisoners', ot: 'Prisoners', ol: 'Inglés', et: 'Prisoners',
    alt: ['Prisioneros'], dur: 153, year: 2013,
    g: ['Suspenso', 'Misterio', 'Crimen', 'Drama'],
    noms: ['Best Cinematography'], wins: [],
    cast: ['Hugh Jackman', 'Jake Gyllenhaal', 'Viola Davis', 'Paul Dano', 'Melissa Leo', 'Terrence Howard'],
    cost: 18, units: 3,
  },
  {
    t: 'Zodiac', ot: 'Zodiac', ol: 'Inglés', et: 'Zodiac',
    alt: ['Zodíaco'], dur: 157, year: 2007,
    g: ['Misterio', 'Neo-noir', 'Crimen', 'Drama', 'Suspenso'],
    noms: [], wins: [],
    cast: ['Jake Gyllenhaal', 'Mark Ruffalo', 'Robert Downey Jr.', 'Anthony Edwards', 'Brian Cox', 'Chloë Sevigny'],
    cost: 18, units: 3,
  },
  {
    t: 'Memories of Murder', ot: '살인의 추억', ol: 'Coreano', et: 'Memories of Murder',
    alt: ['Salinui chueok', 'Crónica de un asesino en serie'], dur: 131, year: 2003,
    g: ['Misterio', 'Crimen', 'Drama', 'Suspenso'],
    noms: [], wins: [],
    cast: ['Song Kang-ho', 'Kim Sang-kyung', 'Kim Roi-ha', 'Park Hae-il', 'Byun Hee-bong'],
    cost: 18, units: 2,
  },
  {
    t: 'Mulholland Drive', ot: 'Mulholland Drive', ol: 'Inglés', et: 'Mulholland Drive',
    alt: ['Mulholland Dr.', 'El camino de los sueños'], dur: 147, year: 2001,
    g: ['Misterio', 'Neo-noir', 'Drama Psicológico', 'Auteur'],
    noms: ['Best Directing'], wins: [],
    cast: ['Naomi Watts', 'Laura Harring', 'Justin Theroux', 'Ann Miller'],
    cost: 20, units: 3,
  },
  {
    t: 'Drive', ot: 'Drive', ol: 'Inglés', et: 'Drive',
    alt: ['Drive: El escape'], dur: 100, year: 2011,
    g: ['Neo-noir', 'Acción', 'Crimen', 'Drama'],
    noms: ['Best Sound Editing'], wins: [],
    cast: ['Ryan Gosling', 'Carey Mulligan', 'Bryan Cranston', 'Albert Brooks', 'Oscar Isaac', 'Ron Perlman'],
    cost: 18, units: 3,
  },
  {
    t: 'Nightcrawler', ot: 'Nightcrawler', ol: 'Inglés', et: 'Nightcrawler',
    alt: ['Primicia mortal', 'El chico de las noticias'], dur: 117, year: 2014,
    g: ['Neo-noir', 'Suspenso', 'Crimen', 'Drama', 'Comedia Negra'],
    noms: ['Best Original Screenplay'], wins: [],
    cast: ['Jake Gyllenhaal', 'Rene Russo', 'Riz Ahmed', 'Bill Paxton'],
    cost: 16, units: 3,
  },

  // ---------------- Auteur / Slow Cinema ------------------------------------
  {
    t: 'The Tree of Life', ot: 'The Tree of Life', ol: 'Inglés', et: 'The Tree of Life',
    alt: ['El árbol de la vida'], dur: 139, year: 2011,
    g: ['Auteur', 'Drama', 'Slow Cinema'],
    noms: ['Best Picture', 'Best Directing', 'Best Cinematography'], wins: [],
    cast: ['Brad Pitt', 'Jessica Chastain', 'Sean Penn', 'Hunter McCracken'],
    cost: 20, units: 2,
  },
  {
    t: 'Roma', ot: 'Roma', ol: 'Español', et: 'Roma',
    alt: [], dur: 135, year: 2018,
    g: ['Auteur', 'Drama', 'Slow Cinema', 'Drama Histórico'],
    noms: ['Best Picture', 'Best Actress in a Leading Role', 'Best Actress in a Supporting Role',
      'Best Original Screenplay', 'Best Production Design', 'Best Sound Editing', 'Best Sound Mixing'],
    wins: ['Best Directing', 'Best Cinematography', 'Best International Feature Film'],
    cast: ['Yalitza Aparicio', 'Marina de Tavira', 'Diego Cortina Autrey', 'Nancy García García'],
    cost: 22, units: 3,
  },
  {
    t: 'Uncle Boonmee Who Can Recall His Past Lives', ot: 'ลุงบุญมีระลึกชาติ', ol: 'Tailandés',
    et: 'Uncle Boonmee Who Can Recall His Past Lives',
    alt: ['Lung Bunmi Raluek Chat', 'El tío Boonmee que recuerda sus vidas pasadas'], dur: 114, year: 2010,
    g: ['Slow Cinema', 'Fantasía', 'Drama', 'Auteur'],
    noms: [], wins: [],
    cast: ['Thanapat Saisaymar', 'Jenjira Pongpas', 'Sakda Kaewbuadee', 'Natthakarn Aphaiwonk'],
    cost: 15, units: 1,
  },
  {
    t: 'Nomadland', ot: 'Nomadland', ol: 'Inglés', et: 'Nomadland',
    alt: ['Nomadland: Tierra de nómadas'], dur: 107, year: 2020,
    g: ['Slow Cinema', 'Drama', 'Auteur'],
    noms: ['Best Adapted Screenplay', 'Best Cinematography', 'Best Film Editing'],
    wins: ['Best Picture', 'Best Directing', 'Best Actress in a Leading Role'],
    cast: ['Frances McDormand', 'David Strathairn', 'Linda May', 'Charlene Swankie'],
    cost: 18, units: 3,
  },
  {
    t: 'Drive My Car', ot: 'ドライブ・マイ・カー', ol: 'Japonés', et: 'Drive My Car',
    alt: ['Doraibu mai kā'], dur: 179, year: 2021,
    g: ['Slow Cinema', 'Drama', 'Auteur'],
    noms: ['Best Picture', 'Best Directing', 'Best Adapted Screenplay'],
    wins: ['Best International Feature Film'],
    cast: ['Hidetoshi Nishijima', 'Tôko Miura', 'Masaki Okada', 'Reika Kirishima'],
    cost: 16, units: 2,
  },

  // ---------------- Ciencia Ficción (adicionales) --------------------------
  {
    t: 'Arrival', ot: 'Arrival', ol: 'Inglés', et: 'Arrival',
    alt: ['La llegada'], dur: 116, year: 2016,
    g: ['Ciencia Ficción', 'Drama', 'Misterio'],
    noms: ['Best Picture', 'Best Directing', 'Best Adapted Screenplay', 'Best Cinematography',
      'Best Production Design', 'Best Film Editing', 'Best Sound Mixing'],
    wins: ['Best Sound Editing'],
    cast: ['Amy Adams', 'Jeremy Renner', 'Forest Whitaker', 'Michael Stuhlbarg'],
    cost: 22, units: 4,
  },
  {
    t: 'Blade Runner 2049', ot: 'Blade Runner 2049', ol: 'Inglés', et: 'Blade Runner 2049',
    alt: ['Blade Runner 2049: El futuro ya llegó'], dur: 164, year: 2017,
    g: ['Ciencia Ficción', 'Neo-noir', 'Drama', 'Suspenso'],
    noms: ['Best Production Design', 'Best Sound Editing', 'Best Sound Mixing'],
    wins: ['Best Cinematography', 'Best Visual Effects'],
    cast: ['Ryan Gosling', 'Harrison Ford', 'Ana de Armas', 'Sylvia Hoeks', 'Robin Wright', 'Jared Leto'],
    cost: 25, units: 4,
  },
  {
    t: 'Under the Skin', ot: 'Under the Skin', ol: 'Inglés', et: 'Under the Skin',
    alt: ['Bajo la piel'], dur: 108, year: 2013,
    g: ['Ciencia Ficción', 'Terror', 'Auteur', 'Slow Cinema'],
    noms: [], wins: [],
    cast: ['Scarlett Johansson'],
    cost: 16, units: 2,
  },

  // ---------------- Terror --------------------------------------------------
  {
    t: 'Hereditary', ot: 'Hereditary', ol: 'Inglés', et: 'Hereditary',
    alt: ['El legado del diablo', 'Hereditary: El legado del diablo'], dur: 127, year: 2018,
    g: ['Terror', 'Drama Psicológico'],
    noms: [], wins: [],
    cast: ['Toni Collette', 'Alex Wolff', 'Milly Shapiro', 'Gabriel Byrne', 'Ann Dowd'],
    cost: 18, units: 3,
  },
  {
    t: 'The Witch', ot: 'The Witch', ol: 'Inglés', et: 'The Witch',
    alt: ['The VVitch: A New-England Folktale', 'La bruja'], dur: 92, year: 2015,
    g: ['Terror', 'Drama Histórico'],
    noms: [], wins: [],
    cast: ['Anya Taylor-Joy', 'Ralph Ineson', 'Kate Dickie', 'Harvey Scrimshaw'],
    cost: 16, units: 2,
  },
  {
    t: 'Get Out', ot: 'Get Out', ol: 'Inglés', et: 'Get Out',
    alt: ['¡Huye!', 'Déjame salir'], dur: 104, year: 2017,
    g: ['Terror', 'Suspenso', 'Sátira', 'Misterio'],
    noms: ['Best Picture', 'Best Directing', 'Best Actor in a Leading Role'],
    wins: ['Best Original Screenplay'],
    cast: ['Daniel Kaluuya', 'Allison Williams', 'Bradley Whitford', 'Catherine Keener', 'Lil Rel Howery'],
    cost: 20, units: 4,
  },

  // ---------------- Musical -----------------------------------------------
  {
    t: 'La La Land', ot: 'La La Land', ol: 'Inglés', et: 'La La Land',
    alt: ['La La Land: Una historia de amor'], dur: 128, year: 2016,
    g: ['Musical', 'Romance', 'Drama', 'Comedia'],
    noms: ['Best Picture', 'Best Actor in a Leading Role', 'Best Original Screenplay',
      'Best Film Editing', 'Best Costume Design', 'Best Sound Editing', 'Best Sound Mixing'],
    wins: ['Best Directing', 'Best Actress in a Leading Role', 'Best Cinematography',
      'Best Original Score', 'Best Original Song', 'Best Production Design'],
    cast: ['Ryan Gosling', 'Emma Stone', 'John Legend', 'J.K. Simmons', 'Rosemarie DeWitt'],
    cost: 22, units: 5,
  },
  {
    t: 'Dancer in the Dark', ot: 'Dancer in the Dark', ol: 'Inglés', et: 'Dancer in the Dark',
    alt: ['Bailar en la oscuridad', 'Bailarina en la oscuridad'], dur: 140, year: 2000,
    g: ['Musical', 'Drama', 'Auteur'],
    noms: ['Best Original Song'], wins: [],
    cast: ['Björk', 'Catherine Deneuve', 'David Morse', 'Peter Stormare', 'Udo Kier'],
    cost: 18, units: 2,
  },
  {
    t: 'Les Misérables', ot: 'Les Misérables', ol: 'Inglés', et: 'Les Misérables',
    alt: ['Los miserables'], dur: 158, year: 2012,
    g: ['Musical', 'Drama', 'Drama Histórico', 'Romance'],
    noms: ['Best Picture', 'Best Actor in a Leading Role', 'Best Original Song',
      'Best Costume Design', 'Best Production Design'],
    wins: ['Best Actress in a Supporting Role', 'Best Makeup and Hairstyling', 'Best Sound Mixing'],
    cast: ['Hugh Jackman', 'Anne Hathaway', 'Russell Crowe', 'Amanda Seyfried', 'Eddie Redmayne', 'Samantha Barks'],
    cost: 20, units: 4,
  },
  {
    t: 'A Star Is Born', ot: 'A Star Is Born', ol: 'Inglés', et: 'A Star Is Born',
    alt: ['Nace una estrella', 'Ha nacido una estrella'], dur: 136, year: 2018,
    g: ['Musical', 'Romance', 'Drama'],
    noms: ['Best Picture', 'Best Actor in a Leading Role', 'Best Actress in a Leading Role',
      'Best Actor in a Supporting Role', 'Best Adapted Screenplay', 'Best Cinematography'],
    wins: ['Best Original Song'],
    cast: ['Lady Gaga', 'Bradley Cooper', 'Sam Elliott', 'Andrew Dice Clay', 'Dave Chappelle'],
    cost: 22, units: 4,
  },

  // ---------------- Acción -----------------------------------------------
  {
    t: 'Mad Max: Fury Road', ot: 'Mad Max: Fury Road', ol: 'Inglés', et: 'Mad Max: Fury Road',
    alt: ['Mad Max: Furia en el camino', 'Mad Max: Furia en la carretera'], dur: 120, year: 2015,
    g: ['Acción', 'Ciencia Ficción', 'Distopía', 'Aventura'],
    noms: ['Best Picture', 'Best Directing', 'Best Cinematography', 'Best Visual Effects'],
    wins: ['Best Film Editing', 'Best Production Design', 'Best Costume Design',
      'Best Makeup and Hairstyling', 'Best Sound Editing', 'Best Sound Mixing'],
    cast: ['Tom Hardy', 'Charlize Theron', 'Nicholas Hoult', 'Hugh Keays-Byrne', 'Zoë Kravitz'],
    cost: 25, units: 5,
  },
  {
    t: 'The Dark Knight', ot: 'The Dark Knight', ol: 'Inglés', et: 'The Dark Knight',
    alt: ['El caballero de la noche', 'Batman: El caballero de la noche', 'Batman: El caballero oscuro'],
    dur: 152, year: 2008,
    g: ['Acción', 'Crimen', 'Drama', 'Neo-noir', 'Suspenso'],
    noms: ['Best Cinematography', 'Best Film Editing', 'Best Art Direction', 'Best Makeup',
      'Best Sound Mixing', 'Best Visual Effects'],
    wins: ['Best Actor in a Supporting Role', 'Best Sound Editing'],
    cast: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart', 'Michael Caine', 'Gary Oldman', 'Morgan Freeman'],
    cost: 25, units: 5,
  },
  {
    t: 'Oldboy', ot: '올드보이', ol: 'Coreano', et: 'Oldboy',
    alt: ['Oldeuboi', 'Old Boy'], dur: 120, year: 2003,
    g: ['Acción', 'Suspenso', 'Misterio', 'Neo-noir', 'Drama'],
    noms: [], wins: [],
    cast: ['Choi Min-sik', 'Yoo Ji-tae', 'Kang Hye-jung', 'Ji Dae-han'],
    cost: 20, units: 3,
  },

  // ---------------- Fantasía / Aventura ----------------------------------
  {
    t: "Pan's Labyrinth", ot: 'El laberinto del fauno', ol: 'Español', et: "Pan's Labyrinth",
    alt: ['El laberinto del fauno'], dur: 118, year: 2006,
    g: ['Fantasía', 'Guerra', 'Drama', 'Drama Histórico'],
    noms: ['Best International Feature Film', 'Best Original Screenplay', 'Best Original Score'],
    wins: ['Best Cinematography', 'Best Art Direction', 'Best Makeup'],
    cast: ['Ivana Baquero', 'Sergi López', 'Maribel Verdú', 'Doug Jones', 'Ariadna Gil'],
    cost: 20, units: 3,
  },
  {
    t: 'The Shape of Water', ot: 'The Shape of Water', ol: 'Inglés', et: 'The Shape of Water',
    alt: ['La forma del agua'], dur: 123, year: 2017,
    g: ['Fantasía', 'Romance', 'Drama', 'Ciencia Ficción'],
    noms: ['Best Actress in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Actress in a Supporting Role', 'Best Original Screenplay', 'Best Cinematography',
      'Best Film Editing', 'Best Costume Design', 'Best Sound Editing', 'Best Sound Mixing'],
    wins: ['Best Picture', 'Best Directing', 'Best Production Design', 'Best Original Score'],
    cast: ['Sally Hawkins', 'Michael Shannon', 'Richard Jenkins', 'Octavia Spencer', 'Michael Stuhlbarg', 'Doug Jones'],
    cost: 22, units: 4,
  },
  {
    t: 'Spirited Away', ot: '千と千尋の神隠し', ol: 'Japonés', et: 'Spirited Away',
    alt: ['Sen to Chihiro no kamikakushi', 'El viaje de Chihiro'], dur: 125, year: 2001,
    g: ['Fantasía', 'Animación', 'Aventura'],
    noms: [], wins: ['Best Animated Feature Film'],
    cast: ['Rumi Hiiragi', 'Miyu Irino', 'Mari Natsuki', 'Takashi Naitō'],
    cost: 22, units: 4,
  },
  {
    t: 'The Lord of the Rings: The Fellowship of the Ring',
    ot: 'The Lord of the Rings: The Fellowship of the Ring', ol: 'Inglés',
    et: 'The Lord of the Rings: The Fellowship of the Ring',
    alt: ['El Señor de los Anillos: La Comunidad del Anillo'], dur: 178, year: 2001,
    g: ['Fantasía', 'Aventura', 'Acción'],
    noms: ['Best Picture', 'Best Directing', 'Best Actor in a Supporting Role', 'Best Adapted Screenplay',
      'Best Art Direction', 'Best Costume Design', 'Best Film Editing', 'Best Original Song', 'Best Sound'],
    wins: ['Best Cinematography', 'Best Makeup', 'Best Original Score', 'Best Visual Effects'],
    cast: ['Elijah Wood', 'Ian McKellen', 'Viggo Mortensen', 'Sean Astin', 'Cate Blanchett', 'Christopher Lee'],
    cost: 25, units: 5,
  },
  {
    t: 'Life of Pi', ot: 'Life of Pi', ol: 'Inglés', et: 'Life of Pi',
    alt: ['La vida de Pi', 'Una aventura extraordinaria'], dur: 127, year: 2012,
    g: ['Aventura', 'Drama', 'Fantasía'],
    noms: ['Best Picture', 'Best Adapted Screenplay', 'Best Film Editing', 'Best Production Design',
      'Best Original Song', 'Best Sound Editing', 'Best Sound Mixing'],
    wins: ['Best Directing', 'Best Cinematography', 'Best Visual Effects', 'Best Original Score'],
    cast: ['Suraj Sharma', 'Irrfan Khan', 'Rafe Spall', 'Gérard Depardieu', 'Tabu'],
    cost: 20, units: 3,
  },

  // ---------------- Guerra ---------------------------------------------------
  {
    t: '1917', ot: '1917', ol: 'Inglés', et: '1917',
    alt: ['1917: Sólo el valor los mantendrá con vida'], dur: 119, year: 2019,
    g: ['Guerra', 'Drama', 'Suspenso', 'Drama Histórico'],
    noms: ['Best Picture', 'Best Directing', 'Best Original Screenplay', 'Best Production Design',
      'Best Makeup and Hairstyling', 'Best Original Score', 'Best Sound Editing'],
    wins: ['Best Cinematography', 'Best Visual Effects', 'Best Sound Mixing'],
    cast: ['George MacKay', 'Dean-Charles Chapman', 'Mark Strong', 'Benedict Cumberbatch', 'Colin Firth'],
    cost: 22, units: 4,
  },
  {
    t: 'Dunkirk', ot: 'Dunkirk', ol: 'Inglés', et: 'Dunkirk',
    alt: ['Dunkerque'], dur: 106, year: 2017,
    g: ['Guerra', 'Acción', 'Drama', 'Drama Histórico', 'Suspenso'],
    noms: ['Best Picture', 'Best Directing', 'Best Cinematography', 'Best Production Design', 'Best Original Score'],
    wins: ['Best Film Editing', 'Best Sound Editing', 'Best Sound Mixing'],
    cast: ['Fionn Whitehead', 'Tom Hardy', 'Mark Rylance', 'Kenneth Branagh', 'Cillian Murphy', 'Harry Styles'],
    cost: 22, units: 4,
  },
  {
    t: 'The Pianist', ot: 'The Pianist', ol: 'Inglés', et: 'The Pianist',
    alt: ['El pianista', 'Le Pianiste'], dur: 150, year: 2002,
    g: ['Guerra', 'Drama', 'Biografía', 'Drama Histórico'],
    noms: ['Best Picture', 'Best Cinematography', 'Best Costume Design', 'Best Film Editing'],
    wins: ['Best Directing', 'Best Actor in a Leading Role', 'Best Adapted Screenplay'],
    cast: ['Adrien Brody', 'Thomas Kretschmann', 'Frank Finlay', 'Emilia Fox'],
    cost: 20, units: 3,
  },

  // ---------------- Animación ----------------------------------------------
  {
    t: 'Spider-Man: Into the Spider-Verse', ot: 'Spider-Man: Into the Spider-Verse', ol: 'Inglés',
    et: 'Spider-Man: Into the Spider-Verse',
    alt: ['Spider-Man: Un nuevo universo', 'Spider-Man: Into the Spider-Verse'], dur: 117, year: 2018,
    g: ['Animación', 'Acción', 'Aventura', 'Ciencia Ficción'],
    noms: [], wins: ['Best Animated Feature Film'],
    cast: ['Shameik Moore', 'Jake Johnson', 'Hailee Steinfeld', 'Mahershala Ali', 'Nicolas Cage', 'Liev Schreiber'],
    cost: 20, units: 5,
  },
  {
    t: 'Persepolis', ot: 'Persepolis', ol: 'Francés', et: 'Persepolis',
    alt: ['Persépolis'], dur: 96, year: 2007,
    g: ['Animación', 'Biografía', 'Drama', 'Coming-of-age', 'Drama Histórico'],
    noms: ['Best Animated Feature Film'], wins: [],
    cast: ['Chiara Mastroianni', 'Catherine Deneuve', 'Danielle Darrieux', 'Simon Abkarian'],
    cost: 16, units: 2,
  },
  {
    t: 'WALL·E', ot: 'WALL·E', ol: 'Inglés', et: 'WALL·E',
    alt: ['WALL-E', 'WALL·E: Batallón de limpieza'], dur: 98, year: 2008,
    g: ['Animación', 'Ciencia Ficción', 'Distopía', 'Romance', 'Aventura'],
    noms: ['Best Original Screenplay', 'Best Original Score', 'Best Original Song',
      'Best Sound Editing', 'Best Sound Mixing'],
    wins: ['Best Animated Feature Film'],
    cast: ['Ben Burtt', 'Elissa Knight', 'Jeff Garlin', 'Fred Willard', 'Sigourney Weaver'],
    cost: 18, units: 4,
  },
  {
    t: 'Waltz with Bashir', ot: 'ואלס עם באשיר', ol: 'Hebreo', et: 'Waltz with Bashir',
    alt: ['Vals im Bashir', 'Vals con Bashir'], dur: 90, year: 2008,
    g: ['Animación', 'Documental', 'Guerra', 'Biografía'],
    noms: ['Best International Feature Film'], wins: [],
    cast: ['Ari Folman', 'Ron Ben-Yishai', 'Ronny Dayag', 'Ori Sivan'],
    cost: 16, units: 1,
  },

  // ---------------- Documental --------------------------------------------
  {
    t: 'Man on Wire', ot: 'Man on Wire', ol: 'Inglés', et: 'Man on Wire',
    alt: ['El equilibrista', 'El hombre del alambre'], dur: 94, year: 2008,
    g: ['Documental', 'Biografía', 'Suspenso'],
    noms: [], wins: ['Best Documentary Feature'],
    cast: ['Philippe Petit', 'Jean-Louis Blondeau', 'Annie Allix', 'Jean-François Heckel'],
    cost: 15, units: 2,
  },
  {
    t: 'Free Solo', ot: 'Free Solo', ol: 'Inglés', et: 'Free Solo',
    alt: ['Free Solo: Al límite'], dur: 100, year: 2018,
    g: ['Documental', 'Biografía', 'Aventura'],
    noms: [], wins: ['Best Documentary Feature'],
    cast: ['Alex Honnold', 'Tommy Caldwell', 'Sanni McCandless', 'Jimmy Chin'],
    cost: 16, units: 3,
  },
  {
    t: 'Searching for Sugar Man', ot: 'Searching for Sugar Man', ol: 'Inglés', et: 'Searching for Sugar Man',
    alt: ['Buscando a Sugar Man'], dur: 86, year: 2012,
    g: ['Documental', 'Biografía'],
    noms: [], wins: ['Best Documentary Feature'],
    cast: ['Sixto Rodriguez', 'Stephen Segerman', 'Dennis Coffey', 'Mike Theodore'],
    cost: 14, units: 2,
  },

  // ---------------- Western ------------------------------------------------
  {
    t: 'The Assassination of Jesse James by the Coward Robert Ford',
    ot: 'The Assassination of Jesse James by the Coward Robert Ford', ol: 'Inglés',
    et: 'The Assassination of Jesse James by the Coward Robert Ford',
    alt: ['El asesinato de Jesse James por el cobarde Robert Ford'], dur: 160, year: 2007,
    g: ['Western', 'Drama', 'Biografía', 'Drama Histórico', 'Slow Cinema'],
    noms: ['Best Actor in a Supporting Role', 'Best Cinematography'], wins: [],
    cast: ['Brad Pitt', 'Casey Affleck', 'Sam Shepard', 'Sam Rockwell', 'Mary-Louise Parker'],
    cost: 18, units: 2,
  },
  {
    t: 'The Power of the Dog', ot: 'The Power of the Dog', ol: 'Inglés', et: 'The Power of the Dog',
    alt: ['El poder del perro'], dur: 126, year: 2021,
    g: ['Western', 'Drama', 'Cine LGBTQ+', 'Drama Psicológico'],
    noms: ['Best Picture', 'Best Actor in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Actress in a Supporting Role', 'Best Adapted Screenplay', 'Best Cinematography',
      'Best Production Design', 'Best Film Editing', 'Best Original Score', 'Best Sound'],
    wins: ['Best Directing'],
    cast: ['Benedict Cumberbatch', 'Kirsten Dunst', 'Jesse Plemons', 'Kodi Smit-McPhee'],
    cost: 20, units: 3,
  },
  {
    t: 'True Grit', ot: 'True Grit', ol: 'Inglés', et: 'True Grit',
    alt: ['Temple de acero', 'Valor de ley'], dur: 110, year: 2010,
    g: ['Western', 'Drama', 'Aventura'],
    noms: ['Best Picture', 'Best Directing', 'Best Adapted Screenplay', 'Best Actor in a Leading Role',
      'Best Actress in a Supporting Role', 'Best Cinematography', 'Best Art Direction',
      'Best Costume Design', 'Best Sound Editing', 'Best Sound Mixing'],
    wins: [],
    cast: ['Jeff Bridges', 'Hailee Steinfeld', 'Matt Damon', 'Josh Brolin', 'Barry Pepper'],
    cost: 18, units: 3,
  },
  {
    t: 'Brokeback Mountain', ot: 'Brokeback Mountain', ol: 'Inglés', et: 'Brokeback Mountain',
    alt: ['Secreto en la montaña', 'En terreno vedado'], dur: 134, year: 2005,
    g: ['Cine LGBTQ+', 'Romance', 'Drama', 'Western'],
    noms: ['Best Picture', 'Best Actor in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Actress in a Supporting Role', 'Best Cinematography'],
    wins: ['Best Directing', 'Best Adapted Screenplay', 'Best Original Score'],
    cast: ['Heath Ledger', 'Jake Gyllenhaal', 'Michelle Williams', 'Anne Hathaway'],
    cost: 18, units: 3,
  },

  // ---------------- Cine LGBTQ+ ------------------------------------------
  {
    t: 'Moonlight', ot: 'Moonlight', ol: 'Inglés', et: 'Moonlight',
    alt: ['Luz de luna'], dur: 111, year: 2016,
    g: ['Cine LGBTQ+', 'Drama', 'Coming-of-age'],
    noms: ['Best Directing', 'Best Actress in a Supporting Role', 'Best Cinematography',
      'Best Film Editing', 'Best Original Score'],
    wins: ['Best Picture', 'Best Actor in a Supporting Role', 'Best Adapted Screenplay'],
    cast: ['Mahershala Ali', 'Naomie Harris', 'Trevante Rhodes', 'André Holland', 'Janelle Monáe'],
    cost: 20, units: 3,
  },
  {
    t: 'Carol', ot: 'Carol', ol: 'Inglés', et: 'Carol',
    alt: ['Carol'], dur: 118, year: 2015,
    g: ['Cine LGBTQ+', 'Romance', 'Drama', 'Drama Histórico'],
    noms: ['Best Actress in a Leading Role', 'Best Actress in a Supporting Role',
      'Best Adapted Screenplay', 'Best Cinematography', 'Best Costume Design', 'Best Original Score'],
    wins: [],
    cast: ['Cate Blanchett', 'Rooney Mara', 'Sarah Paulson', 'Kyle Chandler'],
    cost: 18, units: 2,
  },

  // ---------------- Comedia Negra / Comedia ------------------------------
  {
    t: 'In Bruges', ot: 'In Bruges', ol: 'Inglés', et: 'In Bruges',
    alt: ['Escondidos en Brujas'], dur: 107, year: 2008,
    g: ['Comedia Negra', 'Crimen', 'Drama'],
    noms: ['Best Original Screenplay'], wins: [],
    cast: ['Colin Farrell', 'Brendan Gleeson', 'Ralph Fiennes', 'Clémence Poésy'],
    cost: 16, units: 2,
  },
  {
    t: 'Three Billboards Outside Ebbing, Missouri', ot: 'Three Billboards Outside Ebbing, Missouri',
    ol: 'Inglés', et: 'Three Billboards Outside Ebbing, Missouri',
    alt: ['Tres anuncios por un crimen', 'Tres anuncios en las afueras'], dur: 115, year: 2017,
    g: ['Comedia Negra', 'Drama', 'Crimen'],
    noms: ['Best Picture', 'Best Original Screenplay', 'Best Original Score', 'Best Film Editing'],
    wins: ['Best Actress in a Leading Role', 'Best Actor in a Supporting Role'],
    cast: ['Frances McDormand', 'Woody Harrelson', 'Sam Rockwell', 'Peter Dinklage', 'Caleb Landry Jones'],
    cost: 18, units: 3,
  },
  {
    t: 'The Death of Stalin', ot: 'The Death of Stalin', ol: 'Inglés', et: 'The Death of Stalin',
    alt: ['La muerte de Stalin'], dur: 107, year: 2017,
    g: ['Comedia Negra', 'Sátira', 'Drama Histórico'],
    noms: [], wins: [],
    cast: ['Steve Buscemi', 'Simon Russell Beale', 'Jason Isaacs', 'Jeffrey Tambor', 'Michael Palin', 'Andrea Riseborough'],
    cost: 15, units: 2,
  },
  {
    t: 'The Grand Budapest Hotel', ot: 'The Grand Budapest Hotel', ol: 'Inglés', et: 'The Grand Budapest Hotel',
    alt: ['El Gran Hotel Budapest'], dur: 99, year: 2014,
    g: ['Comedia', 'Comedia Negra', 'Aventura', 'Crimen'],
    noms: ['Best Picture', 'Best Directing', 'Best Original Screenplay', 'Best Cinematography', 'Best Film Editing'],
    wins: ['Best Production Design', 'Best Costume Design', 'Best Makeup and Hairstyling', 'Best Original Score'],
    cast: ['Ralph Fiennes', 'Tony Revolori', 'Adrien Brody', 'Willem Dafoe', 'Saoirse Ronan', 'Tilda Swinton'],
    cost: 20, units: 4,
  },
  {
    t: 'Little Miss Sunshine', ot: 'Little Miss Sunshine', ol: 'Inglés', et: 'Little Miss Sunshine',
    alt: ['Pequeña Miss Sunshine'], dur: 101, year: 2006,
    g: ['Comedia', 'Comedia Negra', 'Drama', 'Coming-of-age'],
    noms: ['Best Picture', 'Best Actress in a Supporting Role'],
    wins: ['Best Actor in a Supporting Role', 'Best Original Screenplay'],
    cast: ['Greg Kinnear', 'Toni Collette', 'Steve Carell', 'Paul Dano', 'Abigail Breslin', 'Alan Arkin'],
    cost: 16, units: 3,
  },
  {
    t: 'The Favourite', ot: 'The Favourite', ol: 'Inglés', et: 'The Favourite',
    alt: ['La favorita'], dur: 119, year: 2018,
    g: ['Comedia', 'Comedia Negra', 'Drama Histórico', 'Sátira'],
    noms: ['Best Picture', 'Best Directing', 'Best Actress in a Supporting Role', 'Best Original Screenplay',
      'Best Cinematography', 'Best Costume Design', 'Best Film Editing', 'Best Production Design'],
    wins: ['Best Actress in a Leading Role'],
    cast: ['Olivia Colman', 'Rachel Weisz', 'Emma Stone', 'Nicholas Hoult'],
    cost: 20, units: 3,
  },

  // ---------------- Sátira ------------------------------------------------
  {
    t: 'The Square', ot: 'The Square', ol: 'Sueco', et: 'The Square',
    alt: ['The Square: La farsa del arte'], dur: 151, year: 2017,
    g: ['Sátira', 'Comedia Negra', 'Drama', 'Auteur'],
    noms: ['Best International Feature Film'], wins: [],
    cast: ['Claes Bang', 'Elisabeth Moss', 'Dominic West', 'Terry Notary'],
    cost: 16, units: 2,
  },
  {
    t: 'Triangle of Sadness', ot: 'Triangle of Sadness', ol: 'Inglés', et: 'Triangle of Sadness',
    alt: ['El triángulo de la tristeza', 'Sin filtro'], dur: 147, year: 2022,
    g: ['Sátira', 'Comedia Negra', 'Drama'],
    noms: ['Best Picture', 'Best Directing', 'Best Original Screenplay'], wins: [],
    cast: ['Harris Dickinson', 'Charlbi Dean', 'Woody Harrelson', 'Dolly de Leon', 'Zlatko Burić'],
    cost: 18, units: 3,
  },
  {
    t: 'Jojo Rabbit', ot: 'Jojo Rabbit', ol: 'Inglés', et: 'Jojo Rabbit',
    alt: ['Jojo Rabbit'], dur: 108, year: 2019,
    g: ['Sátira', 'Comedia Negra', 'Guerra', 'Drama Histórico', 'Comedia'],
    noms: ['Best Picture', 'Best Actress in a Supporting Role', 'Best Production Design',
      'Best Costume Design', 'Best Film Editing'],
    wins: ['Best Adapted Screenplay'],
    cast: ['Roman Griffin Davis', 'Thomasin McKenzie', 'Scarlett Johansson', 'Taika Waititi', 'Sam Rockwell', 'Rebel Wilson'],
    cost: 18, units: 3,
  },

  // ---------------- Biografía / Drama Histórico -------------------------
  {
    t: 'The Social Network', ot: 'The Social Network', ol: 'Inglés', et: 'The Social Network',
    alt: ['Red social', 'La red social'], dur: 120, year: 2010,
    g: ['Biografía', 'Drama', 'Drama Histórico'],
    noms: ['Best Picture', 'Best Directing', 'Best Actor in a Leading Role', 'Best Cinematography',
      'Best Sound Mixing'],
    wins: ['Best Adapted Screenplay', 'Best Original Score', 'Best Film Editing'],
    cast: ['Jesse Eisenberg', 'Andrew Garfield', 'Justin Timberlake', 'Armie Hammer', 'Rooney Mara'],
    cost: 20, units: 4,
  },
  {
    t: 'The Theory of Everything', ot: 'The Theory of Everything', ol: 'Inglés', et: 'The Theory of Everything',
    alt: ['La teoría del todo'], dur: 123, year: 2014,
    g: ['Biografía', 'Drama', 'Romance'],
    noms: ['Best Picture', 'Best Actress in a Leading Role', 'Best Adapted Screenplay', 'Best Original Score'],
    wins: ['Best Actor in a Leading Role'],
    cast: ['Eddie Redmayne', 'Felicity Jones', 'Charlie Cox', 'David Thewlis', 'Emily Watson'],
    cost: 18, units: 3,
  },
  {
    t: '12 Years a Slave', ot: '12 Years a Slave', ol: 'Inglés', et: '12 Years a Slave',
    alt: ['12 años de esclavitud'], dur: 134, year: 2013,
    g: ['Drama Histórico', 'Drama', 'Biografía'],
    noms: ['Best Directing', 'Best Actor in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Costume Design', 'Best Film Editing', 'Best Production Design'],
    wins: ['Best Picture', 'Best Actress in a Supporting Role', 'Best Adapted Screenplay'],
    cast: ['Chiwetel Ejiofor', 'Michael Fassbender', "Lupita Nyong'o", 'Benedict Cumberbatch', 'Brad Pitt'],
    cost: 20, units: 3,
  },
  {
    t: 'City of God', ot: 'Cidade de Deus', ol: 'Portugués', et: 'City of God',
    alt: ['Ciudad de Dios'], dur: 130, year: 2002,
    g: ['Crimen', 'Drama', 'Coming-of-age', 'Biografía'],
    noms: ['Best Directing', 'Best Adapted Screenplay', 'Best Cinematography', 'Best Film Editing'],
    wins: [],
    cast: ['Alexandre Rodrigues', 'Leandro Firmino', 'Phellipe Haagensen', 'Douglas Silva', 'Alice Braga'],
    cost: 18, units: 3,
  },
  {
    t: 'A Prophet', ot: 'Un prophète', ol: 'Francés', et: 'A Prophet',
    alt: ['Un profeta'], dur: 155, year: 2009,
    g: ['Crimen', 'Drama'],
    noms: ['Best International Feature Film'], wins: [],
    cast: ['Tahar Rahim', 'Niels Arestrup', 'Adel Bencherif', 'Reda Kateb'],
    cost: 16, units: 2,
  },

  // ---------------- Coming-of-age --------------------------------------
  {
    t: 'Boyhood', ot: 'Boyhood', ol: 'Inglés', et: 'Boyhood',
    alt: ['Boyhood: Momentos de una vida'], dur: 165, year: 2014,
    g: ['Coming-of-age', 'Drama'],
    noms: ['Best Picture', 'Best Directing', 'Best Actor in a Supporting Role', 'Best Original Screenplay',
      'Best Film Editing'],
    wins: ['Best Actress in a Supporting Role'],
    cast: ['Ellar Coltrane', 'Patricia Arquette', 'Ethan Hawke', 'Lorelei Linklater'],
    cost: 18, units: 3,
  },
  {
    t: 'Lady Bird', ot: 'Lady Bird', ol: 'Inglés', et: 'Lady Bird',
    alt: ['Lady Bird: La hora de volar'], dur: 94, year: 2017,
    g: ['Coming-of-age', 'Comedia', 'Drama'],
    noms: ['Best Picture', 'Best Directing', 'Best Actress in a Leading Role',
      'Best Actress in a Supporting Role', 'Best Original Screenplay'],
    wins: [],
    cast: ['Saoirse Ronan', 'Laurie Metcalf', 'Tracy Letts', 'Timothée Chalamet', 'Lucas Hedges', 'Beanie Feldstein'],
    cost: 16, units: 3,
  },
  {
    t: 'Aftersun', ot: 'Aftersun', ol: 'Inglés', et: 'Aftersun',
    alt: ['Aftersun'], dur: 102, year: 2022,
    g: ['Coming-of-age', 'Drama', 'Drama Psicológico'],
    noms: ['Best Actor in a Leading Role'], wins: [],
    cast: ['Paul Mescal', 'Frankie Corio', 'Celia Rowlson-Hall'],
    cost: 16, units: 2,
  },

  // ---------------- Body Horror --------------------------------------------
  {
    t: 'The Fly', ot: 'The Fly', ol: 'Inglés', et: 'The Fly',
    alt: ['La mosca'], dur: 96, year: 1986,
    g: ['Body Horror', 'Terror', 'Ciencia Ficción', 'Romance'],
    noms: [], wins: ['Best Makeup'],
    cast: ['Jeff Goldblum', 'Geena Davis', 'John Getz'],
    cost: 15, units: 2,
  },
  {
    t: 'Titane', ot: 'Titane', ol: 'Francés', et: 'Titane',
    alt: ['Titán'], dur: 108, year: 2021,
    g: ['Body Horror', 'Terror', 'Drama', 'Auteur'],
    noms: [], wins: [],
    cast: ['Agathe Rousselle', 'Vincent Lindon', 'Garance Marillier'],
    cost: 16, units: 2,
  },
  {
    t: 'Annihilation', ot: 'Annihilation', ol: 'Inglés', et: 'Annihilation',
    alt: ['Aniquilación'], dur: 115, year: 2018,
    g: ['Body Horror', 'Ciencia Ficción', 'Terror', 'Aventura'],
    noms: [], wins: [],
    cast: ['Natalie Portman', 'Jennifer Jason Leigh', 'Oscar Isaac', 'Tessa Thompson', 'Gina Rodriguez'],
    cost: 16, units: 3,
  },
];

/* ---------------------------------------------------------------------------
 * Ejecución
 * ------------------------------------------------------------------------- */
async function main() {
  console.log('============================================================');
  console.log(' CARGA DE PELÍCULAS REALES');
  console.log(` Base: ${process.env.COUCHDB_DB}  |  catálogo: ${MOVIES.length} películas`);
  console.log('============================================================');

  // 1) Géneros reales -> mapa nombre -> _id  (equivale a GET /api/genres).
  const genres = await genreRepo.list();
  const idByName = new Map(genres.map((g) => [g.name, g._id]));
  console.log(`\nGéneros leídos de la base: ${genres.length}`);

  // Validación temprana: que todos los nombres usados existan.
  const usados = new Set(MOVIES.flatMap((m) => m.g));
  const faltantes = [...usados].filter((n) => !idByName.has(n));
  if (faltantes.length > 0) {
    console.error('\nERROR: estos géneros del catálogo no existen en la base:');
    faltantes.forEach((n) => console.error(`  - "${n}"`));
    process.exit(1);
  }

  // 2) Índice de lo ya existente (para idempotencia).
  const existentes = await videoRepo.list();
  const claveExistente = new Set(
    existentes.map((v) => `${(v.display_title || '').toLowerCase()}|${v.release_year}`)
  );

  // 3) Crear.
  const creadas = [];
  let saltadas = 0;
  for (const m of MOVIES) {
    const clave = `${m.t.toLowerCase()}|${m.year}`;
    if (claveExistente.has(clave)) {
      console.log(`  [salta]  "${m.t}" (${m.year}) ya existe`);
      saltadas++;
      continue;
    }
    try {
      const created = await videoService.create({
        display_title: m.t,
        original_title: m.ot,
        original_language: m.ol,
        english_title: m.et,
        alternative_titles: m.alt,
        duration_minutes: m.dur,
        genre_ids: m.g.map((n) => idByName.get(n)),
        release_year: m.year,
        oscar_nominations: m.noms,
        oscar_wins: m.wins,
        main_actors: m.cast,
        unit_cost: m.cost,
        units_acquired: m.units,
      });
      creadas.push({ id: created._id, t: m.t, g: m.g, units: m.units });
      console.log(`  [crea]   "${m.t}" (${m.year}) -> ${created._id}  [${m.units} copia(s)]`);
    } catch (err) {
      console.error(`  [ERROR]  "${m.t}": ${err.message}`);
    }
  }

  // 4) Recuento por género sobre el estado REAL de la base.
  console.log('\n── PELÍCULAS POR GÉNERO (estado real en la base) ───────');
  const todos = await videoRepo.list();
  const cuentaPorGenero = new Map(genres.map((g) => [g._id, 0]));
  for (const v of todos) {
    for (const gid of v.genre_ids || []) {
      if (cuentaPorGenero.has(gid)) cuentaPorGenero.set(gid, cuentaPorGenero.get(gid) + 1);
    }
  }
  const nameById = new Map(genres.map((g) => [g._id, g.name]));
  let incumplen = 0;
  [...cuentaPorGenero.entries()]
    .sort((a, b) => nameById.get(a[0]).localeCompare(nameById.get(b[0])))
    .forEach(([gid, n]) => {
      const ok = n >= 2 ? 'OK ' : '!! ';
      if (n < 2) incumplen++;
      console.log(`  ${ok} ${nameById.get(gid).padEnd(20)} ${n}`);
    });

  console.log('\n============================================================');
  console.log(` Creadas ahora: ${creadas.length}  |  Ya existían (saltadas): ${saltadas}`);
  console.log(` Total de películas en la base: ${todos.length}`);
  console.log(
    incumplen === 0
      ? ' Todos los géneros tienen al menos 2 películas. OK'
      : ` ATENCIÓN: ${incumplen} género(s) con menos de 2 películas.`
  );
  console.log('============================================================');

  process.exit(incumplen === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Fallo en la carga de películas:', err);
  process.exit(1);
});
