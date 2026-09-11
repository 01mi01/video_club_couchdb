import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import * as API from '../api/endpoints.js';
import { PageHeader, Card, Button, Spinner, Alert, Badge, EmptyState, TextInput, IconButton, IconEye, IconPencil } from '../components/ui.jsx';
import { useRefData } from '../context/RefDataContext.jsx';
import { fullName, fullAddress, dateShort } from '../lib/format.js';

export default function ClientsPage() {
  const navigate = useNavigate();
  const { zoneName } = useRefData();
  const { data: clients, loading, error } = useAsync(() => API.listClients(), []);
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const list = clients || [];
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? list.filter(
          (c) =>
            fullName(c).toLowerCase().includes(needle) ||
            (c.email || '').toLowerCase().includes(needle) ||
            (c.phone_mobile || '').includes(needle)
        )
      : list;
    return [...filtered].sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [clients, q]);

  return (
    <div>
      <PageHeader
        title="Clientes"
        actions={<Button onClick={() => navigate('/clientes/nuevo')}>Nuevo cliente</Button>}
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : (
        <>
          <div className="mb-4 max-w-sm">
            <TextInput
              placeholder="Buscar por nombre, correo o teléfono…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState title="Sin clientes" hint="Registrar el primero con “Nuevo cliente”." />
          ) : (
            <Card accent={false}>
              <div className="overflow-x-auto">
                <table className="table-editorial">
                  <thead>
                    <tr>
                      <th>Nombre completo</th>
                      <th>Teléfono</th>
                      <th>Correo</th>
                      <th>Dirección</th>
                      <th>Registro</th>
                      <th>Estado</th>
                      <th className="!text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c._id}>
                        <td>
                          <Link
                            to={`/clientes/${c._id}`}
                            className="font-semibold underline hover:text-teal"
                          >
                            {fullName(c)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">{c.phone_mobile}</td>
                        <td className="text-ink-soft">{c.email || '—'}</td>
                        <td className="max-w-xs truncate text-xs text-ink-soft">
                          {fullAddress(c, zoneName(c.address?.zone_id))}
                        </td>
                        <td className="whitespace-nowrap text-xs">{dateShort(c.registered_at)}</td>
                        <td>
                          {c.blocked?.is_blocked ? (
                            <Badge tone="rust">Bloqueado</Badge>
                          ) : (
                            <Badge tone="teal">Activo</Badge>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <IconButton
                              label="Ver cliente"
                              onClick={() => navigate(`/clientes/${c._id}`)}
                            >
                              <IconEye />
                            </IconButton>
                            <IconButton
                              label="Editar cliente"
                              onClick={() => navigate(`/clientes/${c._id}/editar`)}
                            >
                              <IconPencil />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
