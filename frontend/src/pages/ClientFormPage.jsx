import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as API from '../api/endpoints.js';
import { useRefData } from '../context/RefDataContext.jsx';
import { PageHeader, Button, Spinner, Alert } from '../components/ui.jsx';
import ClientFormFields, { CLIENT_EMPTY, clientToForm, formToClientPayload } from '../components/ClientFormFields.jsx';

export default function ClientFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { zones, refreshClients } = useRefData();

  const [form, setForm] = useState(CLIENT_EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const c = await API.getClient(id);
        setForm(clientToForm(c));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = formToClientPayload(form, { isEdit });

    try {
      const saved = isEdit ? await API.updateClient(id, payload) : await API.createClient(payload);
      await refreshClients();
      navigate(`/clientes/${saved._id || id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Cargando cliente…" />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}
        actions={
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Volver
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert onClose={() => setError(null)}>{error}</Alert>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <ClientFormFields form={form} set={set} isEdit={isEdit} zones={zones} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar cliente'}
          </Button>
        </div>
      </form>
    </div>
  );
}
