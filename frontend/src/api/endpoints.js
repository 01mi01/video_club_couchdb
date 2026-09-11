import { api } from './client.js';

// ============================================================================
// Mapa 1:1 con los endpoints del backend. Cada funcion aqui corresponde a
// una ruta de Express (ver backend/routes/*). La UI llama SIEMPRE por aqui.
// ============================================================================

const data = (p) => p.then((r) => r.data);

// --- Diagnostico (publico) ---
export const getHealth = () => data(api.get('/health'));

// --- Autenticacion ---
export const login = (username, password) =>
  data(api.post('/login', { username, password }));

// --- Generos (entidad normalizada; relacion muchos-a-muchos con videos) ---
export const listGenres = () => data(api.get('/genres'));
export const getGenre = (id) => data(api.get(`/genres/${id}`));
export const createGenre = (body) => data(api.post('/genres', body));
export const updateGenre = (id, body) => data(api.put(`/genres/${id}`, body));
// Sin DELETE: el género se desactiva/reactiva (soft delete), nunca se
// borra de verdad. Ver CLAUDE.md — el enunciado nunca pide "eliminar".
export const deactivateGenre = (id) => data(api.patch(`/genres/${id}/deactivate`));
export const activateGenre = (id) => data(api.patch(`/genres/${id}/activate`));

// --- Videos (peliculas) ---
// App de un solo propietario: se pide un limite amplio para traer todo el
// catalogo de una vez (las tablas del frontend no paginan).
export const listVideos = (params) => data(api.get('/videos', { params: { limit: 1000, ...(params || {}) } }));
export const getVideo = (id) => data(api.get(`/videos/${id}`));
export const createVideo = (body) => data(api.post('/videos', body));
export const updateVideo = (id, body) => data(api.put(`/videos/${id}`, body));
// Busqueda por nombre / genero / actor / nominacion al Oscar (indices Mango).
export const searchVideos = (params) => data(api.get('/videos/search', { params }));
// Alta y baja de copias.
export const addCopies = (id, body) => data(api.post(`/videos/${id}/copies`, body));
export const retireCopy = (id, copyId, body) =>
  data(api.post(`/videos/${id}/copies/${copyId}/retire`, body));

// --- Clientes ---
export const listClients = () => data(api.get('/clients', { params: { limit: 1000 } }));
export const getClient = (id) => data(api.get(`/clients/${id}`));
export const createClient = (body) => data(api.post('/clients', body));
export const updateClient = (id, body) => data(api.put(`/clients/${id}`, body));
export const blockClient = (id, body) => data(api.post(`/clients/${id}/block`, body));
export const unblockClient = (id) => data(api.post(`/clients/${id}/unblock`));

// --- Prestamos y facturas ---
export const quoteLoan = (body) => data(api.post('/loans/quote', body));
export const createLoan = (body) => data(api.post('/loans', body));
export const listLoans = () => data(api.get('/loans', { params: { limit: 1000 } }));
export const getLoan = (id) => data(api.get(`/loans/${id}`));
export const getLoanInvoice = (id) => data(api.get(`/loans/${id}/invoice`));
export const returnLoan = (id, body) => data(api.post(`/loans/${id}/return`, body));
export const writeOffLoan = (id, body) => data(api.post(`/loans/${id}/write-off`, body));
export const listInvoices = () => data(api.get('/invoices', { params: { limit: 1000 } }));
export const getInvoice = (id) => data(api.get(`/invoices/${id}`));

// --- Configuracion (precios por dia / descuentos por cantidad) ---
export const getPricing = () => data(api.get('/config/pricing'));
export const setPricing = (body) => data(api.put('/config/pricing', body));
export const getDiscounts = () => data(api.get('/config/discounts'));
export const setDiscounts = (body) => data(api.put('/config/discounts', body));
