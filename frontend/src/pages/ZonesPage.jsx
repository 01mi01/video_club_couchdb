import { useState } from 'react';
import { useAsync } from '../hooks/useAsync.js';
import { useRefData } from '../context/RefDataContext.jsx';
import * as API from '../api/endpoints.js';
import {
  PageHeader,
  Card,
  Button,
  Spinner,
  Alert,
  Field,
  TextInput,
  EmptyState,
  Badge,
  IconButton,
  IconPencil,
  IconPower,
} from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const EMPTY_FORM = { name: '', lat: '', lng: '' };

// Gestion de ZONAS: geolocalizacion preconfigurada (name + lat/lng), mismo
// patron no-destructivo que Generos/Categorias Oscar. El cliente referencia
// una zona por id (address.zone_id) en vez de que el empleado teclee
// coordenadas exactas a mano — ver clientService.js (backend).
export default function ZonesPage() {
  const { refreshZones } = useRefData();
  const { data: zones, loading, error, reload } = useAsync(() => API.listZones(), []);
  const [editing, setEditing] = useState(null); // null | {} (nueva) | zona
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveErr, setSaveErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [toToggle, setToToggle] = useState(null);
  const [toggleErr, setToggleErr] = useState(null);
  const [toggling, setToggling] = useState(false);

  function openNew() {
    setEditing({});
    setForm(EMPTY_FORM);
    setSaveErr(null);
  }
  function openEdit(z) {
    setEditing(z);
    setForm({ name: z.name, lat: String(z.geo?.lat ?? ''), lng: String(z.geo?.lng ?? '') });
    setSaveErr(null);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setSaveErr(null);
    const payload = {
      name: form.name.trim(),
      geo: { lat: Number(form.lat), lng: Number(form.lng) },
    };
    try {
      if (editing._id) await API.updateZone(editing._id, payload);
      else await API.createZone(payload);
      setEditing(null);
      await reload();
      await refreshZones();
      setBanner({ kind: 'success', msg: 'Zona guardada.' });
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Sin borrado real (mismo patrón no-destructivo que género): se
  // desactiva o reactiva.
  function askToggle(z) {
    setToToggle(z);
    setToggleErr(null);
  }

  async function confirmToggle() {
    const activating = toToggle.active === false;
    setToggling(true);
    setToggleErr(null);
    try {
      if (activating) await API.activateZone(toToggle._id);
      else await API.deactivateZone(toToggle._id);
      const name = toToggle.name;
      setToToggle(null);
      await reload();
      await refreshZones();
      setBanner({
        kind: 'success',
        msg: activating ? `Zona "${name}" reactivada.` : `Zona "${name}" desactivada.`,
      });
    } catch (err) {
      setToggleErr(err.message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div>
      <PageHeader title="Zonas" actions={<Button onClick={openNew}>Nueva zona</Button>} />

      <p className="mb-4 max-w-2xl text-sm text-ink-soft">
        Geolocalización preconfigurada de la dirección del cliente: cada zona guarda un nombre y
        coordenadas fijas. Al registrar o editar un cliente, el empleado elige una zona de la
        lista en vez de teclear latitud/longitud exactas a mano.
      </p>

      {banner && (
        <div className="mb-4">
          <Alert kind={banner.kind} onClose={() => setBanner(null)}>
            {banner.msg}
          </Alert>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : zones.length === 0 ? (
        <EmptyState title="Sin zonas" hint="Crear la primera con “Nueva zona”." />
      ) : (
        <Card accent={false}>
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Latitud</th>
                  <th>Longitud</th>
                  <th className="w-28">Estado</th>
                  <th className="!text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[...zones]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((z) => {
                    const inactive = z.active === false;
                    return (
                      <tr key={z._id}>
                        <td className="font-semibold">{z.name}</td>
                        <td className="text-ink-soft">{z.geo?.lat}</td>
                        <td className="text-ink-soft">{z.geo?.lng}</td>
                        <td>
                          <Badge tone={inactive ? 'soft' : 'teal'}>
                            {inactive ? 'Inactiva' : 'Activa'}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <IconButton label="Editar zona" onClick={() => openEdit(z)}>
                              <IconPencil />
                            </IconButton>
                            <IconButton
                              label={inactive ? 'Activar zona' : 'Desactivar zona'}
                              variant={inactive ? 'primary' : 'danger'}
                              onClick={() => askToggle(z)}
                            >
                              <IconPower />
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

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?._id ? 'Editar zona' : 'Nueva zona'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button form="zone-form" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="zone-form" onSubmit={save} className="space-y-4">
          {saveErr && <Alert onClose={() => setSaveErr(null)}>{saveErr}</Alert>}
          <Field label="Nombre" required>
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ej. Equipetrol, Santa Cruz de la Sierra"
              required
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitud" required hint="Entre -90 y 90">
              <TextInput
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                placeholder="-17.7833"
                required
              />
            </Field>
            <Field label="Longitud" required hint="Entre -180 y 180">
              <TextInput
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                placeholder="-63.1821"
                required
              />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toToggle}
        title={toToggle?.active === false ? 'Activar zona' : 'Desactivar zona'}
        message={
          toToggle?.active === false
            ? `¿Reactivar la zona "${toToggle?.name}"? Volverá a poder asignarse a clientes nuevos.`
            : `¿Desactivar la zona "${toToggle?.name}"?`
        }
        detail={
          toToggle?.active === false
            ? undefined
            : 'No se elimina: el documento se conserva y los clientes que ya la tienen la siguen mostrando sin problema. Solo deja de poder asignarse a clientes nuevos o agregarse en una edición.'
        }
        confirmLabel={toToggle?.active === false ? 'Activar zona' : 'Desactivar zona'}
        danger={toToggle?.active !== false}
        busy={toggling}
        error={toggleErr}
        onCancel={() => setToToggle(null)}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
