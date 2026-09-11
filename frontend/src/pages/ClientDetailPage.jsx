import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Field,
  TextInput,
  loanStatusTone,
  IconButton,
  IconEye,
} from '../components/ui.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { fullName, dateShort, money, LOAN_STATUS_LABEL } from '../lib/format.js';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshClients } = useRefData();

  const { data, loading, error, reload } = useAsync(async () => {
    const [client, loans] = await Promise.all([API.getClient(id), API.listLoans()]);
    return { client, loans: loans.filter((l) => l.client_id === id) };
  }, [id]);

  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // null | 'block' | 'unblock'
  const [confirmErr, setConfirmErr] = useState(null);

  if (loading) return <Spinner label="Cargando cliente…" />;
  if (error) return <Alert>{error}</Alert>;

  const { client: c, loans } = data;
  const blocked = c.blocked?.is_blocked;

  function askBlock() {
    if (!reason.trim()) {
      setBanner({ kind: 'error', msg: 'Debe indicarse la razón del bloqueo.' });
      return;
    }
    setConfirmErr(null);
    setConfirmAction('block');
  }

  async function doBlock() {
    setBusy(true);
    setConfirmErr(null);
    try {
      await API.blockClient(id, { reason: reason.trim() });
      setReason('');
      setConfirmAction(null);
      setBanner({ kind: 'success', msg: 'Cliente bloqueado.' });
      await reload();
      await refreshClients();
    } catch (err) {
      setConfirmErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doUnblock() {
    setBusy(true);
    setConfirmErr(null);
    try {
      await API.unblockClient(id);
      setConfirmAction(null);
      setBanner({ kind: 'success', msg: 'Cliente desbloqueado.' });
      await reload();
      await refreshClients();
    } catch (err) {
      setConfirmErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  const geo = c.address?.geo;

  return (
    <div>
      <PageHeader
        title={fullName(c)}
        subtitle={c.email}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/clientes')}>
              Volver
            </Button>
            <Button variant="ghost" onClick={() => navigate(`/clientes/${id}/editar`)}>
              Editar
            </Button>
          </>
        }
      />

      {banner && (
        <div className="mb-4">
          <Alert kind={banner.kind} onClose={() => setBanner(null)}>
            {banner.msg}
          </Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-xl font-semibold">Datos</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Row k="Teléfono celular" v={c.phone_mobile} />
            <Row k="Correo" v={c.email} />
            <Row k="Fecha de nacimiento" v={dateShort(c.birth_date)} />
            <Row k="Fecha de registro" v={dateShort(c.registered_at)} />
            <Row k="Dirección" v={c.address?.text || '—'} wide />
            <Row
              k="Geolocalización"
              wide
              v={
                geo ? (
                  <>
                    {geo.lat}, {geo.lng}{' '}
                    <a
                      className="underline hover:text-teal"
                      href={`https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=15/${geo.lat}/${geo.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      ver mapa
                    </a>
                  </>
                ) : (
                  '—'
                )
              }
            />
          </dl>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Estado</h2>
            {blocked ? <Badge tone="rust">Bloqueado</Badge> : <Badge tone="teal">Activo</Badge>}
          </div>

          {blocked ? (
            <div className="mt-3 space-y-3 text-sm">
              <p className="text-ink-soft">
                Bloqueado el {dateShort(c.blocked.date)}.
                <br />
                Razón: <span className="text-ink">{c.blocked.reason}</span>
              </p>
              <p className="text-xs text-ink-soft">
                Un cliente bloqueado no puede registrar préstamos.
              </p>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmErr(null);
                  setConfirmAction('unblock');
                }}
                disabled={busy}
              >
                Desbloquear
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <Field label="Razón del bloqueo">
                <TextInput
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ej. Copias no devueltas"
                />
              </Field>
              <Button variant="danger" onClick={askBlock} disabled={busy}>
                Bloquear cliente
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4" accent={false}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Préstamos del cliente</h2>
          <Button size="sm" onClick={() => navigate('/prestamos/nuevo', { state: { clientId: id } })}>
            Nuevo préstamo
          </Button>
        </div>
        {loans.length === 0 ? (
          <p className="text-sm text-ink-soft">Sin préstamos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Películas</th>
                  <th>Días</th>
                  <th>Vence</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th className="!text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loans
                  .sort((a, b) => new Date(b.loan_date) - new Date(a.loan_date))
                  .map((l) => (
                    <tr key={l._id}>
                      <td className="whitespace-nowrap">{dateShort(l.loan_date)}</td>
                      <td>{l.items?.length}</td>
                      <td>{l.days}</td>
                      <td className="whitespace-nowrap">{dateShort(l.due_date)}</td>
                      <td className="whitespace-nowrap">{money(l.pricing?.total_amount)}</td>
                      <td>
                        <Badge tone={loanStatusTone(l.status)}>
                          {LOAN_STATUS_LABEL[l.status] || l.status}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <IconButton label="Ver préstamo" onClick={() => navigate(`/prestamos/${l._id}`)}>
                          <IconEye />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmAction === 'block'}
        title="Bloquear cliente"
        message={`¿Bloquear a ${fullName(c)}?`}
        detail={`Razón: "${reason.trim()}". Mientras esté bloqueado no podrá registrar préstamos.`}
        confirmLabel="Bloquear"
        danger
        busy={busy}
        error={confirmErr}
        onCancel={() => setConfirmAction(null)}
        onConfirm={doBlock}
      />
      <ConfirmDialog
        open={confirmAction === 'unblock'}
        title="Desbloquear cliente"
        message={`¿Desbloquear a ${fullName(c)}?`}
        detail="Volverá a poder registrar préstamos."
        confirmLabel="Desbloquear"
        danger
        busy={busy}
        error={confirmErr}
        onCancel={() => setConfirmAction(null)}
        onConfirm={doUnblock}
      />
    </div>
  );
}

function Row({ k, v, wide }) {
  return (
    <div className={`border-b border-ink-line py-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-xs uppercase tracking-label text-ink-soft">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}
