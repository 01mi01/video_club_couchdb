import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as API from '../api/endpoints.js';
import { PageHeader, Card, Button, Spinner, Alert, Badge, TextInput } from '../components/ui.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useNavGuard } from '../context/NavGuardContext.jsx';
import { money } from '../lib/format.js';

// ============================================================================
// CONFIGURACIÓN — Gestión de Préstamos 2 y 3 del enunciado:
//   2. "Definir y modificar costos por día de préstamo (configurable)."
//   3. "Definir y modificar descuentos por cantidad de películas (configurable)."
// Ambos puntos están cubiertos por esta pantalla (tabla de precios por día +
// tramos de descuento por cantidad). El respaldo de la regla "no deben
// permitirse préstamos mayores a los días configurados" vive en el backend
// (`pricing.assertDaysAllowed`, aplicado en `loanService.createLoan`); aquí
// solo se EXPLICA para que quede claro por qué agregar/quitar un día cambia
// el máximo permitido.
// ============================================================================

const snapshot = (prices, tiers) => JSON.stringify({ prices, tiers });

export default function ConfigPage() {
  const navigate = useNavigate();
  const { register } = useNavGuard();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // pricing: arreglo de precios indexado por (dia - 1); dia = i + 1.
  const [prices, setPrices] = useState([]);
  const [pricingMeta, setPricingMeta] = useState({ persisted: false });
  const [pricingMsg, setPricingMsg] = useState(null);
  const [savingP, setSavingP] = useState(false);

  const [tiers, setTiers] = useState([]);
  const [discMeta, setDiscMeta] = useState({ persisted: false });
  const [discMsg, setDiscMsg] = useState(null);
  const [savingD, setSavingD] = useState(false);

  // Punto de referencia contra el que se compara para saber si hay
  // cambios sin guardar (se actualiza al cargar y después de cada guardado
  // exitoso — nunca "a mitad" de una edición).
  const baseline = useRef('');
  const [pendingNav, setPendingNav] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, d] = await Promise.all([API.getPricing(), API.getDiscounts()]);
      const map = p.price_by_days || {};
      const days = Object.keys(map)
        .map(Number)
        .sort((a, b) => a - b);
      const loadedPrices = days.map((day) => String(map[day]));
      const loadedTiers = (d.tiers || []).map((t) => ({
        min_qty: String(t.min_qty),
        max_qty: t.max_qty == null ? '' : String(t.max_qty),
        no_cap: t.max_qty == null,
        percent: String(t.percent),
      }));
      setPrices(loadedPrices);
      setPricingMeta({ persisted: p.persisted, max_days: p.max_days, updated_at: p.updated_at });
      setTiers(loadedTiers);
      setDiscMeta({ persisted: d.persisted, updated_at: d.updated_at });
      baseline.current = snapshot(loadedPrices, loadedTiers);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const dirty = !loading && snapshot(prices, tiers) !== baseline.current;

  // --- Aviso de salida con cambios sin guardar (punto 4, "SIEMPRE") -----
  // (a) cierre de pestaña / recarga: el navegador impone su propio texto
  //     genérico (ninguna app puede personalizarlo, es una protección de
  //     seguridad del navegador) — lo importante es que SIEMPRE aparece
  //     si hay cambios sin guardar.
  useEffect(() => {
    function handler(e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // (b) navegación DENTRO de la app (sidebar): intercepta y muestra un
  // aviso propio, en español, con la opción de salir sin guardar o
  // cancelar. (Limitación: no cubre el botón "atrás" del navegador — ver
  // NavGuardContext.jsx.)
  useEffect(() => {
    return register({
      tryNavigate: (to) => {
        if (!dirty) return true;
        setPendingNav(to);
        return false;
      },
    });
  }, [register, dirty]);

  function confirmLeave() {
    const to = pendingNav;
    setPendingNav(null);
    navigate(to);
  }

  // --- Precios por día ----------------------------------------------------
  function setPrice(i, v) {
    setPrices((p) => p.map((x, idx) => (idx === i ? v : x)));
  }
  function addDay() {
    setPrices((p) => [...p, '']);
  }
  function removeDay() {
    setPrices((p) => (p.length > 1 ? p.slice(0, -1) : p));
  }
  async function savePricing() {
    setSavingP(true);
    setPricingMsg(null);
    try {
      const price_by_days = {};
      prices.forEach((v, i) => {
        price_by_days[i + 1] = Number(v);
      });
      const res = await API.setPricing({ price_by_days });
      setPricingMeta({ persisted: true, max_days: res.max_days, updated_at: res.updated_at });
      setPricingMsg({
        kind: 'success',
        msg: `Guardado. Ahora el préstamo más largo permitido es de ${res.max_days} día(s).`,
      });
      baseline.current = snapshot(prices, tiers);
    } catch (e) {
      setPricingMsg({ kind: 'error', msg: e.message });
    } finally {
      setSavingP(false);
    }
  }

  // --- Descuentos por cantidad ---------------------------------------------
  function setTier(i, patch) {
    setTiers((t) => t.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addTier() {
    setTiers((t) => [...t, { min_qty: '', max_qty: '', no_cap: false, percent: '' }]);
  }
  function removeTier(i) {
    setTiers((t) => t.filter((_, idx) => idx !== i));
  }
  async function saveDiscounts() {
    setSavingD(true);
    setDiscMsg(null);
    try {
      const payload = {
        tiers: tiers.map((t) => ({
          min_qty: Number(t.min_qty),
          max_qty: t.no_cap ? null : Number(t.max_qty),
          percent: Number(t.percent),
        })),
      };
      const res = await API.setDiscounts(payload);
      setDiscMeta({ persisted: true, updated_at: res.updated_at });
      setDiscMsg({ kind: 'success', msg: 'Descuentos guardados.' });
      baseline.current = snapshot(prices, tiers);
    } catch (e) {
      setDiscMsg({ kind: 'error', msg: e.message });
    } finally {
      setSavingD(false);
    }
  }

  if (loading) return <Spinner label="Cargando configuración…" />;
  if (error) return <Alert>{error}</Alert>;

  return (
    <div>
      <PageHeader
        title="Configuración"
        actions={dirty ? <Badge tone="gold">Cambios sin guardar</Badge> : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* PRECIOS POR DIA */}
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Precio por día de préstamo</h2>
            <Badge tone={pricingMeta.persisted ? 'teal' : 'soft'}>
              {pricingMeta.persisted ? 'Personalizado' : 'Valores por defecto'}
            </Badge>
          </div>
          {pricingMsg && (
            <div className="mb-3">
              <Alert kind={pricingMsg.kind} onClose={() => setPricingMsg(null)}>
                {pricingMsg.msg}
              </Alert>
            </div>
          )}

          <div className="space-y-2">
            {prices.map((v, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-ink-soft">
                  {i + 1} día{i + 1 > 1 ? 's' : ''}
                </span>
                <TextInput
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={v}
                  onChange={(e) => setPrice(i, e.target.value)}
                  className="max-w-[8rem]"
                />
                <span className="text-sm text-ink-soft">Bs</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" type="button" onClick={addDay}>
              + Agregar un día más
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={removeDay}
              disabled={prices.length <= 1}
            >
              − Quitar el último día
            </Button>
          </div>

          <Button className="mt-4" onClick={savePricing} disabled={savingP}>
            {savingP ? 'Guardando…' : 'Guardar precios'}
          </Button>
        </Card>

        {/* DESCUENTOS */}
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Descuento por cantidad de películas</h2>
            <Badge tone={discMeta.persisted ? 'teal' : 'soft'}>
              {discMeta.persisted ? 'Personalizado' : 'Valores por defecto'}
            </Badge>
          </div>
          {discMsg && (
            <div className="mb-3">
              <Alert kind={discMsg.kind} onClose={() => setDiscMsg(null)}>
                {discMsg.msg}
              </Alert>
            </div>
          )}

          <div className="space-y-3">
            {tiers.map((t, i) => (
              <div key={i} className="rounded-lg border border-ink-line p-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="text-sm">
                    <span className="label">Desde (películas)</span>
                    <TextInput
                      type="number"
                      min="1"
                      required
                      value={t.min_qty}
                      onChange={(e) => setTier(i, { min_qty: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="label">Hasta (películas)</span>
                    <TextInput
                      type="number"
                      min="1"
                      required={!t.no_cap}
                      value={t.max_qty}
                      disabled={t.no_cap}
                      placeholder={t.no_cap ? 'sin límite' : ''}
                      onChange={(e) => setTier(i, { max_qty: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="label">Descuento</span>
                    <div className="flex items-center gap-1.5">
                      <TextInput
                        type="number"
                        min="0"
                        max="100"
                        required
                        value={t.percent}
                        onChange={(e) => setTier(i, { percent: e.target.value })}
                      />
                      <span className="text-ink-soft">%</span>
                    </div>
                  </label>
                  <div className="flex flex-col justify-start gap-2 sm:pt-5">
                    <label className="flex items-center gap-2 text-xs text-ink">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-teal"
                        checked={t.no_cap}
                        onChange={(e) => setTier(i, { no_cap: e.target.checked, max_qty: '' })}
                      />
                      Sin límite superior
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="self-start text-rust hover:bg-rust/10"
                      onClick={() => removeTier(i)}
                    >
                      Eliminar tramo
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button size="sm" variant="ghost" type="button" className="mt-3" onClick={addTier}>
            + Agregar tramo de descuento
          </Button>

          <Button className="mt-4 block" onClick={saveDiscounts} disabled={savingD}>
            {savingD ? 'Guardando…' : 'Guardar descuentos'}
          </Button>
        </Card>
      </div>

      <Card className="mt-4" accent={false}>
        <h2 className="mb-3 text-lg font-semibold">Vista previa de la tabla vigente</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Precios</p>
            <ul className="mt-2 text-sm">
              {prices.map((v, i) => (
                <li key={i} className="flex justify-between border-b border-ink-line py-1.5">
                  <span className="text-ink-soft">
                    {i + 1} día{i + 1 > 1 ? 's' : ''}
                  </span>
                  <span className="font-medium">{money(Number(v || 0))}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Descuentos</p>
            <ul className="mt-2 text-sm">
              {tiers.map((t, i) => (
                <li key={i} className="flex justify-between border-b border-ink-line py-1.5">
                  <span className="text-ink-soft">
                    {t.min_qty || '?'}
                    {t.no_cap ? ' o más' : ` a ${t.max_qty || '?'}`} películas
                  </span>
                  <span className="font-medium">{t.percent || 0}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={!!pendingNav}
        title="Cambios sin guardar"
        message="Existen cambios sin guardar en Configuración. Si se sale ahora, se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        danger
        onCancel={() => setPendingNav(null)}
        onConfirm={confirmLeave}
      />
    </div>
  );
}
