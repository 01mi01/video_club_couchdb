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
  Select,
  copyStatusTone,
} from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';
import { money, dateShort, toDateInput, fromDateInput, COPY_STATUS_LABEL } from '../lib/format.js';

const RETIRE_REASONS = ['no devuelto', 'robo', 'daño irreparable', 'pérdida', 'otro'];

// "no devuelto" solo tiene sentido si la copia estaba efectivamente
// prestada (no se le puede "no devolver" algo que nunca salió). Para
// cualquier otro estado (disponible, o "missing" dándose de baja
// definitiva) esa opción no aparece en la lista.
function reasonsFor(status) {
  return status === 'loaned' ? RETIRE_REASONS : RETIRE_REASONS.filter((r) => r !== 'no devuelto');
}

export default function VideoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { genreNames, oscarCategoryNames } = useRefData();
  const { data: v, loading, error, reload } = useAsync(() => API.getVideo(id), [id]);

  const [banner, setBanner] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ count: 1, acquisition_date: toDateInput(new Date().toISOString()) });
  const [retire, setRetire] = useState(null); // copy object
  const [retireForm, setRetireForm] = useState({ reason: 'no devuelto', reasonOther: '', date: toDateInput(new Date().toISOString()) });
  // Solo aplica cuando `retire.status === 'missing'`: la copia ya está "no
  // disponible" (no devuelta/perdida/robada) y hay que decidir qué pasó
  // con ella — un solo punto de entrada ("Dar de baja") con dos caminos
  // posibles adentro, en vez de dos botones separados en la fila.
  const [missingAction, setMissingAction] = useState('retire'); // 'retire' | 'recover'
  const [busy, setBusy] = useState(false);
  const [modalErr, setModalErr] = useState(null);

  if (loading) return <Spinner label="Cargando película…" />;
  if (error) return <Alert>{error}</Alert>;

  const copies = v.copies || [];
  const disp = copies.filter((c) => c.status === 'available').length;

  async function doAddCopies(e) {
    e.preventDefault();
    setBusy(true);
    setModalErr(null);
    try {
      await API.addCopies(id, {
        count: Number(addForm.count),
        acquisition_date: fromDateInput(addForm.acquisition_date),
      });
      setAddOpen(false);
      setBanner({ kind: 'success', msg: `Se registraron ${addForm.count} copia(s).` });
      await reload();
    } catch (err) {
      setModalErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Envío del modal "Dar de baja" / "Cambiar estado". Para una copia
  // "missing" con `missingAction === 'recover'` es en realidad una
  // RECUPERACIÓN (vuelve a "available"), no una baja — mismo modal, mismo
  // botón de confirmar, dos acciones de backend distintas según lo elegido.
  async function submitCopyState(e) {
    e.preventDefault();
    setBusy(true);
    setModalErr(null);
    const recovering = retire.status === 'missing' && missingAction === 'recover';
    try {
      if (recovering) {
        await API.recoverCopy(id, retire.copy_id);
        setBanner({ kind: 'success', msg: `Copia ${retire.copy_id} recuperada: vuelve a estar disponible.` });
      } else {
        const reason = retireForm.reason === 'otro' ? retireForm.reasonOther.trim() : retireForm.reason;
        await API.retireCopy(id, retire.copy_id, { reason, date: fromDateInput(retireForm.date) });
        setBanner({ kind: 'success', msg: `Copia ${retire.copy_id} dada de baja (${reason}).` });
      }
      setRetire(null);
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
        title={v.display_title}
        subtitle={`${v.release_year} · ${v.duration_minutes} min · ${genreNames(v.genre_ids).join(' · ')}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/videos')}>
              Volver
            </Button>
            <Button variant="ghost" onClick={() => navigate(`/videos/${id}/editar`)}>
              Editar
            </Button>
            <Button onClick={() => setAddOpen(true)}>Registrar copias</Button>
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
          <h2 className="text-xl font-semibold">Ficha</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Row k="Título original" v={v.original_title} />
            <Row k="Idioma original" v={v.original_language || '—'} />
            <Row k="Director" v={v.director || '—'} />
            <Row k="Títulos alternativos" v={(v.alternative_titles || []).join(' · ') || '—'} />
            <Row k="Actores principales" v={(v.main_actors || []).join(', ') || '—'} />
            <Row k="Costo unitario DVD" v={money(v.unit_cost)} />
            <Row k="Unidades adquiridas" v={v.units_acquired} />
            <Row k="Todos los títulos (búsqueda)" v={(v.all_titles || []).join(' · ')} />
          </dl>

          <div className="mt-4 border-t border-ink-line pt-4">
            <p className="eyebrow">Premios Oscar</p>
            <div className="mt-2 space-y-2 text-sm">
              <div>
                <span className="font-semibold">Ganados: </span>
                {v.oscar_wins?.length ? (
                  v.oscar_wins.map((id) => (
                    <span key={id} className="mr-1 inline-block">
                      <Badge tone="gold">{oscarCategoryNames([id])[0]}</Badge>
                    </span>
                  ))
                ) : (
                  <span className="text-ink-soft">ninguno</span>
                )}
              </div>
              <div>
                <span className="font-semibold">Nominaciones: </span>
                {v.oscar_nominations?.length ? (
                  <span className="text-ink-soft">{oscarCategoryNames(v.oscar_nominations).join(', ')}</span>
                ) : (
                  <span className="text-ink-soft">ninguna</span>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Inventario</h2>
          <div className="mt-3 space-y-2 text-sm">
            <Line k="Copias totales" v={copies.length} />
            <Line k="Disponibles" v={disp} tone="teal" />
            <Line k="Prestadas" v={copies.filter((c) => c.status === 'loaned').length} tone="gold" />
            <Line
              k="No disponible (recuperable)"
              v={copies.filter((c) => c.status === 'missing').length}
              tone="rust"
            />
            <Line k="De baja definitiva" v={copies.filter((c) => c.status === 'retired').length} />
          </div>
        </Card>
      </div>

      <Card className="mt-4" accent={false}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Copias</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table-editorial">
            <thead>
              <tr>
                <th>Copia</th>
                <th>Estado</th>
                <th>Adquirida</th>
                <th>Motivo / fecha</th>
                <th className="!text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {copies.map((c) => (
                <tr key={c.copy_id}>
                  <td className="font-semibold">{c.copy_id}</td>
                  <td>
                    <Badge tone={copyStatusTone(c.status)}>{COPY_STATUS_LABEL[c.status] || c.status}</Badge>
                  </td>
                  <td>{dateShort(c.acquisition_date)}</td>
                  <td className="text-xs text-ink-soft">
                    {c.retirement
                      ? `${dateShort(c.retirement.date)} · ${c.retirement.reason}`
                      : '—'}
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {c.status !== 'retired' && (
                        <Button
                          size="sm"
                          variant={c.status === 'missing' ? 'primary' : 'danger'}
                          onClick={() => {
                            setRetire(c);
                            setRetireForm({
                              reason: c.status === 'loaned' ? 'no devuelto' : 'robo',
                              reasonOther: '',
                              date: toDateInput(new Date().toISOString()),
                            });
                            // Una copia "missing" arranca en "recuperada" por
                            // defecto (el caso más común: apareció) — se puede
                            // cambiar a "baja definitiva" dentro del modal.
                            setMissingAction('recover');
                            setModalErr(null);
                          }}
                        >
                          {c.status === 'missing' ? 'Cambiar estado' : 'Dar de baja'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: registrar copias nuevas */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Registrar copias nuevas"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button form="add-copies" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Registrar'}
            </Button>
          </>
        }
      >
        <form id="add-copies" onSubmit={doAddCopies} className="space-y-4">
          {modalErr && <Alert onClose={() => setModalErr(null)}>{modalErr}</Alert>}
          <Field label="Cantidad de copias" required>
            <TextInput
              type="number"
              min="1"
              value={addForm.count}
              onChange={(e) => setAddForm({ ...addForm, count: e.target.value })}
              required
            />
          </Field>
          <Field label="Fecha de adquisición">
            <TextInput
              type="date"
              value={addForm.acquisition_date}
              onChange={(e) => setAddForm({ ...addForm, acquisition_date: e.target.value })}
            />
          </Field>
        </form>
      </Modal>

      {/* Modal: dar de baja / cambiar estado de una copia.
          Para "missing" es UN SOLO punto de entrada ("Cambiar estado") con
          dos caminos posibles adentro: recuperarla (vuelve a "available") o
          darla de baja definitiva ("retired", sin vuelta atrás). */}
      <Modal
        open={!!retire}
        onClose={() => setRetire(null)}
        title={
          retire?.status === 'missing'
            ? `Cambiar estado de la copia ${retire?.copy_id || ''}`
            : `Dar de baja la copia ${retire?.copy_id || ''}`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setRetire(null)}>
              Cancelar
            </Button>
            <Button
              form="retire-copy"
              type="submit"
              variant={retire?.status === 'missing' && missingAction === 'recover' ? 'primary' : 'danger'}
              disabled={busy}
            >
              {busy
                ? 'Procesando…'
                : retire?.status === 'missing' && missingAction === 'recover'
                  ? 'Confirmar recuperación'
                  : retire?.status === 'missing'
                    ? 'Confirmar baja definitiva'
                    : 'Confirmar baja'}
            </Button>
          </>
        }
      >
        <form id="retire-copy" onSubmit={submitCopyState} className="space-y-4">
          {modalErr && <Alert onClose={() => setModalErr(null)}>{modalErr}</Alert>}

          {retire?.status === 'loaned' && (
            <Alert kind="warn">
              Esta copia está prestada: cualquier razón salvo “daño irreparable” (incluida “otro”)
              se acepta directo, queda “No disponible” (recuperable, no definitiva) y cierra el
              préstamo asociado. “Daño irreparable” es la única que exige registrar la devolución
              antes.
            </Alert>
          )}

          {retire?.status === 'available' && (
            <Alert kind="warn">
              Cualquier razón salvo “daño irreparable” (incluida “otro”) deja la copia “No
              disponible” (recuperable: si aparece, se marca como recuperada). Solo “daño
              irreparable” es DEFINITIVA, sin vuelta atrás.
            </Alert>
          )}

          {retire?.status === 'missing' && (
            <Field label="¿Qué pasó con esta copia?" required>
              <div className="space-y-2 rounded-lg border border-ink-line p-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="missingAction"
                    className="mt-0.5 h-4 w-4 accent-teal"
                    checked={missingAction === 'recover'}
                    onChange={() => setMissingAction('recover')}
                  />
                  <span>
                    <span className="font-medium">Apareció</span> — marcarla como recuperada, vuelve
                    a estar disponible para prestar.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="missingAction"
                    className="mt-0.5 h-4 w-4 accent-rust"
                    checked={missingAction === 'retire'}
                    onChange={() => setMissingAction('retire')}
                  />
                  <span>
                    <span className="font-medium">No va a volver</span> — dar de baja definitiva
                    (sin vuelta atrás).
                  </span>
                </label>
              </div>
            </Field>
          )}

          {/* Razón / fecha: se piden salvo que sea una recuperación (ahí no
              hace falta razón, la copia simplemente vuelve a estar disponible). */}
          {!(retire?.status === 'missing' && missingAction === 'recover') && (
            <>
              <Field label="Razón de la baja" required>
                <Select
                  value={retireForm.reason}
                  onChange={(e) => setRetireForm({ ...retireForm, reason: e.target.value })}
                >
                  {reasonsFor(retire?.status).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
              {retireForm.reason === 'otro' && (
                <Field label="Detalle de la razón" required>
                  <TextInput
                    value={retireForm.reasonOther}
                    onChange={(e) => setRetireForm({ ...retireForm, reasonOther: e.target.value })}
                    required
                  />
                </Field>
              )}
              <Field label="Fecha de baja">
                <TextInput
                  type="date"
                  value={retireForm.date}
                  onChange={(e) => setRetireForm({ ...retireForm, date: e.target.value })}
                />
              </Field>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="border-b border-ink-line py-1">
      <dt className="text-xs uppercase tracking-label text-ink-soft">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}
function Line({ k, v, tone }) {
  const c = { teal: 'text-teal', gold: 'text-[#8a5a10]', rust: 'text-rust' }[tone] || 'text-ink';
  return (
    <div className="flex items-center justify-between border-b border-ink-line pb-1">
      <span className="text-ink-soft">{k}</span>
      <span className={`text-lg font-semibold ${c}`}>{v}</span>
    </div>
  );
}
