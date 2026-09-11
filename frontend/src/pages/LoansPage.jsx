import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import * as API from '../api/endpoints.js';
import { useRefData } from '../context/RefDataContext.jsx';
import {
  PageHeader,
  Card,
  Button,
  Spinner,
  Alert,
  Badge,
  EmptyState,
  loanStatusTone,
  IconButton,
  IconEye,
} from '../components/ui.jsx';
import { dateShort, money, daysOverdue, LOAN_STATUS_LABEL } from '../lib/format.js';

const FILTERS = [
  { key: 'active', label: 'Activos' },
  { key: 'overdue', label: 'Vencidos' },
  { key: 'unreturned', label: 'No devueltos' },
  { key: 'returned', label: 'Devueltos' },
  { key: 'all', label: 'Todos' },
];

export default function LoansPage() {
  const navigate = useNavigate();
  const { clientName } = useRefData();
  const { data: loans, loading, error } = useAsync(() => API.listLoans(), []);
  const [filter, setFilter] = useState('active');

  const rows = useMemo(() => {
    const list = loans || [];
    let f = list;
    if (filter === 'active') f = list.filter((l) => l.status === 'active');
    else if (filter === 'overdue')
      f = list.filter((l) => l.status === 'active' && daysOverdue(l.due_date) > 0);
    else if (filter === 'unreturned') f = list.filter((l) => l.status === 'unreturned');
    else if (filter === 'returned') f = list.filter((l) => l.status === 'returned');
    return [...f].sort((a, b) => new Date(b.loan_date) - new Date(a.loan_date));
  }, [loans, filter]);

  return (
    <div>
      <PageHeader
        title="Préstamos"
        actions={<Button onClick={() => navigate('/prestamos/nuevo')}>Nuevo préstamo</Button>}
      />

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-ink text-white' : 'bg-ink/5 text-ink-soft hover:bg-ink/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState title="Sin préstamos" hint="Registrar uno con “Nuevo préstamo”." />
      ) : (
        <Card accent={false}>
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Películas</th>
                  <th>Días</th>
                  <th>Vence</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th className="!text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const over = l.status === 'active' && daysOverdue(l.due_date) > 0;
                  return (
                    <tr key={l._id}>
                      <td className="whitespace-nowrap">{dateShort(l.loan_date)}</td>
                      <td>
                        <Link
                          to={`/clientes/${l.client_id}`}
                          className="underline hover:text-teal"
                        >
                          {clientName(l.client_id)}
                        </Link>
                      </td>
                      <td className="text-xs text-ink-soft">
                        {(l.items || []).map((it) => it.title).join(', ')}
                      </td>
                      <td>{l.days}</td>
                      <td className="whitespace-nowrap">
                        {dateShort(l.due_date)}
                        {over && (
                          <span className="ml-1 align-middle">
                            <Badge tone="rust">+{daysOverdue(l.due_date)}d</Badge>
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{money(l.pricing?.total_amount)}</td>
                      <td>
                        <Badge tone={loanStatusTone(l.status)}>
                          {LOAN_STATUS_LABEL[l.status] || l.status}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <IconButton label="Ver préstamo" onClick={() => navigate(`/prestamos/${l._id}`)}>
                          <IconEye />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
