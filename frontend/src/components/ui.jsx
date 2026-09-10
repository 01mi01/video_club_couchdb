// Piezas de UI pequenas y reutilizables, con el lenguaje visual
// retro-editorial (bordes rectos, azul ancla, franjas de color como
// acento estructural). Ver CLAUDE.md > Frontend - Diseno visual.

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
    <div className="mb-6 border-b-2 border-ink pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <RainbowStripe className="mt-4" />
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
    error: 'border-rust bg-rust/10 text-rust',
    success: 'border-teal bg-teal/10 text-teal',
    info: 'border-ink bg-cream/50 text-ink',
    warn: 'border-orange bg-orange/10 text-[#9a5a12]',
  }[kind];
  return (
    <div className={`flex items-start justify-between gap-3 border-2 ${styles} px-4 py-3 text-sm`}>
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
    ink: 'border-ink bg-white text-ink',
    teal: 'border-teal bg-teal/10 text-teal',
    gold: 'border-gold bg-gold/20 text-[#8a5a10]',
    rust: 'border-rust bg-rust/10 text-rust',
    soft: 'border-ink-line bg-paper-panel text-ink-soft',
  };
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-label ${tones[tone] || tones.ink}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="flex items-center gap-3 py-10 text-ink-soft">
      <span className="inline-block h-4 w-4 animate-spin border-2 border-ink border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title = 'Sin datos', hint }) {
  return (
    <div className="border-2 border-dashed border-ink-line px-6 py-12 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
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
