import { useEffect } from 'react';
import { RainbowStripe } from './ui.jsx';

export default function Modal({ open, title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`card my-4 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} bg-white`}>
        <RainbowStripe />
        <div className="flex items-center justify-between border-b-2 border-ink px-5 py-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-ink" aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t-2 border-ink px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
