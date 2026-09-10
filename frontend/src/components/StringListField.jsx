import { Field, TextInput, Button } from './ui.jsx';

// Editor de una lista de textos (titulos alternativos, actores,
// nominaciones/premios Oscar). Cada fila es un input; boton para agregar y
// quitar. `value` es un array de strings.
export default function StringListField({ label, hint, value, onChange, placeholder }) {
  const items = value && value.length ? value : [''];

  function update(i, v) {
    const next = [...items];
    next[i] = v;
    onChange(next.filter((x, idx) => x.trim() !== '' || idx === next.length - 1));
  }
  function add() {
    onChange([...items, '']);
  }
  function remove(i) {
    const next = items.filter((_, idx) => idx !== i);
    onChange(next.length ? next : []);
  }

  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <TextInput
              value={it}
              placeholder={placeholder}
              onChange={(e) => update(i, e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(i)}
              aria-label="Quitar"
            >
              −
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          + Agregar
        </Button>
      </div>
    </Field>
  );
}
