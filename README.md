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
```

## Iniciar el servidor
```bash
npm start
```
El servidor corre en `http://localhost:3001`.