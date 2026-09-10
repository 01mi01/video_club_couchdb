import { RainbowStripe, Button } from './ui.jsx';
import { money, dateTime } from '../lib/format.js';

// Factura imprimible. `@media print` en index.css oculta todo lo demas
// (clase .no-print) y muestra solo `.print-area`.
export default function InvoiceView({ invoice, clientName, showPrint = true }) {
  if (!invoice) return null;
  return (
    <div className="print-area border-2 border-ink bg-white">
      <RainbowStripe />
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Video Club — Comprobante</p>
            <h2 className="font-display text-2xl font-semibold text-ink">
              Factura N.º {invoice.number}
            </h2>
            <p className="text-sm text-ink-soft">Emitida: {dateTime(invoice.issued_at)}</p>
          </div>
          {showPrint && (
            <Button className="no-print" variant="ghost" size="sm" onClick={() => window.print()}>
              Imprimir
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-2 border-y-2 border-ink py-3 text-sm sm:grid-cols-2">
          <div>
            <span className="eyebrow">Cliente</span>
            <p className="text-ink">{clientName || invoice.client_id}</p>
          </div>
          <div className="sm:text-right">
            <span className="eyebrow">Préstamo</span>
            <p className="text-ink">{invoice.loan_id}</p>
          </div>
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left text-[11px] uppercase tracking-label text-ink-soft">
              <th className="py-2">Concepto</th>
              <th className="py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.lines || []).map((l, i) => (
              <tr key={i} className="border-b border-ink-line">
                <td className="py-2">{l.description}</td>
                <td className="py-2 text-right">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <Line k="Subtotal" v={money(invoice.subtotal)} />
          {invoice.discount_percent > 0 && (
            <Line
              k={`Descuento (${invoice.discount_percent}%)`}
              v={`− ${money(invoice.discount_amount)}`}
            />
          )}
          <div className="flex justify-between border-t-2 border-ink pt-2 font-display text-lg font-semibold">
            <span>Total</span>
            <span>{money(invoice.total)}</span>
          </div>
          <p className="text-right text-xs text-ink-soft">Moneda: {invoice.currency || 'Bs'}</p>
        </div>

        {invoice.note && (
          <p className="mt-4 border-2 border-orange bg-orange/10 p-3 text-xs text-[#9a5a12]">
            {invoice.note}
          </p>
        )}
      </div>
    </div>
  );
}

function Line({ k, v }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{k}</span>
      <span>{v}</span>
    </div>
  );
}
