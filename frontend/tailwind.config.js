/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // --- Paleta de marca (ver CLAUDE.md > Frontend - Diseno visual) ---
        // Sitio moderno, no "retro-editorial": el fondo es casi blanco puro
        // con solo un toque cálido — los colores de marca (cream incluido)
        // quedan como ACENTO (franjas, badges), nunca como fondo dominante.
        paper: '#faf9f7', // fondo principal: casi blanco, toque cálido mínimo
        'paper-panel': '#f2f0ec', // paneles / zonas sutilmente diferenciadas
        cream: '#ffebbe', // acento de marca (franjas, badges suaves) — NO fondo
        ink: '#1a3852', // azul oscuro: texto principal, headers, botones primarios
        'ink-soft': '#5f7387', // texto secundario derivado del azul
        'ink-line': '#1a385220', // lineas/bordes tenues del azul
        teal: '#0d9797', // acento secundario verde-azulado
        gold: '#f7b239', // acento amarillo-naranja
        orange: '#f19a29', // acento naranja calido
        rust: '#c1502e', // naranja-rojizo (extremo calido de la franja de marca)
      },
      fontFamily: {
        // Una sola familia sans-serif moderna para todo el sitio (titulos y
        // cuerpo) — ver CLAUDE.md: ya no es un concepto retro/editorial.
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px 0 #1a385210, 0 8px 24px -12px #1a385230',
        soft: '0 1px 2px 0 #1a385212',
      },
      letterSpacing: {
        label: '0.08em',
      },
    },
  },
  plugins: [],
};
