import axios from 'axios';

// URL base del backend Express. Ver frontend/.env (VITE_API_URL).
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const TOKEN_KEY = 'vc_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export const api = axios.create({ baseURL, timeout: 15000 });

// Cada peticion protegida lleva el JWT: Authorization: Bearer <token>.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normaliza los errores del backend: este devuelve { error, details, hint }
// con el codigo HTTP correspondiente. Se convierte en un Error con
// `.status`, `.details` y `.hint` para que la UI muestre un mensaje claro
// y no un codigo crudo.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response) {
      const { status, data } = err.response;
      // 401: token ausente/invalido/expirado -> se limpia y se fuerza login.
      if (status === 401) {
        setToken(null);
        if (!location.pathname.startsWith('/login')) {
          location.assign('/login');
        }
      }
      const e = new Error(
        (data && (data.error || data.message)) || `Error ${status}`
      );
      e.status = status;
      e.details = data && data.details;
      e.hint = data && data.hint;
      return Promise.reject(e);
    }
    if (err.code === 'ECONNABORTED') {
      return Promise.reject(new Error('El backend tardo demasiado en responder.'));
    }
    return Promise.reject(
      new Error('No se pudo contactar el backend en ' + baseURL + '. Verifica que este corriendo.')
    );
  }
);

export { baseURL };
