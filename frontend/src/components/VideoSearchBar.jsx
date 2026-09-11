import { useState } from 'react';
import { useRefData } from '../context/RefDataContext.jsx';
import { Button, Field, TextInput, Select } from './ui.jsx';

// Busqueda de peliculas por NOMBRE / GENERO / ACTOR / NOMINACION AL OSCAR.
// Es el requisito "MUY IMPORTANTE" del profesor. Cada campo mapea a un
// parametro de GET /api/videos/search (indices Mango en el backend).
// La busqueda por nombre es insensible a acentos y mayusculas.
export default function VideoSearchBar({ onSearch, onClear, busy }) {
  const { genres, oscarCategories } = useRefData();
  const [f, setF] = useState({ title: '', genreId: '', actor: '', oscarNomination: '', oscarNominated: false });

  function submit(e) {
    e.preventDefault();
    const params = {};
    if (f.title.trim()) params.title = f.title.trim();
    if (f.genreId) params.genreId = f.genreId;
    if (f.actor.trim()) params.actor = f.actor.trim();
    if (f.oscarNomination.trim()) params.oscarNomination = f.oscarNomination.trim();
    if (f.oscarNominated && !params.oscarNomination) params.oscarNominated = 'true';
    onSearch(params);
  }

  function clear() {
    setF({ title: '', genreId: '', actor: '', oscarNomination: '', oscarNominated: false });
    onClear?.();
  }

  return (
    <form onSubmit={submit} className="card bg-white">
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nombre" hint="Título original, en inglés o alternativo">
          <TextInput
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="ej. nomadas, parasite…"
          />
        </Field>
        <Field label="Género">
          <Select value={f.genreId} onChange={(e) => setF({ ...f, genreId: e.target.value })}>
            <option value="">— cualquiera —</option>
            {[...genres]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Actor principal">
          <TextInput
            value={f.actor}
            onChange={(e) => setF({ ...f, actor: e.target.value })}
            placeholder="ej. Song Kang-ho"
          />
        </Field>
        <Field label="Nominación al Oscar" hint="Busca en español o en inglés indistintamente">
          <Select
            value={f.oscarNomination}
            onChange={(e) => setF({ ...f, oscarNomination: e.target.value })}
          >
            <option value="">— cualquiera —</option>
            {[...oscarCategories]
              .sort((a, b) => a.name_es.localeCompare(b.name_es))
              .map((c) => (
                <option key={c._id} value={c.name_es}>
                  {c.name_es} ({c.name_en})
                </option>
              ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-line px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#0d9797]"
            checked={f.oscarNominated}
            onChange={(e) => setF({ ...f, oscarNominated: e.target.checked })}
            disabled={!!f.oscarNomination.trim()}
          />
          Solo películas con alguna nominación al Oscar
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={clear} disabled={busy}>
            Limpiar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>
      </div>
    </form>
  );
}
