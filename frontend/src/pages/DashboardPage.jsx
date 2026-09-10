import { Link, useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import * as API from '../api/endpoints.js';
import { PageHeader, Card, Spinner, Alert, Badge, Button, RainbowStripe } from '../components/ui.jsx';
import { money, dateShort, daysOverdue } from '../lib/format.js';

function Stat({ label, value, to, tone = 'ink' }) {
  const border = { ink: 'border-ink', teal: 'border-teal', gold: 'border-gold', rust: 'border-rust' }[tone];
  return (
    <Link to={to} className={`card block border-2 ${border} transition-transform hover:-translate-y-0.5`}>
      <RainbowStripe />
      <div className="p-5">
        <p className="eyebrow">{label}</p>
        <p className="mt-2 font-display text-4xl font-semibold text-ink">{value}</p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(async () => {
    const [health, videos, clients, loans, genres] = await Promise.all([
      API.getHealth().catch(() => null),
      API.listVideos(),
      API.listClients(),
      API.listLoans(),
      API.listGenres(),
    ]);
    return { health, videos, clients, loans, genres };
  }, []);

  if (loading) return <Spinner label="Cargando panel…" />;
  if (error) return <Alert>{error}</Alert>;

  const { health, videos, clients, loans, genres } = data;
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
        subtitle="Resumen del videoclub: estado del backend, catálogo, clientes y préstamos en curso."
        actions={
          <Button variant="accent" onClick={() => navigate('/prestamos/nuevo')}>
            Nuevo préstamo
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="eyebrow">Backend</span>
        {health ? <Badge tone="teal">Conectado</Badge> : <Badge tone="rust">Sin respuesta</Badge>}
        <span className="text-ink-soft">
          {import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Películas" value={videos.length} to="/videos" tone="ink" />
        <Stat label="Géneros" value={genres.length} to="/generos" tone="teal" />
        <Stat label="Clientes" value={clients.length} to="/clientes" tone="gold" />
        <Stat label="Préstamos activos" value={activos.length} to="/prestamos" tone="rust" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">Copias</h2>
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
          <h2 className="text-xl font-semibold">Atención</h2>
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
            <div className="mt-3 space-y-1 border-t border-ink-line pt-3 text-xs text-ink-soft">
              {vencidos.slice(0, 5).map((l) => (
                <div key={l._id} className="flex justify-between gap-2">
                  <Link className="underline hover:text-ink" to={`/prestamos/${l._id}`}>
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
