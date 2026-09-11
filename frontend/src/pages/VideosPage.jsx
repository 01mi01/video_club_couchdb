import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as API from '../api/endpoints.js';
import { useRefData } from '../context/RefDataContext.jsx';
import { PageHeader, Card, Button, Spinner, Alert, Badge, EmptyState, IconButton, IconEye, IconPencil } from '../components/ui.jsx';
import VideoSearchBar from '../components/VideoSearchBar.jsx';
import { money } from '../lib/format.js';

function copiesSummary(v) {
  const cs = v.copies || [];
  const disp = cs.filter((c) => c.status === 'available').length;
  const pres = cs.filter((c) => c.status === 'loaned').length;
  const baja = cs.filter((c) => c.status === 'retired').length;
  return { disp, pres, baja, total: cs.length };
}

export default function VideosPage() {
  const navigate = useNavigate();
  const { genreNames } = useRefData();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState('all'); // 'all' | 'search'

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await API.listVideos();
      setRows(list);
      setMode('all');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function onSearch(params) {
    if (Object.keys(params).length === 0) return loadAll();
    setSearching(true);
    setError(null);
    try {
      const list = await API.searchVideos(params);
      setRows(list);
      setMode('search');
    } catch (e) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Películas"
        actions={<Button onClick={() => navigate('/videos/nuevo')}>Nueva película</Button>}
      />

      <div className="mb-4">
        <VideoSearchBar onSearch={onSearch} onClear={loadAll} busy={searching} />
      </div>

      {error && (
        <div className="mb-4">
          <Alert onClose={() => setError(null)}>{error}</Alert>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between text-sm text-ink-soft">
        <span>
          {mode === 'search' ? 'Resultados de búsqueda' : 'Catálogo completo'} · {rows.length}{' '}
          película{rows.length === 1 ? '' : 's'}
        </span>
        {mode === 'search' && (
          <button className="underline hover:text-ink" onClick={loadAll}>
            Ver catálogo completo
          </button>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState
          title={mode === 'search' ? 'Sin resultados' : 'Catálogo vacío'}
          hint={mode === 'search' ? 'Ajustar los criterios de búsqueda.' : 'Registrar la primera película.'}
        />
      ) : (
        <Card accent={false}>
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Año</th>
                  <th>Géneros</th>
                  <th>Duración</th>
                  <th>Copias</th>
                  <th className="!text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const s = copiesSummary(v);
                  return (
                    <tr key={v._id}>
                      <td>
                        <Link to={`/videos/${v._id}`} className="font-semibold underline hover:text-teal">
                          {v.display_title}
                        </Link>
                        {v.oscar_wins?.length > 0 && (
                          <span className="ml-2 align-middle">
                            <Badge tone="gold">{v.oscar_wins.length} Oscar</Badge>
                          </span>
                        )}
                        <div className="text-xs text-ink-soft">
                          {(v.main_actors || []).slice(0, 3).join(', ')}
                        </div>
                      </td>
                      <td>{v.release_year}</td>
                      <td className="max-w-xs text-xs text-ink-soft">
                        {genreNames(v.genre_ids).join(' · ')}
                      </td>
                      <td className="whitespace-nowrap">{v.duration_minutes} min</td>
                      <td className="whitespace-nowrap text-xs">
                        <span className="text-teal">{s.disp} disp.</span>
                        {' / '}
                        <span className="text-[#8a5a10]">{s.pres} prest.</span>
                        {s.baja > 0 && <span className="text-rust"> / {s.baja} baja</span>}
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <IconButton label="Ver película" onClick={() => navigate(`/videos/${v._id}`)}>
                            <IconEye />
                          </IconButton>
                          <IconButton
                            label="Editar película"
                            onClick={() => navigate(`/videos/${v._id}/editar`)}
                          >
                            <IconPencil />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-3 text-xs text-ink-soft">
        Precio unitario de referencia del DVD y unidades adquiridas se ven en el detalle de cada
        película. Costo promedio del catálogo:{' '}
        {rows.length
          ? money(rows.reduce((n, v) => n + (v.unit_cost || 0), 0) / rows.length)
          : '—'}
        .
      </p>
    </div>
  );
}
