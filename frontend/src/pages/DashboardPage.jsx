import { Link, useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import * as API from '../api/endpoints.js';
import { PageHeader, Card, Spinner, Alert, Badge, Button, RainbowStripe } from '../components/ui.jsx';
import { money, dateShort, daysOverdue } from '../lib/format.js';

// Tarjeta de indicador (KPI). Conserva la franja de colores como acento
// de marca — es lo único "decorativo" que se mantiene del diseño anterior.
function Stat({ label, value, to, tone = 'ink' }) {
  const dot = { ink: 'bg-ink', teal: 'bg-teal', gold: 'bg-gold', rust: 'bg-rust' }[tone];
  return (
    <Link to={to} className="card block overflow-hidden transition-shadow hover:shadow-lg">
      <RainbowStripe />
      <div className="p-5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <p className="eyebrow">{label}</p>
        </div>
        <p className="mt-2 text-4xl font-bold text-ink">{value}</p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(async () => {
    const [videos, clients, loans, genres] = await Promise.all([
      API.listVideos(),
      API.listClients(),
      API.listLoans(),
      API.listGenres(),
    ]);
    return { videos, clients, loans, genres };
  }, []);

  if (loading) return <Spinner label="Cargando panel…" />;
  if (error) return <Alert>{error}</Alert>;

  const { videos, clients, loans, genres } = data;
  const activos = loans.filter((l) => l.status === 'active');
  const vencidos = activos.filter((l) => daysOverdue(l.due_date) > 0);
  const bloqueados = clients.filter((c) => c.blocked?.is_blocked);
  const copiasTotales = videos.reduce((n, v) => n + (v.copies?.length || 0), 0);
  const copiasPrestadas = videos.reduce(
    (n, v) => n + (v.copies?.filter((c) => c.status === 'loaned').length || 0),
    0
  );

  return (
    <div>
      <PageHeader
        title="Panel"
        actions={<Button onClick={() => navigate('/prestamos/nuevo')}>+ Nuevo préstamo</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Películas" value={videos.length} to="/videos" tone="ink" />
        <Stat label="Géneros" value={genres.length} to="/generos" tone="teal" />
        <Stat label="Clientes" value={clients.length} to="/clientes" tone="gold" />
        <Stat label="Préstamos activos" value={activos.length} to="/prestamos" tone="rust" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Copias</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between border-b border-ink-line pb-2">
              <dt className="text-ink-soft">Total de copias</dt>
              <dd className="font-semibold">{copiasTotales}</dd>
            </div>
            <div className="flex justify-between border-b border-ink-line pb-2">
              <dt className="text-ink-soft">Prestadas ahora</dt>
              <dd className="font-semibold">{copiasPrestadas}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Disponibles</dt>
              <dd className="font-semibold">{copiasTotales - copiasPrestadas}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Atención</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between border-b border-ink-line pb-2">
              <span className="text-ink-soft">Préstamos vencidos (sin devolver)</span>
              <Badge tone={vencidos.length ? 'rust' : 'soft'}>{vencidos.length}</Badge>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink-soft">Clientes bloqueados</span>
              <Badge tone={bloqueados.length ? 'rust' : 'soft'}>{bloqueados.length}</Badge>
            </li>
          </ul>
          {vencidos.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-ink-line pt-3 text-xs text-ink-soft">
              {vencidos.slice(0, 5).map((l) => (
                <div key={l._id} className="flex justify-between gap-2">
                  <Link className="font-medium text-ink hover:underline" to={`/prestamos/${l._id}`}>
                    {l._id.slice(0, 18)}…
                  </Link>
                  <span>
                    venció {dateShort(l.due_date)} · {money(l.pricing?.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
