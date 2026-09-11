import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as API from '../api/endpoints.js';
import { useRefData } from '../context/RefDataContext.jsx';
import {
  PageHeader,
  Card,
  Button,
  Alert,
  Badge,
  Field,
  Select,
  TextInput,
  Spinner,
  EmptyState,
} from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';
import VideoSearchBar from '../components/VideoSearchBar.jsx';
import InvoiceView from '../components/InvoiceView.jsx';
import { fullName, money, dateShort } from '../lib/format.js';

export default function NewLoanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clients, clientName } = useRefData();

  const [clientId, setClientId] = useState(location.state?.clientId || '');
  const [cart, setCart] = useState([]); // [{ video_id, title, available, qty }]
  const [termMode, setTermMode] = useState('days'); // 'days' | 'due'
  const [days, setDays] = useState(2);
  const [dueDate, setDueDate] = useState('');
  const [maxDays, setMaxDays] = useState(5);

  const [searchRows, setSearchRows] = useState(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchErr, setSearchErr] = useState(null);

  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState(null);
  const [quoting, setQuoting] = useState(false);

  const [submitErr, setSubmitErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { loan, invoice }

  const client = clients.find((c) => c._id === clientId) || null;
  const blocked = client?.blocked?.is_blocked;
  const totalUnits = cart.reduce((n, i) => n + i.qty, 0);

  useEffect(() => {
    API.getPricing()
      .then((p) => {
        setMaxDays(p.max_days || 5);
        setDays((d) => Math.min(d, p.max_days || 5));
      })
      .catch(() => {});
  }, []);

  // --- Busqueda ---
  async function onSearch(params) {
    if (Object.keys(params).length === 0) return;
    setSearchBusy(true);
    setSearchErr(null);
    try {
      setSearchRows(await API.searchVideos(params));
    } catch (e) {
      setSearchErr(e.message);
    } finally {
      setSearchBusy(false);
    }
  }

  // --- Carrito ---
  function addVideo(v) {
    const available = (v.copies || []).filter((c) => c.status === 'available').length;
    setCart((prev) => {
      const found = prev.find((i) => i.video_id === v._id);
      if (found) {
        if (found.qty >= available) return prev;
        return prev.map((i) => (i.video_id === v._id ? { ...i, qty: i.qty + 1 } : i));
      }
      if (available < 1) return prev;
      return [...prev, { video_id: v._id, title: v.display_title, available, qty: 1 }];
    });
  }
  function setQty(video_id, qty) {
    setCart((prev) =>
      prev
        .map((i) => (i.video_id === video_id ? { ...i, qty: Math.max(0, Math.min(qty, i.available)) } : i))
        .filter((i) => i.qty > 0)
    );
  }
  function removeItem(video_id) {
    setCart((prev) => prev.filter((i) => i.video_id !== video_id));
  }

  // --- Cotizacion automatica cuando cambian los datos ---
  const buildBody = useCallback(() => {
    const items = [];
    for (const i of cart) for (let k = 0; k < i.qty; k++) items.push({ video_id: i.video_id });
    const body = { client_id: clientId, items };
    if (termMode === 'days') body.days = Number(days);
    else body.due_date = dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined;
    return body;
  }, [cart, clientId, termMode, days, dueDate]);

  const quoteTimer = useRef();
  useEffect(() => {
    setQuote(null);
    setQuoteErr(null);
    if (!clientId || totalUnits === 0) return;
    if (termMode === 'due' && !dueDate) return;
    clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(async () => {
      setQuoting(true);
      try {
        setQuote(await API.quoteLoan(buildBody()));
        setQuoteErr(null);
      } catch (e) {
        setQuote(null);
        setQuoteErr(e.message);
      } finally {
        setQuoting(false);
      }
    }, 350);
    return () => clearTimeout(quoteTimer.current);
  }, [buildBody, clientId, totalUnits, termMode, dueDate]);

  async function submit() {
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const res = await API.createLoan(buildBody());
      setResult(res);
    } catch (e) {
      setSubmitErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    clientId && !blocked && totalUnits > 0 && !!quote && !quoteErr && !submitting;

  return (
    <div>
      <PageHeader
        title="Nuevo préstamo"
        subtitle="Elige el cliente, busca y agrega películas, fija el plazo, revisa la cotización y emite la factura."
        actions={
          <Button variant="ghost" onClick={() => navigate('/prestamos')}>
            Volver
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* 1. Cliente */}
          <Card>
            <h2 className="mb-3 text-xl font-semibold">1 · Cliente</h2>
            <Field label="Cliente" required>
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— selecciona —</option>
                {[...clients]
                  .sort((a, b) => fullName(a).localeCompare(fullName(b)))
                  .map((c) => (
                    <option key={c._id} value={c._id}>
                      {fullName(c)}
                      {c.blocked?.is_blocked ? ' (bloqueado)' : ''}
                    </option>
                  ))}
              </Select>
            </Field>
            {blocked && (
              <div className="mt-3">
                <Alert kind="error">
                  Este cliente está bloqueado ({client.blocked.reason}). No puede rentar películas.
                </Alert>
              </div>
            )}
          </Card>

          {/* 2. Peliculas */}
          <Card>
            <h2 className="mb-3 text-xl font-semibold">2 · Películas</h2>
            <VideoSearchBar onSearch={onSearch} onClear={() => setSearchRows(null)} busy={searchBusy} />

            {searchErr && (
              <div className="mt-3">
                <Alert onClose={() => setSearchErr(null)}>{searchErr}</Alert>
              </div>
            )}

            {searchBusy ? (
              <Spinner label="Buscando…" />
            ) : searchRows === null ? (
              <p className="mt-3 text-sm text-ink-soft">
                Busca por nombre, género, actor o nominación al Oscar para agregar películas.
              </p>
            ) : searchRows.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">Sin resultados.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-line rounded-lg border border-ink-line">
                {searchRows.map((v) => {
                  const avail = (v.copies || []).filter((c) => c.status === 'available').length;
                  const inCart = cart.find((i) => i.video_id === v._id)?.qty || 0;
                  return (
                    <li key={v._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {v.display_title}{' '}
                          <span className="font-normal text-ink-soft">({v.release_year})</span>
                        </p>
                        <p className="truncate text-xs text-ink-soft">
                          {(v.main_actors || []).slice(0, 3).join(', ')}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={avail > 0 ? 'teal' : 'rust'}>{avail} disp.</Badge>
                        <Button
                          size="sm"
                          onClick={() => addVideo(v)}
                          disabled={avail === 0 || inCart >= avail}
                        >
                          Agregar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* 3. Plazo */}
          <Card>
            <h2 className="mb-3 text-xl font-semibold">3 · Plazo de devolución</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setTermMode('days')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  termMode === 'days' ? 'bg-ink text-white' : 'bg-ink/5 text-ink-soft hover:bg-ink/10'
                }`}
              >
                Por días
              </button>
              <button
                onClick={() => setTermMode('due')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  termMode === 'due' ? 'bg-ink text-white' : 'bg-ink/5 text-ink-soft hover:bg-ink/10'
                }`}
              >
                Por fecha
              </button>
            </div>

            <div className="mt-3 max-w-xs">
              {termMode === 'days' ? (
                <Field label={`Días de préstamo (máximo ${maxDays})`}>
                  <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                    {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d} día{d > 1 ? 's' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field
                  label="Fecha de devolución"
                  hint={`Desde hoy (mismo día = 1 día) y hasta ${maxDays} días`}
                >
                  <TextInput
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </Field>
              )}
            </div>
          </Card>
        </div>

        {/* Resumen / cotizacion */}
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-xl font-semibold">Resumen</h2>
            {cart.length === 0 ? (
              <EmptyState title="Sin películas" hint="Agrega desde el buscador." />
            ) : (
              <ul className="space-y-2 text-sm">
                {cart.map((i) => (
                  <li key={i.video_id} className="border-b border-ink-line pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{i.title}</span>
                      <button
                        className="rounded-md px-2 py-0.5 text-xs font-medium text-rust hover:bg-rust/10"
                        onClick={() => removeItem(i.video_id)}
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-ink-soft">Copias:</span>
                      <input
                        type="number"
                        min="1"
                        max={i.available}
                        value={i.qty}
                        onChange={(e) => setQty(i.video_id, Number(e.target.value))}
                        className="w-16 rounded-lg border border-ink-line px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal/60"
                      />
                      <span className="text-xs text-ink-soft">de {i.available} disp.</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 border-t border-ink-line pt-3">
              {quoting && <p className="text-sm text-ink-soft">Calculando…</p>}
              {quoteErr && <Alert>{quoteErr}</Alert>}
              {quote && !quoteErr && (
                <dl className="space-y-1 text-sm">
                  <Row k="Películas" v={quote.pricing.movies_count} />
                  <Row k="Días" v={`${quote.days} (vence ${dateShort(quote.due_date)})`} />
                  <Row k="Precio por película" v={money(quote.pricing.price_per_movie)} />
                  <Row k="Base" v={money(quote.pricing.base_amount)} />
                  <Row
                    k={`Descuento (${quote.pricing.discount_percent}%)`}
                    v={`− ${money(quote.pricing.discount_amount)}`}
                  />
                  <div className="flex justify-between border-t border-ink-line pt-2 text-xl font-semibold">
                    <span>Total</span>
                    <span>{money(quote.pricing.total_amount)}</span>
                  </div>
                </dl>
              )}
              {!quote && !quoting && !quoteErr && (
                <p className="text-sm text-ink-soft">
                  Completa cliente, películas y plazo para ver la cotización.
                </p>
              )}
            </div>

            {submitErr && (
              <div className="mt-3">
                <Alert onClose={() => setSubmitErr(null)}>{submitErr}</Alert>
              </div>
            )}

            <Button className="mt-4 w-full" onClick={submit} disabled={!canSubmit}>
              {submitting ? 'Registrando…' : 'Registrar préstamo y emitir factura'}
            </Button>
          </Card>
        </div>
      </div>

      {/* Resultado: factura emitida */}
      <Modal
        open={!!result}
        onClose={() => navigate(`/prestamos/${result.loan._id}`)}
        title="Préstamo registrado"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => navigate('/prestamos')}>
              Ir a préstamos
            </Button>
            <Button onClick={() => navigate(`/prestamos/${result.loan._id}`)}>Ver préstamo</Button>
          </>
        }
      >
        {result && (
          <div>
            <Alert kind="success">
              Préstamo creado y factura N.º {result.invoice.number} emitida. Las copias quedaron
              marcadas como prestadas.
            </Alert>
            <div className="mt-4">
              <InvoiceView invoice={result.invoice} clientName={clientName(result.loan.client_id)} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  );
}
