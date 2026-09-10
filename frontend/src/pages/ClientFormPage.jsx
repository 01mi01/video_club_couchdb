import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as API from '../api/endpoints.js';
import { useRefData } from '../context/RefDataContext.jsx';
import { PageHeader, Card, Button, Spinner, Alert, Field, TextInput } from '../components/ui.jsx';
import { toDateInput, fromDateInput } from '../lib/format.js';

const EMPTY = {
  first_name: '',
  paternal_surname: '',
  maternal_surname: '',
  phone_mobile: '',
  email: '',
  birth_date: '',
  addr_text: '',
  geo_lat: '',
  geo_lng: '',
  registered_at: toDateInput(new Date().toISOString()),
};

export default function ClientFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { refreshClients } = useRefData();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const c = await API.getClient(id);
        setForm({
          first_name: c.first_name || '',
          paternal_surname: c.paternal_surname || '',
          maternal_surname: c.maternal_surname || '',
          phone_mobile: c.phone_mobile || '',
          email: c.email || '',
          birth_date: toDateInput(c.birth_date),
          addr_text: c.address?.text || '',
          geo_lat: c.address?.geo?.lat ?? '',
          geo_lng: c.address?.geo?.lng ?? '',
          registered_at: toDateInput(c.registered_at),
        });
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

    const geo =
      form.geo_lat !== '' && form.geo_lng !== ''
        ? { lat: Number(form.geo_lat), lng: Number(form.geo_lng) }
        : null;

    const payload = {
      first_name: form.first_name.trim(),
      paternal_surname: form.paternal_surname.trim(),
      maternal_surname: form.maternal_surname.trim() || null,
      phone_mobile: form.phone_mobile.trim(),
      email: form.email.trim(),
      birth_date: form.birth_date,
      address: { text: form.addr_text.trim(), geo },
    };
    if (!isEdit && form.registered_at) payload.registered_at = fromDateInput(form.registered_at);

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
        subtitle="El bloqueo/desbloqueo se gestiona desde el detalle del cliente."
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
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Nombre</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nombre" required>
              <TextInput
                value={form.first_name}
                onChange={(e) => set({ first_name: e.target.value })}
                required
              />
            </Field>
            <Field label="Apellido paterno" required>
              <TextInput
                value={form.paternal_surname}
                onChange={(e) => set({ paternal_surname: e.target.value })}
                required
              />
            </Field>
            <Field label="Apellido materno" hint="Si tiene ambos">
              <TextInput
                value={form.maternal_surname}
                onChange={(e) => set({ maternal_surname: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold">Contacto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono celular" required>
              <TextInput
                value={form.phone_mobile}
                onChange={(e) => set({ phone_mobile: e.target.value })}
                placeholder="ej. 71234567"
                required
              />
            </Field>
            <Field label="Correo electrónico" required>
              <TextInput
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                required
              />
            </Field>
            <Field label="Fecha de nacimiento" required>
              <TextInput
                type="date"
                value={form.birth_date}
                onChange={(e) => set({ birth_date: e.target.value })}
                required
              />
            </Field>
            {!isEdit && (
              <Field label="Fecha de registro">
                <TextInput
                  type="date"
                  value={form.registered_at}
                  onChange={(e) => set({ registered_at: e.target.value })}
                />
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold">Dirección y geolocalización</h2>
          <Field label="Dirección" required>
            <TextInput
              value={form.addr_text}
              onChange={(e) => set({ addr_text: e.target.value })}
              placeholder="Calle, número, zona, ciudad"
              required
            />
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Latitud" hint="Opcional. Entre -90 y 90">
              <TextInput
                type="number"
                step="any"
                value={form.geo_lat}
                onChange={(e) => set({ geo_lat: e.target.value })}
                placeholder="-17.7833"
              />
            </Field>
            <Field label="Longitud" hint="Opcional. Entre -180 y 180">
              <TextInput
                type="number"
                step="any"
                value={form.geo_lng}
                onChange={(e) => set({ geo_lng: e.target.value })}
                placeholder="-63.1821"
              />
            </Field>
          </div>
        </Card>

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
