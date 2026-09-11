// Piezas de UI pequenas y reutilizables: panel de administracion moderno
// (bordes suaves, tarjetas redondeadas) que conserva la paleta de marca y
// la franja de colores como acento estructural. Ver CLAUDE.md > Frontend
// - Diseno visual.

export function RainbowStripe({ thin = false, className = '' }) {
  return <div className={`rainbow-stripe ${thin ? 'rainbow-stripe-thin' : ''} ${className}`} />;
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

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <RainbowStripe className="mt-4 rounded-full" />
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

export function loanStatusTone(status) {
  return status === 'active' ? 'teal' : status === 'returned' ? 'soft' : 'rust';
}
export function copyStatusTone(status) {
  return status === 'available' ? 'teal' : status === 'loaned' ? 'gold' : 'rust';
}
