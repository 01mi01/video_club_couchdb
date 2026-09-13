/**
 * Traduce al español los mensajes de validación nativos del navegador en
 * cualquier input/textarea/select del sitio. `validationMessage` es de
 * solo lectura, pero `setCustomValidity(texto)` reemplaza el mensaje
 * mostrado: se fija en el evento `invalid` (según `el.validity`) y se
 * limpia en `input` (si no, el campo queda "inválido para siempre" aunque
 * el valor ya sea correcto). Un solo listener a nivel de documento cubre
 * todos los formularios, sin que cada uno lo implemente por su cuenta.
 */
function messageFor(el) {
  const v = el.validity;
  if (v.valueMissing) return 'Este campo es obligatorio.';
  if (v.typeMismatch) {
    if (el.type === 'email') return 'Debe ingresarse un correo electrónico válido.';
    if (el.type === 'url') return 'Debe ingresarse una dirección web (URL) válida.';
    return 'El valor ingresado no tiene un formato válido.';
  }
  if (v.tooShort) return `Debe tener al menos ${el.minLength} caracteres.`;
  if (v.tooLong) return `Debe tener como máximo ${el.maxLength} caracteres.`;
  if (v.rangeUnderflow) return `El valor debe ser mayor o igual a ${el.min}.`;
  if (v.rangeOverflow) return `El valor debe ser menor o igual a ${el.max}.`;
  if (v.stepMismatch) return 'El valor no es válido para este campo (verificar los decimales permitidos).';
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
