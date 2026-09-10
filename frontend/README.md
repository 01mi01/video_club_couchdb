# Video Club — Frontend

Panel de administración (React + Vite + Tailwind CSS). Consume el backend
Express en `http://localhost:3001`.

## Requisitos previos

- El backend debe estar corriendo (`cd backend && node server.js`).
- Debe existir el usuario administrador (`node backend/scripts/create-admin.js`).

## Puesta en marcha

```bash
cd frontend
npm install                 # ya ejecutado; instala dependencias
cp .env.example .env         # ya existe; define VITE_API_URL
npm run dev                  # levanta Vite en http://localhost:5173
```

Abre `http://localhost:5173` e inicia sesión con las credenciales del
administrador (`ADMIN_USERNAME` / `ADMIN_PASSWORD` del `.env` del backend).

## Configuración

- `VITE_API_URL` (en `frontend/.env`): URL base del backend, con el
  prefijo `/api`. Por defecto `http://localhost:3001/api`.

## Estructura

```
src/
  api/           cliente axios (JWT, normalizacion de errores) + endpoints
  context/       AuthContext (token) y RefDataContext (cache de generos/clientes)
  components/    piezas de UI (sidebar, layout, modal, factura, buscador…)
  pages/         una pantalla por ruta
  lib/format.js  formato de fechas, moneda (Bs) y helpers
```

## Diseño

Retro-editorial: fondo crema hueso, azul oscuro como ancla, franjas
"arcoíris" en líneas rectas (azul → verde-azulado → amarillo → naranja →
naranja-rojizo) como acento estructural. Sidebar fijo de navegación.
