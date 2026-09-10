/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // --- Paleta "retro-editorial" (ver CLAUDE.md > Frontend - Diseno visual) ---
        // El fondo real es un crema/hueso muy claro casi blanco, NO el
        // #ffebbe (ese es el acento calido).
        paper: '#fdf8ec', // fondo principal (crema hueso muy claro)
        'paper-panel': '#f6eed9', // paneles / zonas sutilmente diferenciadas
        cream: '#ffebbe', // acento calido (franjas, fondos de badge suaves)
        ink: '#1a3852', // azul oscuro: texto principal, headers, ancla
        'ink-soft': '#5a7085', // texto secundario derivado del azul
        'ink-line': '#1a385222', // lineas/bordes tenues del azul
        teal: '#0d9797', // acento secundario verde-azulado
        gold: '#f7b239', // acento amarillo-naranja
        orange: '#f19a29', // acento naranja calido
        rust: '#c1502e', // naranja-rojizo (extremo calido del "arcoiris")
      },
      fontFamily: {
        // Serif editorial para titulos (aire a portada de libro clasico).
        display: ['"Iowan Old Style"', '"Palatino Linotype"', '"Book Antiqua"', 'Palatino', 'Georgia', 'serif'],
        // Sans limpia para el cuerpo.
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 #1a385214, 0 2px 8px -4px #1a385233',
      },
      letterSpacing: {
        label: '0.12em',
      },
    },
  },
  plugins: [],
};
