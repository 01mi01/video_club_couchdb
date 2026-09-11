/**
 * ============================================================================
 * scripts/seed-movies-2.js  —  CARGA DE PELÍCULAS REALES, SEGUNDA TANDA
 * ============================================================================
 *
 * Autorizado por CLAUDE.md, sección "Contenido de datos — películas y
 * clientes" + regla de trabajo 2 (pedido explícito del propietario: sumar
 * 40 películas más al catálogo, para llegar a 120). NO son datos de
 * prueba descartables: es catálogo real, con datos verificables.
 *
 *     node scripts/seed-movies-2.js
 *
 * A diferencia de `seed-movies.js` (primera tanda, anterior a la
 * simplificación del modelo de títulos): usa el modelo ACTUAL —
 * `director` en vez de nada, sin `english_title` (cualquier título en
 * inglés va directo a `alternative_titles[]`) — y resuelve
 * `oscar_nominations`/`oscar_wins` a IDs de `oscar_category` (por
 * `name_en`), no a strings libres.
 *
 * CRITERIOS APLICADOS (mismos de CLAUDE.md que la primera tanda):
 *   - Prioridad a Cannes reciente: Anora, Anatomy of a Fall, The
 *     Substance, Emilia Pérez, The Zone of Interest, Sentimental Value,
 *     The Worst Person in the World, Shoplifters, Fallen Leaves, Close,
 *     Compartment No. 6, Amour, Dheepan, Winter Sleep, I Daniel Blake,
 *     Toni Erdmann, Pain and Glory, All We Imagine as Light, La Chimera.
 *   - Cine francés pedido explícitamente: Petite Maman (Céline Sciamma),
 *     Humanist Vampire Seeking Consenting Suicidal Person (Québec,
 *     francófona), más varias de Jacques Audiard/Michael Haneke.
 *   - Wong Kar-wai (pedido explícito, "chucking express" = Chungking
 *     Express): se agregan 4 películas del mismo director — Chungking
 *     Express, Fallen Angels, Happy Together, 2046 — además de "In the
 *     Mood for Love" que ya estaba en el catálogo.
 *   - Left-Handed Girl (pedido explícito, Cannes 2025).
 *   - Mezcla con mainstream premiado (para no ser solo festivalero):
 *     Oppenheimer, Everything Everywhere All at Once, Poor Things,
 *     Killers of the Flower Moon, Dune / Dune: Part Two, Conclave, Past
 *     Lives, Spider-Man: Across the Spider-Verse, Inside Out 2, Barbie,
 *     The Holdovers, American Fiction.
 *   - `oscar_nominations[]`/`oscar_wins[]` reales y verificables.
 *   - Nada en blanco y negro / nada anterior a 1986; sin gore de
 *     explotación.
 *   - `units_acquired` variado entre 1 y 5.
 *
 * Idempotente: si ya existe un video con el mismo `display_title` +
 * `release_year`, lo salta.
 * ============================================================================
 */

require('dotenv').config();

const genreRepo = require('../repositories/genreRepository');
const oscarCategoryRepo = require('../repositories/oscarCategoryRepository');
const videoRepo = require('../repositories/videoRepository');
const videoService = require('../services/videoService');

const MOVIES = [
  {
    t: 'Petite Maman', ot: 'Petite Maman', ol: 'Francés', director: 'Céline Sciamma',
    alt: [], dur: 72, year: 2021,
    g: ['Drama', 'Fantasía', 'Coming-of-age'],
    noms: [], wins: [],
    cast: ['Joséphine Sanz', 'Gabrielle Sanz', 'Nina Meurisse', 'Stéphane Varupenne'],
    cost: 18, units: 2,
  },
  {
    t: 'Humanist Vampire Seeking Consenting Suicidal Person', ot: 'Vampire humaniste cherche suicidaire consentant',
    ol: 'Francés', director: 'Ariane Louis-Seize',
    alt: ['Humanist Vampire'], dur: 89, year: 2023,
    g: ['Comedia Negra', 'Terror', 'Romance'],
    noms: [], wins: [],
    cast: ['Sara Montpetit', 'Félix-Antoine Bénard', 'Steve Laplante'],
    cost: 16, units: 2,
  },
  {
    t: 'Chungking Express', ot: '重慶森林', ol: 'Cantonés', director: 'Wong Kar-wai',
    alt: ['Chung King Express'], dur: 102, year: 1994,
    g: ['Romance', 'Drama', 'Crimen'],
    noms: [], wins: [],
    cast: ['Tony Leung Chiu-wai', 'Faye Wong', 'Brigitte Lin', 'Takeshi Kaneshiro'],
    cost: 20, units: 3,
  },
  {
    t: 'Fallen Angels', ot: '墮落天使', ol: 'Cantonés', director: 'Wong Kar-wai',
    alt: ['Duo luo tian shi'], dur: 99, year: 1995,
    g: ['Crimen', 'Drama', 'Neo-noir'],
    noms: [], wins: [],
    cast: ['Leon Lai', 'Michelle Reis', 'Takeshi Kaneshiro', 'Charlie Yeung'],
    cost: 18, units: 2,
  },
  {
    t: 'Happy Together', ot: '春光乍洩', ol: 'Cantonés', director: 'Wong Kar-wai',
    alt: ['Chun gwong cha sit'], dur: 96, year: 1997,
    g: ['Drama', 'Romance', 'Cine LGBTQ+'],
    noms: [], wins: [],
    cast: ['Tony Leung Chiu-wai', 'Leslie Cheung', 'Chang Chen'],
    cost: 19, units: 2,
  },
  {
    t: '2046', ot: '2046', ol: 'Cantonés', director: 'Wong Kar-wai',
    alt: [], dur: 129, year: 2004,
    g: ['Ciencia Ficción', 'Romance', 'Drama'],
    noms: [], wins: [],
    cast: ['Tony Leung Chiu-wai', 'Gong Li', 'Zhang Ziyi', 'Faye Wong'],
    cost: 21, units: 3,
  },
  {
    t: 'Left-Handed Girl', ot: '左撇子女孩', ol: 'Mandarín', director: 'Shih-Ching Tsou',
    alt: [], dur: 107, year: 2025,
    g: ['Drama', 'Coming-of-age'],
    noms: [], wins: [],
    cast: ['Nina Ye', 'Janel Tsai', 'Xin-Yan Wang'],
    cost: 17, units: 2,
  },
  {
    t: 'Perfect Days', ot: 'Perfect Days', ol: 'Japonés', director: 'Wim Wenders',
    alt: [], dur: 124, year: 2023,
    g: ['Drama', 'Slow Cinema'],
    noms: ['Best International Feature Film'], wins: [],
    cast: ['Kōji Yakusho', 'Tokio Emoto', 'Arisa Nakano'],
    cost: 19, units: 3,
  },
  {
    t: 'The Substance', ot: 'The Substance', ol: 'Inglés', director: 'Coralie Fargeat',
    alt: [], dur: 141, year: 2024,
    g: ['Body Horror', 'Terror', 'Drama'],
    noms: ['Best Picture', 'Best Directing', 'Best Actress in a Leading Role', 'Best Makeup and Hairstyling'],
    wins: ['Best Makeup and Hairstyling'],
    cast: ['Demi Moore', 'Margaret Qualley', 'Dennis Quaid'],
    cost: 23, units: 4,
  },
  {
    t: 'Sentimental Value', ot: 'Affeksjonsverdi', ol: 'Noruego', director: 'Joachim Trier',
    alt: ['Affection Value'], dur: 133, year: 2025,
    g: ['Drama'],
    noms: [], wins: [],
    cast: ['Renate Reinsve', 'Stellan Skarsgård', 'Elle Fanning', 'Inga Ibsdotter Lilleaas'],
    cost: 20, units: 3,
  },
  {
    t: 'The Worst Person in the World', ot: 'Verdens verste menneske', ol: 'Noruego', director: 'Joachim Trier',
    alt: [], dur: 128, year: 2021,
    g: ['Romance', 'Coming-of-age', 'Comedia'],
    noms: ['Best International Feature Film', 'Best Original Screenplay'], wins: [],
    cast: ['Renate Reinsve', 'Anders Danielsen Lie', 'Herbert Nordrum'],
    cost: 19, units: 3,
  },
  {
    t: 'Anatomy of a Fall', ot: 'Anatomie d’une chute', ol: 'Francés', director: 'Justine Triet',
    alt: [], dur: 152, year: 2023,
    g: ['Drama', 'Suspenso', 'Misterio'],
    noms: ['Best Picture', 'Best Directing', 'Best Actress in a Leading Role', 'Best Original Screenplay', 'Best Film Editing'],
    wins: ['Best Original Screenplay'],
    cast: ['Sandra Hüller', 'Swann Arlaud', 'Milo Machado-Graner'],
    cost: 22, units: 3,
  },
  {
    t: 'Anora', ot: 'Anora', ol: 'Inglés', director: 'Sean Baker',
    alt: [], dur: 139, year: 2024,
    g: ['Comedia', 'Drama', 'Romance'],
    noms: [
      'Best Picture', 'Best Directing', 'Best Actress in a Leading Role',
      'Best Actor in a Supporting Role', 'Best Original Screenplay', 'Best Film Editing',
    ],
    wins: [
      'Best Picture', 'Best Directing', 'Best Actress in a Leading Role',
      'Best Original Screenplay', 'Best Film Editing',
    ],
    cast: ['Mikey Madison', 'Mark Eydelshteyn', 'Yura Borisov'],
    cost: 21, units: 4,
  },
  {
    t: 'Fallen Leaves', ot: 'Kuolleet lehdet', ol: 'Finlandés', director: 'Aki Kaurismäki',
    alt: [], dur: 81, year: 2023,
    g: ['Comedia', 'Romance', 'Drama'],
    noms: ['Best International Feature Film'], wins: [],
    cast: ['Alma Pöysti', 'Jussi Vatanen'],
    cost: 16, units: 2,
  },
  {
    t: 'Close', ot: 'Close', ol: 'Neerlandés', director: 'Lukas Dhont',
    alt: [], dur: 104, year: 2022,
    g: ['Drama', 'Coming-of-age'],
    noms: ['Best International Feature Film'], wins: [],
    cast: ['Eden Dambrine', 'Gustav De Waele', 'Émilie Dequenne'],
    cost: 18, units: 3,
  },
  {
    t: 'Compartment No. 6', ot: 'Hytti nro 6', ol: 'Finlandés', director: 'Juho Kuosmanen',
    alt: [], dur: 107, year: 2021,
    g: ['Drama', 'Romance'],
    noms: ['Best International Feature Film'], wins: [],
    cast: ['Seidi Haarla', 'Yuriy Borisov'],
    cost: 17, units: 2,
  },
  {
    t: 'The Zone of Interest', ot: 'The Zone of Interest', ol: 'Inglés', director: 'Jonathan Glazer',
    alt: [], dur: 105, year: 2023,
    g: ['Drama', 'Guerra', 'Drama Histórico'],
    noms: [
      'Best Picture', 'Best Directing', 'Best International Feature Film',
      'Best Adapted Screenplay', 'Best Sound',
    ],
    wins: ['Best International Feature Film', 'Best Sound'],
    cast: ['Christian Friedel', 'Sandra Hüller'],
    cost: 20, units: 3,
  },
  {
    t: 'Emilia Pérez', ot: 'Emilia Pérez', ol: 'Español', director: 'Jacques Audiard',
    alt: [], dur: 132, year: 2024,
    g: ['Musical', 'Crimen', 'Drama'],
    noms: [
      'Best Picture', 'Best Directing', 'Best Actress in a Leading Role',
      'Best Actress in a Supporting Role', 'Best International Feature Film',
      'Best Original Screenplay', 'Best Original Song', 'Best Sound', 'Best Film Editing',
    ],
    wins: ['Best Actress in a Supporting Role', 'Best Original Song'],
    cast: ['Karla Sofía Gascón', 'Zoe Saldaña', 'Selena Gomez', 'Édgar Ramírez'],
    cost: 22, units: 3,
  },
  {
    t: 'Shoplifters', ot: '万引き家族', ol: 'Japonés', director: 'Hirokazu Kore-eda',
    alt: ['Manbiki Kazoku'], dur: 121, year: 2018,
    g: ['Drama', 'Crimen'],
    noms: ['Best International Feature Film'], wins: [],
    cast: ['Lily Franky', 'Sakura Andō', 'Mayu Matsuoka'],
    cost: 18, units: 3,
  },
  {
    t: 'Amour', ot: 'Amour', ol: 'Francés', director: 'Michael Haneke',
    alt: [], dur: 127, year: 2012,
    g: ['Drama', 'Romance', 'Drama Psicológico'],
    noms: [
      'Best Picture', 'Best Directing', 'Best Actress in a Leading Role',
      'Best Original Screenplay', 'Best International Feature Film',
    ],
    wins: ['Best International Feature Film'],
    cast: ['Jean-Louis Trintignant', 'Emmanuelle Riva', 'Isabelle Huppert'],
    cost: 19, units: 2,
  },
  {
    t: 'Dheepan', ot: 'Dheepan', ol: 'Francés', director: 'Jacques Audiard',
    alt: [], dur: 115, year: 2015,
    g: ['Drama', 'Crimen', 'Guerra'],
    noms: [], wins: [],
    cast: ['Jesuthasan Antonythasan', 'Kalieaswari Srinivasan', 'Claudine Vinasithamby'],
    cost: 17, units: 2,
  },
  {
    t: 'Winter Sleep', ot: 'Kış Uykusu', ol: 'Turco', director: 'Nuri Bilge Ceylan',
    alt: [], dur: 196, year: 2014,
    g: ['Drama', 'Slow Cinema', 'Auteur'],
    noms: [], wins: [],
    cast: ['Haluk Bilginer', 'Melisa Sözen', 'Demet Akbağ'],
    cost: 18, units: 2,
  },
  {
    t: 'I, Daniel Blake', ot: 'I, Daniel Blake', ol: 'Inglés', director: 'Ken Loach',
    alt: [], dur: 100, year: 2016,
    g: ['Drama', 'Sátira'],
    noms: [], wins: [],
    cast: ['Dave Johns', 'Hayley Squires'],
    cost: 15, units: 2,
  },
  {
    t: 'Toni Erdmann', ot: 'Toni Erdmann', ol: 'Alemán', director: 'Maren Ade',
    alt: [], dur: 162, year: 2016,
    g: ['Comedia', 'Drama', 'Sátira'],
    noms: ['Best International Feature Film'], wins: [],
    cast: ['Sandra Hüller', 'Peter Simonischek'],
    cost: 19, units: 2,
  },
  {
    t: 'Pain and Glory', ot: 'Dolor y gloria', ol: 'Español', director: 'Pedro Almodóvar',
    alt: [], dur: 113, year: 2019,
    g: ['Drama', 'Biografía', 'Drama Psicológico'],
    noms: ['Best Actor in a Leading Role', 'Best International Feature Film'], wins: [],
    cast: ['Antonio Banderas', 'Penélope Cruz', 'Asier Etxeandia'],
    cost: 18, units: 3,
  },
  {
    t: 'All We Imagine as Light', ot: 'All We Imagine as Light', ol: 'Malayalam / Hindi', director: 'Payal Kapadia',
    alt: [], dur: 118, year: 2024,
    g: ['Drama', 'Slow Cinema'],
    noms: [], wins: [],
    cast: ['Kani Kusruti', 'Divya Prabha', 'Chhaya Kadam'],
    cost: 17, units: 2,
  },
  {
    t: 'Oppenheimer', ot: 'Oppenheimer', ol: 'Inglés', director: 'Christopher Nolan',
    alt: [], dur: 180, year: 2023,
    g: ['Biografía', 'Drama Histórico', 'Drama'],
    noms: [
      'Best Picture', 'Best Directing', 'Best Actor in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Actress in a Supporting Role', 'Best Cinematography', 'Best Film Editing',
      'Best Original Score', 'Best Sound', 'Best Production Design', 'Best Costume Design',
      'Best Makeup and Hairstyling',
    ],
    wins: [
      'Best Picture', 'Best Directing', 'Best Actor in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Cinematography', 'Best Film Editing', 'Best Original Score',
    ],
    cast: ['Cillian Murphy', 'Emily Blunt', 'Robert Downey Jr.', 'Matt Damon'],
    cost: 25, units: 5,
  },
  {
    t: 'Everything Everywhere All at Once', ot: 'Everything Everywhere All at Once', ol: 'Inglés',
    director: 'Daniel Kwan, Daniel Scheinert',
    alt: [], dur: 139, year: 2022,
    g: ['Ciencia Ficción', 'Comedia', 'Acción'],
    noms: [
      'Best Picture', 'Best Directing', 'Best Actress in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Actress in a Supporting Role', 'Best Original Screenplay', 'Best Film Editing',
    ],
    wins: [
      'Best Picture', 'Best Directing', 'Best Actress in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Actress in a Supporting Role', 'Best Original Screenplay', 'Best Film Editing',
    ],
    cast: ['Michelle Yeoh', 'Ke Huy Quan', 'Jamie Lee Curtis', 'Stephanie Hsu'],
    cost: 20, units: 4,
  },
  {
    t: 'Poor Things', ot: 'Poor Things', ol: 'Inglés', director: 'Yorgos Lanthimos',
    alt: [], dur: 141, year: 2023,
    g: ['Fantasía', 'Comedia Negra', 'Ciencia Ficción'],
    noms: [
      'Best Picture', 'Best Directing', 'Best Actress in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Adapted Screenplay', 'Best Cinematography', 'Best Production Design',
      'Best Costume Design', 'Best Makeup and Hairstyling',
    ],
    wins: ['Best Actress in a Leading Role', 'Best Production Design', 'Best Makeup and Hairstyling', 'Best Costume Design'],
    cast: ['Emma Stone', 'Mark Ruffalo', 'Willem Dafoe'],
    cost: 22, units: 3,
  },
  {
    t: 'Killers of the Flower Moon', ot: 'Killers of the Flower Moon', ol: 'Inglés', director: 'Martin Scorsese',
    alt: [], dur: 206, year: 2023,
    g: ['Crimen', 'Drama Histórico', 'Western movies'],
    noms: [
      'Best Picture', 'Best Directing', 'Best Actress in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Cinematography', 'Best Original Score', 'Best Costume Design',
      'Best Production Design', 'Best Original Song', 'Best Film Editing',
    ],
    wins: [],
    cast: ['Leonardo DiCaprio', 'Robert De Niro', 'Lily Gladstone'],
    cost: 24, units: 3,
  },
  {
    t: 'Dune', ot: 'Dune', ol: 'Inglés', director: 'Denis Villeneuve',
    alt: [], dur: 155, year: 2021,
    g: ['Ciencia Ficción', 'Aventura'],
    noms: [
      'Best Picture', 'Best Cinematography', 'Best Film Editing', 'Best Original Score',
      'Best Production Design', 'Best Sound', 'Best Visual Effects', 'Best Costume Design',
      'Best Makeup and Hairstyling',
    ],
    wins: ['Best Cinematography', 'Best Film Editing', 'Best Original Score', 'Best Production Design', 'Best Sound', 'Best Visual Effects'],
    cast: ['Timothée Chalamet', 'Rebecca Ferguson', 'Zendaya', 'Oscar Isaac'],
    cost: 23, units: 4,
  },
  {
    t: 'Dune: Part Two', ot: 'Dune: Part Two', ol: 'Inglés', director: 'Denis Villeneuve',
    alt: [], dur: 166, year: 2024,
    g: ['Ciencia Ficción', 'Aventura', 'Acción'],
    noms: ['Best Picture', 'Best Cinematography', 'Best Original Score', 'Best Production Design', 'Best Sound', 'Best Visual Effects'],
    wins: ['Best Visual Effects'],
    cast: ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson', 'Austin Butler'],
    cost: 24, units: 5,
  },
  {
    t: 'Conclave', ot: 'Conclave', ol: 'Inglés', director: 'Edward Berger',
    alt: [], dur: 120, year: 2024,
    g: ['Drama', 'Suspenso', 'Misterio'],
    noms: [
      'Best Picture', 'Best Actor in a Leading Role', 'Best Actress in a Supporting Role',
      'Best Directing', 'Best Adapted Screenplay', 'Best Film Editing',
      'Best Original Score', 'Best Costume Design', 'Best Production Design',
    ],
    wins: ['Best Adapted Screenplay'],
    cast: ['Ralph Fiennes', 'Stanley Tucci', 'John Lithgow', 'Isabella Rossellini'],
    cost: 20, units: 3,
  },
  {
    t: 'Past Lives', ot: 'Past Lives', ol: 'Inglés / Coreano', director: 'Celine Song',
    alt: [], dur: 105, year: 2023,
    g: ['Romance', 'Drama'],
    noms: ['Best Picture', 'Best Original Screenplay'], wins: [],
    cast: ['Greta Lee', 'Teo Yoo', 'John Magaro'],
    cost: 17, units: 2,
  },
  {
    t: 'Spider-Man: Across the Spider-Verse', ot: 'Spider-Man: Across the Spider-Verse', ol: 'Inglés',
    director: 'Joaquim Dos Santos, Kemp Powers, Justin K. Thompson',
    alt: [], dur: 140, year: 2023,
    g: ['Animación', 'Aventura', 'Acción'],
    noms: ['Best Animated Feature Film'], wins: [],
    cast: ['Shameik Moore', 'Hailee Steinfeld', 'Brian Tyree Henry'],
    cost: 19, units: 4,
  },
  {
    t: 'Inside Out 2', ot: 'Inside Out 2', ol: 'Inglés', director: 'Kelsey Mann',
    alt: [], dur: 96, year: 2024,
    g: ['Animación', 'Comedia', 'Aventura'],
    noms: [], wins: [],
    cast: ['Amy Poehler', 'Maya Hawke', 'Kensington Tallman'],
    cost: 16, units: 4,
  },
  {
    t: 'Barbie', ot: 'Barbie', ol: 'Inglés', director: 'Greta Gerwig',
    alt: [], dur: 114, year: 2023,
    g: ['Comedia', 'Fantasía', 'Sátira'],
    noms: [
      'Best Picture', 'Best Actor in a Supporting Role', 'Best Actress in a Supporting Role',
      'Best Adapted Screenplay', 'Best Original Song', 'Best Production Design', 'Best Costume Design',
    ],
    wins: ['Best Original Song'],
    cast: ['Margot Robbie', 'Ryan Gosling', 'America Ferrera'],
    cost: 18, units: 5,
  },
  {
    t: 'La Chimera', ot: 'La Chimera', ol: 'Italiano', director: 'Alice Rohrwacher',
    alt: [], dur: 130, year: 2023,
    g: ['Fantasía', 'Drama', 'Comedia'],
    noms: [], wins: [],
    cast: ['Josh O’Connor', 'Isabella Rossellini', 'Carol Duarte'],
    cost: 17, units: 2,
  },
  {
    t: 'The Holdovers', ot: 'The Holdovers', ol: 'Inglés', director: 'Alexander Payne',
    alt: [], dur: 133, year: 2023,
    g: ['Comedia', 'Drama'],
    noms: [
      'Best Picture', 'Best Actor in a Leading Role', 'Best Actress in a Supporting Role',
      'Best Original Screenplay', 'Best Film Editing',
    ],
    wins: ['Best Actress in a Supporting Role'],
    cast: ['Paul Giamatti', 'Da’Vine Joy Randolph', 'Dominic Sessa'],
    cost: 17, units: 3,
  },
  {
    t: 'American Fiction', ot: 'American Fiction', ol: 'Inglés', director: 'Cord Jefferson',
    alt: [], dur: 117, year: 2023,
    g: ['Comedia', 'Drama', 'Sátira'],
    noms: [
      'Best Picture', 'Best Actor in a Leading Role', 'Best Actor in a Supporting Role',
      'Best Original Score', 'Best Adapted Screenplay',
    ],
    wins: ['Best Adapted Screenplay'],
    cast: ['Jeffrey Wright', 'Tracee Ellis Ross', 'Sterling K. Brown'],
    cost: 16, units: 2,
  },
];

async function main() {
  console.log('============================================================');
  console.log(' CARGA DE PELÍCULAS REALES — SEGUNDA TANDA');
  console.log(` Base: ${process.env.COUCHDB_DB}  |  catálogo nuevo: ${MOVIES.length} películas`);
  console.log('============================================================');

  const genres = await genreRepo.list();
  const genreIdByName = new Map(genres.map((g) => [g.name, g._id]));
  const usadosGeneros = new Set(MOVIES.flatMap((m) => m.g));
  const faltantesGeneros = [...usadosGeneros].filter((n) => !genreIdByName.has(n));
  if (faltantesGeneros.length > 0) {
    console.error('\nERROR: estos géneros no existen en la base:', faltantesGeneros);
    process.exit(1);
  }

  const oscarCats = await oscarCategoryRepo.list();
  const oscarIdByEn = new Map(oscarCats.map((c) => [c.name_en, c._id]));
  const usadosOscar = new Set(MOVIES.flatMap((m) => [...m.noms, ...m.wins]));
  const faltantesOscar = [...usadosOscar].filter((n) => !oscarIdByEn.has(n));
  if (faltantesOscar.length > 0) {
    console.error('\nERROR: estas categorías de Oscar no existen en la base:', faltantesOscar);
    process.exit(1);
  }

  const existentes = await videoRepo.list();
  const claveExistente = new Set(
    existentes.map((v) => `${(v.display_title || '').toLowerCase()}|${v.release_year}`)
  );

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
        director: m.director,
        alternative_titles: m.alt,
        duration_minutes: m.dur,
        genre_ids: m.g.map((n) => genreIdByName.get(n)),
        release_year: m.year,
        oscar_nominations: m.noms.map((n) => oscarIdByEn.get(n)),
        oscar_wins: m.wins.map((n) => oscarIdByEn.get(n)),
        main_actors: m.cast,
        unit_cost: m.cost,
        units_acquired: m.units,
      });
      creadas.push({ id: created._id, t: m.t });
      console.log(`  [crea]   "${m.t}" (${m.year}) -> ${created._id}  [${m.units} copia(s)]`);
    } catch (err) {
      console.error(`  [ERROR]  "${m.t}": ${err.message}`);
    }
  }

  const todos = await videoRepo.list();
  console.log('\n============================================================');
  console.log(` Creadas ahora: ${creadas.length}  |  Ya existían (saltadas): ${saltadas}`);
  console.log(` Total de películas en la base: ${todos.length}`);
  console.log('============================================================');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fallo en la carga de películas:', err);
  process.exit(1);
});
