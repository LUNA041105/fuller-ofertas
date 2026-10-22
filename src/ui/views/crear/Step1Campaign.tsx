import { useEffect, useMemo, useState } from 'react';
import type { Campaign } from '../../../shared/types';
import { yearLabel, campaignNumberLabel } from '../../../shared/types';

interface Props {
  campaigns: Campaign[];
  selected: Campaign | null;
  onSelect: (c: Campaign | null) => void;
  onCampaignsChanged: () => Promise<Campaign[]>;
}

// Paso 1: elegir una campana existente o crear/reusar una nueva por anio+numero.
export function Step1Campaign({
  campaigns,
  selected,
  onSelect,
  onCampaignsChanged,
}: Props) {
  const [mode, setMode] = useState<'existing' | 'new'>(
    campaigns.length > 0 ? 'existing' : 'new'
  );

  // --- Campana existente ---
  const years = useMemo(() => {
    const set = new Map<number, string>();
    for (const c of campaigns) {
      if (c.year != null) set.set(c.year, yearLabel(c.year));
    }
    return [...set.entries()].sort((a, b) => b[0] - a[0]);
  }, [campaigns]);

  const [exYear, setExYear] = useState<number | null>(null);
  const campsForYear = useMemo(
    () =>
      campaigns
        .filter((c) => c.year === exYear)
        .sort((a, b) => (a.campaignNumber ?? 0) - (b.campaignNumber ?? 0)),
    [campaigns, exYear]
  );

  // --- Campana nueva ---
  const [newYear, setNewYear] = useState('26');
  const [newNum, setNewNum] = useState('03');
  const [newMsg, setNewMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const newYearNum = parseInt(newYear, 10);
  const newNumNum = parseInt(newNum, 10);
  const newPreview =
    !isNaN(newYearNum) && !isNaN(newNumNum)
      ? `${yearLabel(newYearNum < 100 ? 2000 + newYearNum : newYearNum)} / ${campaignNumberLabel(newNumNum)}`
      : '';

  // Inicializa el anio existente seleccionado.
  useEffect(() => {
    if (exYear == null && years.length > 0) setExYear(years[0][0]);
  }, [years, exYear]);

  async function createOrReuse() {
    if (isNaN(newYearNum) || isNaN(newNumNum)) {
      setNewMsg('Indica un año y un número de campaña válidos.');
      return;
    }
    setBusy(true);
    setNewMsg(null);
    try {
      const fullYear = newYearNum < 100 ? 2000 + newYearNum : newYearNum;
      const res = await window.fuller.createOrReuseCampaign({
        year: fullYear,
        campaignNumber: newNumNum,
      });
      await onCampaignsChanged();
      onSelect(res.campaign);
      setNewMsg(
        res.reused
          ? 'Esa campaña ya existe. Se usará la existente.'
          : 'Campaña creada.'
      );
    } catch (e) {
      setNewMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wz-panel">
      {campaigns.length === 0 && (
        <div className="wz-note" style={{ marginBottom: 16 }}>
          Aún no hay campañas. Crea la primera indicando el año y el número.
        </div>
      )}

      <div className="wz-campaign-cards">
        {/* Usar campana existente */}
        <div
          className={`wz-opt-card${mode === 'existing' ? ' wz-opt-card-sel' : ''}${
            campaigns.length === 0 ? ' wz-opt-disabled' : ''
          }`}
          onClick={() => campaigns.length > 0 && setMode('existing')}
        >
          <div className="wz-opt-head">
            <input
              type="radio"
              name="campmode"
              checked={mode === 'existing'}
              disabled={campaigns.length === 0}
              onChange={() => setMode('existing')}
            />
            <strong>Usar campaña existente</strong>
          </div>
          <div className="wz-field-grid">
            <div>
              <label className="wz-label">Año</label>
              <select
                value={exYear ?? ''}
                disabled={mode !== 'existing'}
                onChange={(e) => {
                  setExYear(Number(e.target.value));
                  onSelect(null);
                }}
              >
                {years.map(([y, label]) => (
                  <option key={y} value={y}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="wz-label">Campaña</label>
              <select
                value={selected?.id ?? ''}
                disabled={mode !== 'existing'}
                onChange={(e) =>
                  onSelect(campaigns.find((c) => c.id === e.target.value) ?? null)
                }
              >
                <option value="">Selecciona...</option>
                {campsForYear.map((c) => (
                  <option key={c.id} value={c.id}>
                    {campaignNumberLabel(c.campaignNumber)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Crear nueva campana */}
        <div
          className={`wz-opt-card${mode === 'new' ? ' wz-opt-card-sel' : ''}`}
          onClick={() => setMode('new')}
        >
          <div className="wz-opt-head">
            <input
              type="radio"
              name="campmode"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
            />
            <div>
              <strong>Crear nueva campaña</strong>
              <div className="wz-muted">Indica el año y el número de campaña.</div>
            </div>
          </div>
          <div className="wz-field-grid">
            <div>
              <label className="wz-label">Ano (CY)</label>
              <input
                value={newYear}
                disabled={mode !== 'new'}
                onChange={(e) => setNewYear(e.target.value.replace(/\D/g, ''))}
                placeholder="26"
              />
            </div>
            <div>
              <label className="wz-label">Numero (C)</label>
              <input
                value={newNum}
                disabled={mode !== 'new'}
                onChange={(e) => setNewNum(e.target.value.replace(/\D/g, ''))}
                placeholder="03"
              />
            </div>
          </div>
          {mode === 'new' && newPreview && (
            <div className="wz-muted" style={{ marginTop: 10 }}>
              Quedara como: <strong>{newPreview}</strong>
            </div>
          )}
          {mode === 'new' && (
            <div className="wz-row" style={{ marginTop: 10 }}>
              <button className="primary" onClick={createOrReuse} disabled={busy}>
                {busy ? 'Creando...' : 'Crear / usar esta campaña'}
              </button>
              {newMsg && <span className="wz-muted">{newMsg}</span>}
            </div>
          )}
        </div>
      </div>

      {!selected && (
        <div className="wz-hint">
          Selecciona o crea una campaña para continuar.
        </div>
      )}
      {selected && (
        <div className="wz-ok">
          Campaña seleccionada: <strong>{selected.name}</strong>
        </div>
      )}
    </div>
  );
}
