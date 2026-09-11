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

  async function doRetire(e) {
    e.preventDefault();
    setBusy(true);
    setModalErr(null);
    const reason =
      retireForm.reason === 'otro' ? retireForm.reasonOther.trim() : retireForm.reason;
    try {
      await API.retireCopy(id, retire.copy_id, { reason, date: fromDateInput(retireForm.date) });
      setRetire(null);
      setBanner({
        kind: 'success',
        msg: `Copia ${retire.copy_id} dada de baja (${reason}).`,
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
            <Line k="De baja" v={copies.filter((c) => c.status === 'retired').length} tone="rust" />
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
                <th>Baja</th>
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
                      ? `${dateShort(c.retirement.date)} — ${c.retirement.reason}`
                      : '—'}
                  </td>
                  <td className="text-right">
                    {c.status !== 'retired' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setRetire(c);
                          setRetireForm({
                            reason: c.status === 'loaned' ? 'no devuelto' : 'robo',
                            reasonOther: '',
                            date: toDateInput(new Date().toISOString()),
                          });
                          setModalErr(null);
                        }}
                      >
                        Dar de baja
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Una copia prestada solo puede darse de baja con razón “no devuelto” (cierra también el
          préstamo asociado). Para “robo” u otras razones, primero se registra la devolución.
        </p>
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

      {/* Modal: dar de baja copia */}
      <Modal
        open={!!retire}
        onClose={() => setRetire(null)}
        title={`Dar de baja la copia ${retire?.copy_id || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRetire(null)}>
              Cancelar
            </Button>
            <Button form="retire-copy" type="submit" variant="danger" disabled={busy}>
              {busy ? 'Procesando…' : 'Confirmar baja'}
            </Button>
          </>
        }
      >
        <form id="retire-copy" onSubmit={doRetire} className="space-y-4">
          {modalErr && <Alert onClose={() => setModalErr(null)}>{modalErr}</Alert>}
          {retire?.status === 'loaned' && (
            <Alert kind="warn">
              Esta copia está prestada. Solo se acepta la razón “no devuelto”, que además cierra el
              préstamo asociado como no devuelto.
            </Alert>
          )}
          <Field label="Razón de la baja" required>
            <Select
              value={retireForm.reason}
              onChange={(e) => setRetireForm({ ...retireForm, reason: e.target.value })}
            >
              {RETIRE_REASONS.map((r) => (
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
