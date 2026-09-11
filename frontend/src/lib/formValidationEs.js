/**
 * Traduce al español TODOS los mensajes de validación NATIVOS del
 * navegador ("Please fill out this field", "Please match the requested
 * format", etc.) en cualquier `<input>`/`<textarea>`/`<select>` del sitio,
 * sin tener que tocar cada formulario uno por uno.
 *
 * El navegador no permite traducir directamente `validationMessage` (es
 * de solo lectura y depende del idioma del navegador/SO, no de la app),
 * pero sí expone `setCustomValidity(texto)`, que reemplaza el mensaje
 * mostrado en el globo nativo de validación. El truco:
 *
 *   1. En el evento `invalid` (se dispara antes de mostrar el globo),
 *      limpiamos cualquier mensaje custom previo y leemos `validity`
 *      (`valueMissing`, `typeMismatch`, `tooShort`, ...) para elegir el
 *      texto en español correspondiente, y lo fijamos con
 *      `setCustomValidity`.
 *   2. En `input` (mientras el usuario escribe) limpiamos el mensaje
 *      custom, para que el navegador vuelva a evaluar la validez real en
 *      el próximo intento de envío (si no se limpia, el campo queda
 *      "inválido para siempre" aunque el valor ya sea correcto).
 *
 * Un solo listener a nivel de documento (captura) cubre TODOS los
 * formularios del sitio, actuales y futuros — no depende de que cada
 * <Field>/<TextInput> lo implemente por su cuenta.
 */
function messageFor(el) {
  const v = el.validity;
  if (v.valueMissing) return 'Este campo es obligatorio.';
  if (v.typeMismatch) {
    if (el.type === 'email') return 'Ingresa un correo electrónico válido.';
    if (el.type === 'url') return 'Ingresa una dirección web (URL) válida.';
    return 'El valor ingresado no tiene un formato válido.';
  }
  if (v.tooShort) return `Debe tener al menos ${el.minLength} caracteres.`;
  if (v.tooLong) return `Debe tener como máximo ${el.maxLength} caracteres.`;
  if (v.rangeUnderflow) return `El valor debe ser mayor o igual a ${el.min}.`;
  if (v.rangeOverflow) return `El valor debe ser menor o igual a ${el.max}.`;
  if (v.stepMismatch) return 'El valor no es válido para este campo (revisa los decimales permitidos).';
  if (v.patternMismatch) return 'El formato ingresado no es válido.';
  if (v.badInput) return 'No se pudo interpretar el valor ingresado.';
  return el.validationMessage || 'Este campo no es válido.';
}

export function installSpanishFormValidation() {
  document.addEventListener(
    'invalid',
    (e) => {
      const el = e.target;
      if (!el || typeof el.setCustomValidity !== 'function') return;
      el.setCustomValidity(''); // recalcula la validez NATIVA real
      if (el.validity.valid) return;
      el.setCustomValidity(messageFor(el));
    },
    true
  );

  // Limpia el mensaje custom al tipear, para que la próxima validación se
  // recalcule desde cero (si no, un campo ya corregido seguiría "inválido").
  document.addEventListener(
    'input',
    (e) => {
      const el = e.target;
      if (el && typeof el.setCustomValidity === 'function') el.setCustomValidity('');
    },
    true
  );
}
