# Video Club

Sistema de gestión para un club de alquiler de videos. 

## Stack
- Backend: Node.js + Express
- Base de datos: CouchDB (vía `nano`)
- Frontend: React

## Estructura del proyecto

```
video_club_couchdb/
backend/ -> API REST (Express + CouchDB)
frontend/ -> interfaz React
```

## Requisitos previos
- Node.js instalado
- CouchDB instalado y corriendo localmente como servicio (http://127.0.0.1:5984)
- Base de datos `video_club_db` creada en CouchDB (vía Fauxton)
- CORS habilitado en CouchDB

## Iniciar el backend

```bash
cd backend
npm install
```

## Configurar las variables de entorno
Crear un archivo `.env` dentro de `backend/` (usar `.env.example` como referencia):

```
COUCHDB_URL=http://127.0.0.1:5984
COUCHDB_USER=admin
COUCHDB_PASSWORD=tu_password
COUCHDB_DB=video_club_db
PORT=3001
JWT_SECRET=tu_secreto_random
ADMIN_USERNAME=tu_usuario_elegido
ADMIN_PASSWORD=tu_password_elegido
```

## Configuración inicial 

```bash
node scripts/create-admin.js
node scripts/create-indexes.js
```

Esto crea el usuario propietario y los índices de búsqueda en CouchDB.
Solo se ejecuta una vez.

## Iniciar el servidor
```bash
npm start
```
El servidor corre en `http://localhost:3001`.

## Iniciar el frontend

```bash
cd frontend
npm install
```

Crear un archivo `.env` dentro de `frontend/` (usar `.env.example` como referencia):

```
VITE_API_URL=http://localhost:3001/api
```

Correr el frontend:
```bash
npm run dev
```

Abrir `http://localhost:5173`

**Requisito**: el backend debe estar corriendo (`npm start` dentro de
`backend/`) antes de usar el frontend.

Iniciar sesión con las credenciales `ADMIN_USERNAME` / `ADMIN_PASSWORD`
configuradas en `backend/.env` al ejecutar `create-admin.js`.

## Cómo iniciar todo el proyecto (orden completo)

1. Asegurarse de que CouchDB esté corriendo (servicio de Windows).
2. `cd backend && npm install && npm start`
3. En otra terminal: `cd frontend && npm install && npm run dev`
4. Abrir el frontend en el navegador e iniciar sesión.
