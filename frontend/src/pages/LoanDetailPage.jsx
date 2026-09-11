import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
} from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';
import InvoiceView from '../components/InvoiceView.jsx';
import {
  money,
  dateShort,
  dateTime,
  toDateInput,
  fromDateInput,
  daysOverdue,
  LOAN_STATUS_LABEL,
} from '../lib/format.js';

export default function LoanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clientName } = useRefData();

  const { data, loading, error, reload } = useAsync(async () => {
    const loan = await API.getLoan(id);
    const invoice = await API.getLoanInvoice(id).catch(() => null);
    return { loan, invoice };
  }, [id]);

  const [action, setAction] = useState(null); // 'return' | 'writeoff'
  const [returnDate, setReturnDate] = useState(toDateInput(new Date().toISOString()));
  const [reason, setReason] = useState('no devuelto');
  const [busy, setBusy] = useState(false);
  const [modalErr, setModalErr] = useState(null);
  const [banner, setBanner] = useState(null);

  if (loading) return <Spinner label="Cargando préstamo…" />;
  if (error) return <Alert>{error}</Alert>;

  const { loan, invoice } = data;
  const over = loan.status === 'active' && daysOverdue(loan.due_date) > 0;

  async function doReturn(e) {
    e.preventDefault();
    setBusy(true);
    setModalErr(null);
    try {
      const res = await API.returnLoan(id, { return_date: fromDateInput(returnDate) });
      setAction(null);
      setBanner({
        kind: 'success',
        msg: res.loan?.returned_late
          ? `Devolución registrada con atraso (${res.loan.actual_days} días). Factura actualizada.`
          : 'Devolución registrada. Copias liberadas.',
      });
      await reload();
    } catch (err) {
      setModalErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doWriteOff(e) {
    e.preventDefault();
    setBusy(true);
    setModalErr(null);
    try {
      await API.writeOffLoan(id, { reason: reason.trim() || 'no devuelto' });
      setAction(null);
      setBanner({
        kind: 'success',
        msg: 'Préstamo cerrado por no devolución. Copia(s) dada(s) de baja.',
      });
      await reload();
    } catch (err) {
      setModalErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={`Préstamo`}
        subtitle={loan._id}
        actions={
          <>
            <Button variant="ghost" className="no-print" onClick={() => navigate('/prestamos')}>
              Volver
            </Button>
            {loan.status === 'active' && (
              <>
                <Button
                  className="no-print"
                  onClick={() => {
                    setAction('return');
                    setModalErr(null);
                    setReturnDate(toDateInput(new Date().toISOString()));
                  }}
                >
                  Registrar devolución
                </Button>
                <Button
                  variant="danger"
                  className="no-print"
                  onClick={() => {
                    setAction('writeoff');
                    setModalErr(null);
                    setReason('no devuelto');
                  }}
                >
                  Baja por no devolución
                </Button>
              </>
            )}
          </>
        }
      />

      {banner && (
        <div className="mb-4 no-print">
          <Alert kind={banner.kind} onClose={() => setBanner(null)}>
            {banner.msg}
          </Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="no-print lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Estado</h2>
            <Badge tone={loanStatusTone(loan.status)}>
              {LOAN_STATUS_LABEL[loan.status] || loan.status}
            </Badge>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Cliente" v={<Link className="underline hover:text-teal" to={`/clientes/${loan.client_id}`}>{clientName(loan.client_id)}</Link>} />
            <Row k="Fecha del préstamo" v={dateShort(loan.loan_date)} />
            <Row k="Días pactados" v={loan.days} />
            <Row
              k="Vence"
              v={
                <>
                  {dateShort(loan.due_date)} {over && <Badge tone="rust">vencido +{daysOverdue(loan.due_date)}d</Badge>}
                </>
              }
            />
            {loan.return_date && <Row k="Devuelto" v={dateTime(loan.return_date)} />}
            {loan.returned_late && <Row k="Devolución tardía" v={`${loan.actual_days} días reales`} />}
            {loan.closed_at && <Row k="Cerrado (no devolución)" v={dateTime(loan.closed_at)} />}
          </dl>
        </Card>

        <Card className="no-print lg:col-span-2" accent={false}>
          <h2 className="text-xl font-semibold">Películas prestadas</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Copia</th>
                  <th className="text-right"></th>
                </tr>
              </thead>
              <tbody>
                {(loan.items || []).map((it, i) => (
                  <tr key={i}>
                    <td className="font-semibold">{it.title}</td>
                    <td>{it.copy_id}</td>
                    <td className="text-right">
                      <Link className="text-xs underline hover:text-teal" to={`/videos/${it.video_id}`}>
                        ver película
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <Row k="Base" v={money(loan.pricing?.base_amount)} />
            <Row
              k={`Descuento (${loan.pricing?.discount_percent}%)`}
              v={`− ${money(loan.pricing?.discount_amount)}`}
            />
            <div className="flex justify-between border-t border-ink-line pt-2 text-lg font-semibold">
              <span>Total</span>
              <span>{money(loan.pricing?.total_amount)}</span>
            </div>
          </dl>
        </Card>
      </div>

      <div className="mt-4">
        <h2 className="mb-2 text-xl font-semibold no-print">Factura</h2>
        {invoice ? (
          <InvoiceView invoice={invoice} clientName={clientName(loan.client_id)} />
        ) : (
          <Alert kind="warn">No se pudo cargar la factura de este préstamo.</Alert>
        )}
      </div>

      {/* Modal devolucion */}
      <Modal
        open={action === 'return'}
        onClose={() => setAction(null)}
        title="Registrar devolución"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button form="return-form" type="submit" disabled={busy}>
              {busy ? 'Procesando…' : 'Confirmar devolución'}
            </Button>
          </>
        }
      >
        <form id="return-form" onSubmit={doReturn} className="space-y-4">
          {modalErr && <Alert onClose={() => setModalErr(null)}>{modalErr}</Alert>}
          <p className="text-sm text-ink-soft">
            El importe se recalcula según la fecha real de devolución. Si supera los días pactados,
            la factura deja constancia del atraso.
          </p>
          <Field label="Fecha de devolución">
            <TextInput
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </Field>
        </form>
      </Modal>

      {/* Modal baja por no devolucion */}
      <Modal
        open={action === 'writeoff'}
        onClose={() => setAction(null)}
        title="Baja por no devolución"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button form="writeoff-form" type="submit" variant="danger" disabled={busy}>
              {busy ? 'Procesando…' : 'Confirmar baja'}
            </Button>
          </>
        }
      >
        <form id="writeoff-form" onSubmit={doWriteOff} className="space-y-4">
          {modalErr && <Alert onClose={() => setModalErr(null)}>{modalErr}</Alert>}
          <Alert kind="warn">
            Esto da de baja permanentemente la(s) copia(s) de este préstamo y lo cierra como “no
            devuelto”. El importe pactado se mantiene.
          </Alert>
          <Field label="Razón" required>
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} required />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-ink-line pb-1">
      <span className="text-ink-soft">{k}</span>
      <span className="text-right text-ink">{v}</span>
    </div>
  );
}
