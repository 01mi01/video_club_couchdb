import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as API from '../api/endpoints.js';
import { fullName } from '../lib/format.js';

// Cache liviano de GENEROS y CLIENTES: se cargan una vez tras el login y
// sirven para resolver referencias por id (los videos guardan genre_ids,
// los prestamos guardan client_id). Cualquier pantalla que cree/edite uno
// de estos llama a refresh* para mantenerlo al dia.
const RefDataContext = createContext(null);

export function RefDataProvider({ children }) {
  const [genres, setGenres] = useState([]);
  const [oscarCategories, setOscarCategories] = useState([]);
  const [zones, setZones] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refreshGenres = useCallback(async () => {
    const g = await API.listGenres();
    setGenres(Array.isArray(g) ? g : []);
    return g;
  }, []);

  const refreshOscarCategories = useCallback(async () => {
    const o = await API.listOscarCategories();
    setOscarCategories(Array.isArray(o) ? o : []);
    return o;
  }, []);

  const refreshZones = useCallback(async () => {
    const z = await API.listZones();
    setZones(Array.isArray(z) ? z : []);
    return z;
  }, []);

  const refreshClients = useCallback(async () => {
    const c = await API.listClients();
    setClients(Array.isArray(c) ? c : []);
    return c;
  }, []);

  // Carga combinada (inicial y reintento). Deja `error` con el mensaje real
  // del backend para que el banner lo muestre.
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [g, o, z, c] = await Promise.all([
        API.listGenres(),
        API.listOscarCategories(),
        API.listZones(),
        API.listClients(),
      ]);
      if (!alive.current) return;
      setGenres(Array.isArray(g) ? g : []);
      setOscarCategories(Array.isArray(o) ? o : []);
      setZones(Array.isArray(z) ? z : []);
      setClients(Array.isArray(c) ? c : []);
      setError(null);
    } catch (e) {
      if (alive.current) setError(e.message || 'No se pudieron cargar los datos de referencia.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const genreName = useCallback((id) => genres.find((x) => x._id === id)?.name || id, [genres]);
  const genreNames = useCallback((ids) => (ids || []).map(genreName), [genreName]);
  // Nombre en ESPAÑOL de una categoría de Oscar por id (fallback: el id
  // mismo, para no romper la pantalla si la referencia quedó huérfana).
  const oscarCategoryName = useCallback(
    (id) => oscarCategories.find((x) => x._id === id)?.name_es || id,
    [oscarCategories]
  );
  const oscarCategoryNames = useCallback(
    (ids) => (ids || []).map(oscarCategoryName),
    [oscarCategoryName]
  );
  const zoneById = useCallback((id) => zones.find((x) => x._id === id) || null, [zones]);
  const zoneName = useCallback((id) => zones.find((x) => x._id === id)?.name || null, [zones]);
  const clientById = useCallback((id) => clients.find((x) => x._id === id) || null, [clients]);
  const clientName = useCallback(
    (id) => {
      const c = clients.find((x) => x._id === id);
      return c ? fullName(c) : id;
    },
    [clients]
  );

  return (
    <RefDataContext.Provider
      value={{
        genres,
        oscarCategories,
        zones,
        clients,
        loading,
        error,
        reload,
        refreshGenres,
        refreshOscarCategories,
        refreshZones,
        refreshClients,
        genreName,
        genreNames,
        oscarCategoryName,
        oscarCategoryNames,
        zoneById,
        zoneName,
        clientById,
        clientName,
      }}
    >
      {children}
    </RefDataContext.Provider>
  );
}

export function useRefData() {
  const ctx = useContext(RefDataContext);
  if (!ctx) throw new Error('useRefData debe usarse dentro de <RefDataProvider>');
  return ctx;
}
