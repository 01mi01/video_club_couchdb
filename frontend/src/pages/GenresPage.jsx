import { useState } from 'react';
import { useAsync } from '../hooks/useAsync.js';
import { useRefData } from '../context/RefDataContext.jsx';
import * as API from '../api/endpoints.js';
import { PageHeader, Card, Button, Spinner, Alert, Field, TextInput, TextArea, EmptyState, Badge } from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

// Gestion de GENEROS. El genero es documento normalizado propio (name +
// description). Los videos lo referencian por id (genre_ids[]).
export default function GenresPage() {
  const { refreshGenres } = useRefData();
  const { data: genres, loading, error, reload } = useAsync(() => API.listGenres(), []);
  const [editing, setEditing] = useState(null); // null | {} (nuevo) | genre
  const [form, setForm] = useState({ name: '', description: '' });
  const [saveErr, setSaveErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [toToggle, setToToggle] = useState(null); // género pendiente de confirmar activar/desactivar
  const [toggleErr, setToggleErr] = useState(null);
  const [toggling, setToggling] = useState(false);

  function openNew() {
    setEditing({});
    setForm({ name: '', description: '' });
    setSaveErr(null);
  }
  function openEdit(g) {
    setEditing(g);
    setForm({ name: g.name, description: g.description });
    setSaveErr(null);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setSaveErr(null);
    try {
      if (editing._id) await API.updateGenre(editing._id, form);
      else await API.createGenre(form);
      setEditing(null);
      await reload();
      await refreshGenres();
      setBanner({ kind: 'success', msg: 'Género guardado.' });
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  // No hay borrado real de género (el enunciado nunca pide "eliminar"): se
  // desactiva o reactiva, siguiendo el mismo patrón no-destructivo que la
  // baja de copias y el bloqueo de clientes.
  function askToggle(g) {
    setToToggle(g);
    setToggleErr(null);
  }

  async function confirmToggle() {
    const activating = toToggle.active === false;
    setToggling(true);
    setToggleErr(null);
    try {
      if (activating) await API.activateGenre(toToggle._id);
      else await API.deactivateGenre(toToggle._id);
      const name = toToggle.name;
      setToToggle(null);
      await reload();
      await refreshGenres();
      setBanner({
        kind: 'success',
        msg: activating ? `Género "${name}" reactivado.` : `Género "${name}" desactivado.`,
      });
    } catch (err) {
      setToggleErr(err.message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Géneros"
        subtitle="Catálogo normalizado. Una película puede pertenecer a varios géneros; aquí se administra el vocabulario."
        actions={<Button onClick={openNew}>Nuevo género</Button>}
      />

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
      ) : genres.length === 0 ? (
        <EmptyState title="Sin géneros" hint="Crea el primero con “Nuevo género”." />
      ) : (
        <Card accent={false}>
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th className="w-28">Estado</th>
                  <th className="whitespace-nowrap text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[...genres]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((g) => {
                    const inactive = g.active === false;
                    return (
                      <tr key={g._id}>
                        <td className="font-semibold">{g.name}</td>
                        <td className="text-ink-soft">{g.description}</td>
                        <td>
                          <Badge tone={inactive ? 'soft' : 'teal'}>
                            {inactive ? 'Inactivo' : 'Activo'}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant={inactive ? 'primary' : 'danger'}
                              onClick={() => askToggle(g)}
                            >
                              {inactive ? 'Activar' : 'Desactivar'}
                            </Button>
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
        title={editing?._id ? 'Editar género' : 'Nuevo género'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button form="genre-form" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="genre-form" onSubmit={save} className="space-y-4">
          {saveErr && <Alert onClose={() => setSaveErr(null)}>{saveErr}</Alert>}
          <Field label="Nombre" required>
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
          </Field>
          <Field label="Descripción" required>
            <TextArea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toToggle}
        title={toToggle?.active === false ? 'Activar género' : 'Desactivar género'}
        message={
          toToggle?.active === false
            ? `¿Reactivar el género "${toToggle?.name}"? Volverá a poder asignarse a películas nuevas.`
            : `¿Desactivar el género "${toToggle?.name}"?`
        }
        detail={
          toToggle?.active === false
            ? undefined
            : 'No se elimina: el documento se conserva y las películas que ya lo tienen lo siguen mostrando sin problema. Solo deja de poder asignarse a películas nuevas o agregarse en una edición.'
        }
        confirmLabel={toToggle?.active === false ? 'Activar género' : 'Desactivar género'}
        danger={toToggle?.active !== false}
        busy={toggling}
        error={toggleErr}
        onCancel={() => setToToggle(null)}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
