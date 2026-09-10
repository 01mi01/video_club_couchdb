import { useState } from 'react';
import { useAsync } from '../hooks/useAsync.js';
import { useRefData } from '../context/RefDataContext.jsx';
import * as API from '../api/endpoints.js';
import { PageHeader, Card, Button, Spinner, Alert, Field, TextInput, TextArea, EmptyState } from '../components/ui.jsx';
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
  const [toDelete, setToDelete] = useState(null); // género pendiente de confirmar borrado
  const [deleteErr, setDeleteErr] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  function askRemove(g) {
    setToDelete(g);
    setDeleteErr(null);
  }

  async function confirmRemove() {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await API.deleteGenre(toDelete._id);
      const name = toDelete.name;
      setToDelete(null);
      await reload();
      await refreshGenres();
      setBanner({ kind: 'success', msg: `Género "${name}" eliminado.` });
    } catch (err) {
      // El backend rechaza (409) si algun video todavia lo referencia.
      const extra = err.details?.video_ids ? ` (${err.details.video_ids.length} película[s])` : '';
      setDeleteErr(err.message + extra);
    } finally {
      setDeleting(false);
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
                  <th className="w-40 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[...genres]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((g) => (
                    <tr key={g._id}>
                      <td className="font-semibold">{g.name}</td>
                      <td className="text-ink-soft">{g.description}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => askRemove(g)}>
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
        open={!!toDelete}
        title="Eliminar género"
        message={`¿Eliminar el género "${toDelete?.name}"?`}
        detail="Esta acción no se puede deshacer. No se permite si alguna película todavía lo referencia."
        confirmLabel="Eliminar género"
        danger
        busy={deleting}
        error={deleteErr}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
