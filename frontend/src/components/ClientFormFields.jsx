import { Card, Field, TextInput, Select } from './ui.jsx';
import { toDateInput, fromDateInput } from '../lib/format.js';

// ============================================================================
// Campos del formulario de CLIENTE, extraídos como componente compartido
// para no duplicar el formulario completo entre ClientFormPage (página de
// alta/edición) y el modal "Nuevo cliente" embebido en NewLoanPage (pedido
// explícito: poder registrar un cliente sin salir de "Nuevo préstamo").
// Misma validación / mismos campos en los dos lugares — una sola fuente de
// verdad para la forma del formulario.
// ============================================================================

export const CLIENT_EMPTY = {
  first_name: '',
  paternal_surname: '',
  maternal_surname: '',
  phone_mobile: '',
  email: '',
  birth_date: '',
  addr_text: '',
  zone_id: '',
  registered_at: toDateInput(new Date().toISOString()),
};

/** Documento de cliente (API) -> forma plana que usa el formulario. */
export function clientToForm(c) {
  return {
    first_name: c.first_name || '',
    paternal_surname: c.paternal_surname || '',
    maternal_surname: c.maternal_surname || '',
    phone_mobile: c.phone_mobile || '',
    email: c.email || '',
    birth_date: toDateInput(c.birth_date),
    addr_text: c.address?.text || '',
    zone_id: c.address?.zone_id || '',
    registered_at: toDateInput(c.registered_at),
  };
}

/** Forma del formulario -> payload que espera POST/PUT /api/clients. */
export function formToClientPayload(form, { isEdit = false } = {}) {
  const payload = {
    first_name: form.first_name.trim(),
    paternal_surname: form.paternal_surname.trim(),
    maternal_surname: form.maternal_surname.trim() || null,
    phone_mobile: form.phone_mobile.trim(),
    email: form.email.trim(),
    birth_date: form.birth_date,
    address: { text: form.addr_text.trim(), zone_id: form.zone_id || null },
  };
  if (!isEdit && form.registered_at) payload.registered_at = fromDateInput(form.registered_at);
  return payload;
}

/**
 * Campos del formulario (sin `<form>` ni botones de envío — eso lo decide
 * quien lo use: página completa con Cards, o body de un Modal). `zones`
 * viene de `useRefData()` en el llamador.
 */
export default function ClientFormFields({ form, set, isEdit, zones, compact = false }) {
  const Wrap = compact ? 'div' : Card;
  const wrapProps = compact ? { className: 'space-y-4 rounded-lg border border-ink-line p-4' } : {};

  // Vista previa de cómo queda la dirección completa (calle/número + zona
  // elegida), para que quede claro que la zona se agrega sola.
  const selectedZoneName = zones.find((z) => z._id === form.zone_id)?.name;
  const addressPreview = selectedZoneName
    ? `${form.addr_text.trim()}, ${selectedZoneName}`
    : form.addr_text.trim();

  return (
    <div className="space-y-4">
      <Wrap {...wrapProps}>
        {!compact && <h2 className="mb-4 text-xl font-semibold">Nombre</h2>}
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
      </Wrap>

      <Wrap {...wrapProps}>
        {!compact && <h2 className="mb-4 text-xl font-semibold">Contacto</h2>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono celular" required>
            <TextInput
              value={form.phone_mobile}
              onChange={(e) => set({ phone_mobile: e.target.value })}
              placeholder="ej. 71234567"
              required
            />
          </Field>
          <Field label="Correo electrónico">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
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
      </Wrap>

      <Wrap {...wrapProps}>
        {!compact && <h2 className="mb-4 text-xl font-semibold">Dirección y geolocalización</h2>}
        <Field label="Zona">
          <Select value={form.zone_id} onChange={(e) => set({ zone_id: e.target.value })}>
            <option value="">Sin zona</option>
            {[...zones]
              // Misma regla que género: una zona inactiva no aparece para
              // asignación nueva, salvo que este cliente ya la tuviera.
              .filter((z) => z.active !== false || form.zone_id === z._id)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((z) => (
                <option key={z._id} value={z._id}>
                  {z.name}
                  {z.active === false ? ' (inactiva)' : ''}
                </option>
              ))}
          </Select>
        </Field>
        {zones.length === 0 && (
          <p className="mt-1.5 text-xs text-ink-soft">
            Todavía no hay zonas creadas. Crear la primera en{' '}
            <span className="font-semibold">Zonas</span> (menú lateral).
          </p>
        )}
        <div className="mt-4">
          <Field label="Dirección (calle y número)" required>
            <TextInput
              value={form.addr_text}
              onChange={(e) => set({ addr_text: e.target.value })}
              placeholder="Calle 8 de Calacoto 450"
              required
            />
          </Field>
          {form.addr_text.trim() && (
            <p className="mt-1.5 text-xs text-ink-soft">
              Se guardará como: <span className="font-medium text-ink">{addressPreview}</span>
            </p>
          )}
        </div>
      </Wrap>
    </div>
  );
}
