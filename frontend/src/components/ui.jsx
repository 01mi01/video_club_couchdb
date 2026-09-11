// Piezas de UI pequenas y reutilizables: panel de administracion moderno
// (bordes suaves, tarjetas redondeadas) que conserva la paleta de marca y
// la franja de colores como acento estructural. Ver CLAUDE.md > Frontend
// - Diseno visual.

// `size`: 'lg' (borde recto: sidebar / login), 'md' (default: tarjetas y
// headers redondeados en general), 'sm' (Dashboard: más delgada que en el
// resto del sitio). Ver comentario en index.css > .rainbow-stripe.
export function RainbowStripe({ size = 'md', className = '' }) {
  const sizeClass = size === 'lg' ? 'rainbow-stripe-lg' : size === 'sm' ? 'rainbow-stripe-sm' : '';
  return <div className={`rainbow-stripe ${sizeClass} ${className}`} />;
}

export function Button({ variant = 'primary', size, className = '', ...props }) {
  const v =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'accent'
        ? 'btn-accent'
        : variant === 'danger'
          ? 'btn-danger'
          : 'btn-ghost';
  return <button className={`btn ${v} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} {...props} />;
}

export function Card({ children, className = '', accent = true }) {
  return (
    <div className={`card ${className}`}>
      {accent && <RainbowStripe />}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, stripeSize = 'md' }) {
  return (
    <div className="mb-6 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <RainbowStripe size={stripeSize} className="mt-4 rounded-full" />
    </div>
  );
}

export function Field({ label, error, hint, children, required }) {
  return (
    <label className="block">
      {label && (
        <span className="label">
          {label}
          {required && <span className="text-rust"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-semibold text-rust">{error}</span>}
    </label>
  );
}

export function TextInput(props) {
  return <input className="input" {...props} />;
}
export function TextArea(props) {
  return <textarea className="input" rows={3} {...props} />;
}
export function Select({ children, ...props }) {
  return (
    <select className="input" {...props}>
      {children}
    </select>
  );
}

export function Alert({ kind = 'error', children, onClose }) {
  const styles = {
    error: 'border-rust/30 bg-rust/10 text-rust',
    success: 'border-teal/30 bg-teal/10 text-teal',
    info: 'border-ink-line bg-paper-panel text-ink',
    warn: 'border-orange/30 bg-orange/10 text-[#9a5a12]',
  }[kind];
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border ${styles} px-4 py-3 text-sm`}>
      <div className="whitespace-pre-wrap">{children}</div>
      {onClose && (
        <button onClick={onClose} className="shrink-0 text-lg leading-none" aria-label="Cerrar">
          ×
        </button>
      )}
    </div>
  );
}

export function Badge({ children, tone = 'ink' }) {
  const tones = {
    ink: 'bg-ink/10 text-ink',
    teal: 'bg-teal/10 text-teal',
    gold: 'bg-gold/20 text-[#8a5a10]',
    rust: 'bg-rust/10 text-rust',
    soft: 'bg-paper-panel text-ink-soft',
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.ink}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="flex items-center gap-3 py-10 text-ink-soft">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title = 'Sin datos', hint }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-line px-6 py-12 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Íconos de acción para filas de tabla (ver / editar / activar-desactivar).
// SVG en línea (sin librería externa): trazo simple, reconocible sin
// necesidad de leer texto. Cada uno se usa siempre dentro de <IconButton>,
// que agrega el tooltip nativo (`title`) y el `aria-label` para lectores
// de pantalla — el ícono nunca es la única pista, solo la más rápida.
// ---------------------------------------------------------------------------
function IconBase({ size = 18, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconEye(props) {
  return (
    <IconBase {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function IconPencil(props) {
  return (
    <IconBase {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </IconBase>
  );
}

export function IconPower(props) {
  return (
    <IconBase {...props}>
      <path d="M12 2v10" />
      <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
    </IconBase>
  );
}

/**
 * Botón de solo ícono para acciones repetidas en filas de tabla. `label`
 * es OBLIGATORIO: se usa como `title` (tooltip nativo al pasar el mouse) y
 * `aria-label` (lectores de pantalla) — el ícono es la pista visual
 * rápida, el texto sigue existiendo para quien lo necesite.
 */
export function IconButton({ label, onClick, variant = 'ghost', className = '', children, disabled }) {
  const tones = {
    ghost: 'text-ink-soft hover:bg-ink/10 hover:text-ink',
    danger: 'text-rust hover:bg-rust/10',
    primary: 'text-teal hover:bg-teal/10',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[variant] || tones.ghost} ${className}`}
    >
      {children}
    </button>
  );
}

export function loanStatusTone(status) {
  return status === 'active' ? 'teal' : status === 'returned' ? 'soft' : 'rust';
}
export function copyStatusTone(status) {
  return status === 'available' ? 'teal' : status === 'loaned' ? 'gold' : 'rust';
}
