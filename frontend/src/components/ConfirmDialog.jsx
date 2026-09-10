import Modal from './Modal.jsx';
import { Button, Alert } from './ui.jsx';

// Confirmación de acciones destructivas con el lenguaje visual de la app
// (bordes rectos, tipografía editorial, franja "arcoíris" del Modal),
// en lugar del window.confirm() nativo del navegador.
//
// Uso:
//   const [ask, setAsk] = useState(null);   // null | payload
//   <ConfirmDialog
//     open={!!ask}
//     title="Eliminar género"
//     message={`¿Eliminar el género "${ask?.name}"? Esta acción no se puede deshacer.`}
//     confirmLabel="Eliminar"
//     danger
//     busy={busy}
//     error={err}
//     onCancel={() => setAsk(null)}
//     onConfirm={() => doDelete(ask)}
//   />
export default function ConfirmDialog({
  open,
  title = 'Confirmar acción',
  message,
  detail,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Procesando…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-ink">{message}</p>
        {detail && <p className="text-xs text-ink-soft">{detail}</p>}
      </div>
    </Modal>
  );
}
