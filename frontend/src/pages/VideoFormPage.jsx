import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as API from '../api/endpoints.js';
import { useRefData } from '../context/RefDataContext.jsx';
import { PageHeader, Card, Button, Spinner, Alert, Field, TextInput, Badge } from '../components/ui.jsx';
import StringListField from '../components/StringListField.jsx';
import { toDateInput, fromDateInput } from '../lib/format.js';

const EMPTY = {
  display_title: '',
  original_title: '',
  original_language: '',
  english_title: '',
  alternative_titles: [],
  duration_minutes: '',
  genre_ids: [],
  release_year: '',
  oscar_nominations: [],
  oscar_wins: [],
  main_actors: [],
  unit_cost: '',
  units_acquired: '',
  acquisition_date: toDateInput(new Date().toISOString()),
};

export default function VideoFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { genres, refreshGenres } = useRefData();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const v = await API.getVideo(id);
        setForm({
          ...EMPTY,
          ...v,
          duration_minutes: v.duration_minutes ?? '',
          release_year: v.release_year ?? '',
          unit_cost: v.unit_cost ?? '',
          units_acquired: v.units_acquired ?? '',
          alternative_titles: v.alternative_titles || [],
          oscar_nominations: v.oscar_nominations || [],
          oscar_wins: v.oscar_wins || [],
          main_actors: v.main_actors || [],
          genre_ids: v.genre_ids || [],
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleGenre = (gid) =>
    set({
      genre_ids: form.genre_ids.includes(gid)
        ? form.genre_ids.filter((x) => x !== gid)
        : [...form.genre_ids, gid],
    });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const clean = (arr) => (arr || []).map((s) => s.trim()).filter(Boolean);
    const payload = {
      display_title: form.display_title.trim(),
      original_title: form.original_title.trim() || undefined,
      original_language: form.original_language.trim() || undefined,
      english_title: form.english_title.trim() || undefined,
      alternative_titles: clean(form.alternative_titles),
      duration_minutes: Number(form.duration_minutes),
      genre_ids: form.genre_ids,
      release_year: Number(form.release_year),
      oscar_nominations: clean(form.oscar_nominations),
      oscar_wins: clean(form.oscar_wins),
      main_actors: clean(form.main_actors),
      unit_cost: Number(form.unit_cost),
    };
    if (!isEdit) {
      payload.units_acquired = Number(form.units_acquired);
      payload.acquisition_date = fromDateInput(form.acquisition_date);
    }

    try {
      const saved = isEdit
        ? await API.updateVideo(id, payload)
        : await API.createVideo(payload);
      await refreshGenres();
      navigate(`/videos/${saved._id || id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Cargando película…" />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Editar película' : 'Nueva película'}
        subtitle={
          isEdit
            ? 'La edición cambia solo los metadatos; las copias se administran desde el detalle.'
            : 'Al registrar se generan automáticamente las copias iniciales según las unidades adquiridas.'
        }
        actions={
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Volver
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert onClose={() => setError(null)}>{error}</Alert>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Títulos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título principal (para mostrar)" required>
              <TextInput
                value={form.display_title}
                onChange={(e) => set({ display_title: e.target.value })}
                required
              />
            </Field>
            <Field label="Título original">
              <TextInput
                value={form.original_title}
                onChange={(e) => set({ original_title: e.target.value })}
                placeholder="Si difiere del principal"
              />
            </Field>
            <Field label="Idioma original">
              <TextInput
                value={form.original_language}
                onChange={(e) => set({ original_language: e.target.value })}
                placeholder="ej. Coreano"
              />
            </Field>
            <Field label="Título en inglés">
              <TextInput
                value={form.english_title}
                onChange={(e) => set({ english_title: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4">
            <StringListField
              label="Títulos alternativos"
              hint="Otros nombres con los que se conoce la película"
              value={form.alternative_titles}
              onChange={(v) => set({ alternative_titles: v })}
              placeholder="ej. Parásitos"
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold">Ficha</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Duración (minutos)" required>
              <TextInput
                type="number"
                min="1"
                value={form.duration_minutes}
                onChange={(e) => set({ duration_minutes: e.target.value })}
                required
              />
            </Field>
            <Field label="Año de publicación" required>
              <TextInput
                type="number"
                min="1888"
                max="2100"
                value={form.release_year}
                onChange={(e) => set({ release_year: e.target.value })}
                required
              />
            </Field>
            <Field label="Costo unitario del DVD (Bs)" required>
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={form.unit_cost}
                onChange={(e) => set({ unit_cost: e.target.value })}
                required
              />
            </Field>
          </div>

          <div className="mt-4">
            <span className="label">
              Géneros <span className="text-rust">*</span>
            </span>
            <div className="grid gap-2 border-2 border-ink p-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...genres]
                // Un género inactivo ya no se puede asignar a películas
                // nuevas ni agregarlo en una edición — se excluye del
                // selector. Excepción: si esta película YA lo tenía
                // asignado, se sigue mostrando (con badge) para no
                // ocultarle al usuario un dato que el video ya tiene.
                .filter((g) => g.active !== false || form.genre_ids.includes(g._id))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((g) => (
                  <label key={g._id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#0d9797]"
                      checked={form.genre_ids.includes(g._id)}
                      onChange={() => toggleGenre(g._id)}
                    />
                    {g.name}
                    {g.active === false && (
                      <Badge tone="soft">Inactivo</Badge>
                    )}
                  </label>
                ))}
            </div>
            <span className="mt-1 block text-xs text-ink-soft">
              Selecciona al menos uno. Una película puede tener varios géneros. Los géneros
              inactivos no aparecen aquí salvo que la película ya los tenga asignados.
            </span>
          </div>

          <div className="mt-4">
            <StringListField
              label="Actores principales"
              value={form.main_actors}
              onChange={(v) => set({ main_actors: v })}
              placeholder="ej. Song Kang-ho"
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold">Premios Oscar</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <StringListField
              label="Nominaciones"
              hint="Categorías a las que fue nominada"
              value={form.oscar_nominations}
              onChange={(v) => set({ oscar_nominations: v })}
              placeholder="ej. Best Picture"
            />
            <StringListField
              label="Premios ganados"
              hint="Toda categoría ganada cuenta también como nominación"
              value={form.oscar_wins}
              onChange={(v) => set({ oscar_wins: v })}
              placeholder="ej. Best Director"
            />
          </div>
        </Card>

        {!isEdit && (
          <Card>
            <h2 className="mb-4 text-xl font-semibold">Adquisición inicial</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Unidades adquiridas" required hint="Se crean tantas copias como unidades">
                <TextInput
                  type="number"
                  min="1"
                  value={form.units_acquired}
                  onChange={(e) => set({ units_acquired: e.target.value })}
                  required
                />
              </Field>
              <Field label="Fecha de adquisición">
                <TextInput
                  type="date"
                  value={form.acquisition_date}
                  onChange={(e) => set({ acquisition_date: e.target.value })}
                />
              </Field>
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar película'}
          </Button>
        </div>
      </form>
    </div>
  );
}
