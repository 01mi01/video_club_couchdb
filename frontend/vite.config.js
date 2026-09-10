import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El backend corre en http://localhost:3001. Las llamadas del frontend
// usan VITE_API_URL (ver .env). El dev server del frontend usa el 5173.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
});
