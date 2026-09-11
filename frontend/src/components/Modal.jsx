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
      <div className={`card my-4 w-full overflow-hidden ${wide ? 'max-w-3xl' : 'max-w-lg'} bg-white`}>
        <RainbowStripe />
        <div className="flex items-center justify-between border-b border-ink-line px-5 py-3.5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-xl leading-none text-ink-soft hover:bg-ink/5 hover:text-ink"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-ink-line bg-paper-panel/40 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
