import { useState } from 'react';
import { useRefData } from '../context/RefDataContext.jsx';
import { Alert, Button } from './ui.jsx';

// Banner de error para la carga inicial de datos de referencia
// (géneros + clientes). Usa el MISMO componente `Alert` que el resto de la
// app y conserva el mensaje real del backend. Ofrece reintentar.
export default function RefDataBanner() {
  const { error, reload } = useRefData();
  const [retrying, setRetrying] = useState(false);

  if (!error) return null;

  async function retry() {
    setRetrying(true);
    try {
      await reload();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="mb-6">
      <Alert kind="error">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold uppercase tracking-label">
              No se pudieron cargar géneros y clientes
            </p>
            <p className="mt-1 text-sm">
              Las listas y los nombres asociados pueden aparecer incompletos. Detalle: {error}
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={retry} disabled={retrying}>
            {retrying ? 'Reintentando…' : 'Reintentar'}
          </Button>
        </div>
      </Alert>
    </div>
  );
}
