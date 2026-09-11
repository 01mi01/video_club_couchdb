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

// Gestión de CATEGORÍAS DE OSCAR. Documento normalizado propio (mismo
// patrón que género): name_en + name_es, referenciado por id desde los
// videos (oscar_nominations[] / oscar_wins[]). Resuelve que la búsqueda
// por nominación funcione en español ("Mejor Película"), no solo en
// inglés ("Best Picture") — ver videoService.search / oscarCategoryService.
export default function OscarCategoriesPage() {
  const { refreshOscarCategories } = useRefData();
  const { data: categories, loading, error, reload } = useAsync(() => API.listOscarCategories(), []);
  const [editing, setEditing] = useState(null); // null | {} (nuevo) | categoria
  const [form, setForm] = useState({ name_en: '', name_es: '' });
  const [saveErr, setSaveErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [toToggle, setToToggle] = useState(null);
  const [toggleErr, setToggleErr] = useState(null);
  const [toggling, setToggling] = useState(false);

  function openNew() {
    setEditing({});
    setForm({ name_en: '', name_es: '' });
    setSaveErr(null);
  }
  function openEdit(c) {
    setEditing(c);
    setForm({ name_en: c.name_en, name_es: c.name_es });
    setSaveErr(null);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setSaveErr(null);
    try {
      if (editing._id) await API.updateOscarCategory(editing._id, form);
      else await API.createOscarCategory(form);
      setEditing(null);
      await reload();
      await refreshOscarCategories();
      setBanner({ kind: 'success', msg: 'Categoría de Oscar guardada.' });
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  // No hay borrado real (mismo criterio que género: el enunciado nunca
  // pide "eliminar" nada): se desactiva/reactiva.
  function askToggle(c) {
    setToToggle(c);
    setToggleErr(null);
  }

  async function confirmToggle() {
    const activating = toToggle.active === false;
    setToggling(true);
    setToggleErr(null);
    try {
      if (activating) await API.activateOscarCategory(toToggle._id);
      else await API.deactivateOscarCategory(toToggle._id);
      const name = toToggle.name_es;
      setToToggle(null);
      await reload();
      await refreshOscarCategories();
      setBanner({
        kind: 'success',
        msg: activating ? `Categoría "${name}" reactivada.` : `Categoría "${name}" desactivada.`,
      });
    } catch (err) {
      setToggleErr(err.message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div>
      <PageHeader title="Categorías de Oscar" actions={<Button onClick={openNew}>Nueva categoría</Button>} />

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
      ) : categories.length === 0 ? (
        <EmptyState title="Sin categorías" hint="Crear la primera con “Nueva categoría”." />
      ) : (
        <Card accent={false}>
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Español</th>
                  <th>Inglés</th>
                  <th className="w-28">Estado</th>
                  <th className="!text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[...categories]
                  .sort((a, b) => a.name_es.localeCompare(b.name_es))
                  .map((c) => {
                    const inactive = c.active === false;
                    return (
                      <tr key={c._id}>
                        <td className="font-semibold">{c.name_es}</td>
                        <td className="text-ink-soft">{c.name_en}</td>
                        <td>
                          <Badge tone={inactive ? 'soft' : 'teal'}>
                            {inactive ? 'Inactiva' : 'Activa'}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <IconButton label="Editar categoría" onClick={() => openEdit(c)}>
                              <IconPencil />
                            </IconButton>
                            <IconButton
                              label={inactive ? 'Activar categoría' : 'Desactivar categoría'}
                              variant={inactive ? 'primary' : 'danger'}
                              onClick={() => askToggle(c)}
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
        title={editing?._id ? 'Editar categoría' : 'Nueva categoría'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button form="oscar-category-form" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="oscar-category-form" onSubmit={save} className="space-y-4">
          {saveErr && <Alert onClose={() => setSaveErr(null)}>{saveErr}</Alert>}
          <Field label="Nombre en español" required>
            <TextInput
              value={form.name_es}
              onChange={(e) => setForm({ ...form, name_es: e.target.value })}
              required
              autoFocus
              placeholder="ej. Mejor Película"
            />
          </Field>
          <Field label="Nombre en inglés (oficial de la Academia)" required>
            <TextInput
              value={form.name_en}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
              required
              placeholder="ej. Best Picture"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toToggle}
        title={toToggle?.active === false ? 'Activar categoría' : 'Desactivar categoría'}
        message={
          toToggle?.active === false
            ? `¿Reactivar la categoría "${toToggle?.name_es}"? Volverá a poder asignarse a películas nuevas.`
            : `¿Desactivar la categoría "${toToggle?.name_es}"?`
        }
        detail={
          toToggle?.active === false
            ? undefined
            : 'No se elimina: el documento se conserva y las películas que ya la tienen la siguen mostrando sin problema. Solo deja de poder asignarse a películas nuevas o agregarse en una edición.'
        }
        confirmLabel={toToggle?.active === false ? 'Activar categoría' : 'Desactivar categoría'}
        danger={toToggle?.active !== false}
        busy={toggling}
        error={toggleErr}
        onCancel={() => setToToggle(null)}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
