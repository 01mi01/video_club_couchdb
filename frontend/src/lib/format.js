// Utilidades de formato compartidas.

export function money(n) {
  const v = Number(n || 0);
  return `${v.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
}

export function dateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('es-BO', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function dateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Para <input type="date"> -> "YYYY-MM-DD"
export function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

// "YYYY-MM-DD" (input date) -> ISO a mediodia local, para evitar saltos de dia.
export function fromDateInput(value) {
  if (!value) return undefined;
  return new Date(`${value}T12:00:00`).toISOString();
}

export function fullName(c) {
  if (!c) return '—';
  return [c.first_name, c.paternal_surname, c.maternal_surname].filter(Boolean).join(' ');
}

export function daysOverdue(dueIso) {
  if (!dueIso) return 0;
  const diff = Date.now() - new Date(dueIso).getTime();
  return Math.floor(diff / 86400000);
}

export const LOAN_STATUS_LABEL = {
  active: 'Activo',
  returned: 'Devuelto',
  unreturned: 'No devuelto',
};

export const COPY_STATUS_LABEL = {
  available: 'Disponible',
  loaned: 'Prestada',
  retired: 'De baja',
};
