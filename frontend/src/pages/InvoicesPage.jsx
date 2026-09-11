import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import * as API from '../api/endpoints.js';
import { useRefData } from '../context/RefDataContext.jsx';
import { PageHeader, Card, Spinner, Alert, EmptyState, IconButton, IconEye } from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';
import InvoiceView from '../components/InvoiceView.jsx';
import { money, dateShort } from '../lib/format.js';

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { clientName } = useRefData();
  const { data: invoices, loading, error } = useAsync(() => API.listInvoices(), []);
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <PageHeader title="Facturas" />

      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : invoices.length === 0 ? (
        <EmptyState title="Sin facturas" hint="Se generan al registrar préstamos." />
      ) : (
        <Card accent={false}>
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>N.º</th>
                  <th>Emitida</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Préstamo</th>
                  <th className="!text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[...invoices]
                  .sort((a, b) => (b.number || 0) - (a.number || 0))
                  .map((inv) => (
                    <tr key={inv._id}>
                      <td className="font-semibold">{inv.number}</td>
                      <td className="whitespace-nowrap">{dateShort(inv.issued_at)}</td>
                      <td>{clientName(inv.client_id)}</td>
                      <td className="whitespace-nowrap">{money(inv.total)}</td>
                      <td>
                        <button
                          className="text-xs underline hover:text-teal"
                          onClick={() => navigate(`/prestamos/${inv.loan_id}`)}
                        >
                          {inv.loan_id?.slice(0, 16)}…
                        </button>
                      </td>
                      <td className="text-right">
                        <IconButton label="Ver factura" onClick={() => setSelected(inv)}>
                          <IconEye />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Factura N.º ${selected?.number ?? ''}`} wide>
        {selected && (
          <InvoiceView invoice={selected} clientName={clientName(selected.client_id)} />
        )}
      </Modal>
    </div>
  );
}
