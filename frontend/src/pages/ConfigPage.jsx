import { useState, useEffect } from 'react';
import * as API from '../api/endpoints.js';
import { PageHeader, Card, Button, Spinner, Alert, Badge, TextInput } from '../components/ui.jsx';
import { money } from '../lib/format.js';

export default function ConfigPage() {
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, d] = await Promise.all([API.getPricing(), API.getDiscounts()]);
      const map = p.price_by_days || {};
      const days = Object.keys(map)
        .map(Number)
        .sort((a, b) => a - b);
      setPrices(days.map((day) => String(map[day])));
      setPricingMeta({ persisted: p.persisted, max_days: p.max_days, updated_at: p.updated_at });
      setTiers(
        (d.tiers || []).map((t) => ({
          min_qty: String(t.min_qty),
          max_qty: t.max_qty == null ? '' : String(t.max_qty),
          no_cap: t.max_qty == null,
          percent: String(t.percent),
        }))
      );
      setDiscMeta({ persisted: d.persisted, updated_at: d.updated_at });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // --- Pricing ---
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
      setPricingMsg({ kind: 'success', msg: `Guardado. Máximo de días de préstamo: ${res.max_days}.` });
    } catch (e) {
      setPricingMsg({ kind: 'error', msg: e.message });
    } finally {
      setSavingP(false);
    }
  }

  // --- Discounts ---
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
        subtitle="Costos por día de préstamo y descuentos por cantidad de películas. Ambos configurables."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* PRECIOS POR DIA */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Costo por día de préstamo</h2>
            <Badge tone={pricingMeta.persisted ? 'teal' : 'soft'}>
              {pricingMeta.persisted ? 'Personalizado' : 'Valores por defecto'}
            </Badge>
          </div>
          <p className="mb-3 text-sm text-ink-soft">
            El precio es el total por película para ese plazo. El máximo de días de préstamo es el
            mayor plazo con precio (actual: <strong>{prices.length}</strong>). No se permiten
            préstamos más largos.
          </p>

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
                <span className="w-20 text-sm text-ink-soft">
                  {i + 1} día{i + 1 > 1 ? 's' : ''}
                </span>
                <TextInput
                  type="number"
                  min="0"
                  step="0.5"
                  value={v}
                  onChange={(e) => setPrice(i, e.target.value)}
                  className="max-w-[8rem]"
                />
                <span className="text-sm text-ink-soft">Bs</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" onClick={addDay}>
              + Agregar día
            </Button>
            <Button size="sm" variant="ghost" onClick={removeDay} disabled={prices.length <= 1}>
              − Quitar último
            </Button>
          </div>

          <Button className="mt-4" onClick={savePricing} disabled={savingP}>
            {savingP ? 'Guardando…' : 'Guardar precios'}
          </Button>
        </Card>

        {/* DESCUENTOS */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Descuentos por cantidad</h2>
            <Badge tone={discMeta.persisted ? 'teal' : 'soft'}>
              {discMeta.persisted ? 'Personalizado' : 'Valores por defecto'}
            </Badge>
          </div>
          <p className="mb-3 text-sm text-ink-soft">
            Descuento aplicado al total según cuántas películas lleva el cliente en un mismo préstamo.
          </p>

          {discMsg && (
            <div className="mb-3">
              <Alert kind={discMsg.kind} onClose={() => setDiscMsg(null)}>
                {discMsg.msg}
              </Alert>
            </div>
          )}

          <div className="space-y-3">
            {tiers.map((t, i) => (
              <div key={i} className="border-2 border-ink p-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="text-sm">
                    <span className="label">Desde</span>
                    <TextInput
                      type="number"
                      min="1"
                      value={t.min_qty}
                      onChange={(e) => setTier(i, { min_qty: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="label">Hasta</span>
                    <TextInput
                      type="number"
                      min="1"
                      value={t.max_qty}
                      disabled={t.no_cap}
                      onChange={(e) => setTier(i, { max_qty: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="label">Descuento %</span>
                    <TextInput
                      type="number"
                      min="0"
                      max="100"
                      value={t.percent}
                      onChange={(e) => setTier(i, { percent: e.target.value })}
                    />
                  </label>
                  <div className="flex items-end justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-ink">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#0d9797]"
                        checked={t.no_cap}
                        onChange={(e) => setTier(i, { no_cap: e.target.checked })}
                      />
                      Sin tope
                    </label>
                    <button
                      className="text-xs text-rust underline"
                      onClick={() => removeTier(i)}
                      type="button"
                    >
                      quitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button size="sm" variant="ghost" className="mt-3" onClick={addTier}>
            + Agregar tramo
          </Button>

          <Button className="mt-4 block" onClick={saveDiscounts} disabled={savingD}>
            {savingD ? 'Guardando…' : 'Guardar descuentos'}
          </Button>
        </Card>
      </div>

      <Card className="mt-4" accent={false}>
        <h2 className="text-xl font-semibold">Vista previa de la tabla vigente</h2>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Precios</p>
            <ul className="mt-2 text-sm">
              {prices.map((v, i) => (
                <li key={i} className="flex justify-between border-b border-ink-line py-1">
                  <span className="text-ink-soft">
                    {i + 1} día{i + 1 > 1 ? 's' : ''}
                  </span>
                  <span>{money(Number(v || 0))}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Descuentos</p>
            <ul className="mt-2 text-sm">
              {tiers.map((t, i) => (
                <li key={i} className="flex justify-between border-b border-ink-line py-1">
                  <span className="text-ink-soft">
                    {t.min_qty || '?'}
                    {t.no_cap ? ' o más' : ` a ${t.max_qty || '?'}`} películas
                  </span>
                  <span>{t.percent || 0}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
