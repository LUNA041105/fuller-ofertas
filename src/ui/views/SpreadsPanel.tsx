import { useEffect, useState } from 'react';
import type { Campaign, OriginalFile, Spread } from '../../shared/types';

interface Props {
  campaign: Campaign;
}

// Pestana "Spreads": a partir de los originales ya cargados, el usuario arma
// spreads (1 pagina simple o 2 paginas enfrentadas) y registra su codigo y las
// paginas impresas del catalogo. (Etapa 2)
export function SpreadsPanel({ campaign }: Props) {
  const [originals, setOriginals] = useState<OriginalFile[]>([]);
  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [activeOriginal, setActiveOriginal] = useState<OriginalFile | null>(null);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  async function refresh() {
    const [o, s] = await Promise.all([
      window.fuller.listOriginals(campaign.id),
      window.fuller.listSpreads(campaign.id),
    ]);
    setOriginals(o);
    setSpreads(s);
    if (!activeOriginal && o.length > 0) setActiveOriginal(o[0]);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  // Carga miniaturas de las paginas del original activo.
  useEffect(() => {
    if (!activeOriginal) return;
    let cancelled = false;
    (async () => {
      const entries: Record<string, string> = {};
      for (let i = 0; i < activeOriginal.pageCount; i++) {
        const key = `${activeOriginal.id}_${i}`;
        try {
          entries[key] = await window.fuller.pagePreview(activeOriginal.id, i);
        } catch {
          // Ignora paginas que no se puedan rasterizar.
        }
      }
      if (!cancelled) setPreviews((prev) => ({ ...prev, ...entries }));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeOriginal]);

  function togglePage(i: number) {
    setSelectedPages((prev) => {
      if (prev.includes(i)) return prev.filter((p) => p !== i);
      if (prev.length >= 2) return [prev[1], i]; // maximo 2, descarta el mas viejo
      return [...prev, i].sort((a, b) => a - b);
    });
  }

  async function createSpread() {
    if (!activeOriginal || selectedPages.length === 0) return;
    await window.fuller.createSpread({
      campaignId: campaign.id,
      originalId: activeOriginal.id,
      pdfPageIndices: selectedPages,
    });
    setSelectedPages([]);
    await refresh();
  }

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      {/* Columna 1: originales */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <h4 style={{ marginTop: 0 }}>Originales</h4>
        {originals.length === 0 ? (
          <div className="muted">Carga archivos en la pestana Originales.</div>
        ) : (
          originals.map((o) => (
            <div
              key={o.id}
              className="card"
              style={{
                padding: 10,
                marginBottom: 8,
                borderColor: activeOriginal?.id === o.id ? 'var(--accent)' : undefined,
              }}
              onClick={() => {
                setActiveOriginal(o);
                setSelectedPages([]);
              }}
            >
              <div style={{ fontSize: 13, wordBreak: 'break-all' }}>{o.displayName}</div>
              <div className="muted">{o.pageCount} pag.</div>
            </div>
          ))
        )}
      </div>

      {/* Columna 2: paginas del original para armar el spread */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ marginTop: 0 }}>
          Selecciona 1 o 2 paginas para formar un spread
        </h4>
        {!activeOriginal ? (
          <div className="empty">Selecciona un original.</div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 10,
                marginBottom: 14,
              }}
            >
              {Array.from({ length: activeOriginal.pageCount }).map((_, i) => {
                const key = `${activeOriginal.id}_${i}`;
                const chosen = selectedPages.includes(i);
                return (
                  <div
                    key={i}
                    onClick={() => togglePage(i)}
                    style={{
                      border: `2px solid ${chosen ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 8,
                      padding: 6,
                      cursor: 'pointer',
                      background: '#fff',
                    }}
                  >
                    {previews[key] ? (
                      <img
                        src={previews[key]}
                        alt={`Pag ${i + 1}`}
                        style={{ width: '100%', height: 150, objectFit: 'contain' }}
                      />
                    ) : (
                      <div
                        className="muted"
                        style={{
                          height: 150,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ...
                      </div>
                    )}
                    <div className="muted" style={{ textAlign: 'center', marginTop: 4 }}>
                      Pag {i + 1} {chosen && `· (${selectedPages.indexOf(i) + 1})`}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="row">
              <button
                className="primary"
                onClick={createSpread}
                disabled={selectedPages.length === 0}
              >
                Crear spread{' '}
                {selectedPages.length === 2 ? '(doble pagina)' : selectedPages.length === 1 ? '(simple)' : ''}
              </button>
              {selectedPages.length > 0 && (
                <button onClick={() => setSelectedPages([])}>Limpiar seleccion</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Columna 3: spreads creados */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <h4 style={{ marginTop: 0 }}>Spreads de la campaña</h4>
        {spreads.length === 0 ? (
          <div className="muted">Aun no hay spreads.</div>
        ) : (
          spreads.map((s) => (
            <SpreadCard key={s.id} spread={s} onChanged={refresh} />
          ))
        )}
      </div>
    </div>
  );
}

// Tarjeta editable de un spread: codigo, paginas del catalogo, eliminar.
function SpreadCard({ spread, onChanged }: { spread: Spread; onChanged: () => void }) {
  const [code, setCode] = useState(spread.spreadCode);
  const [catalog, setCatalog] = useState(spread.catalogPages.join('-'));

  async function save() {
    const pages = catalog
      .split(/[-,\s]+/)
      .map((x) => parseInt(x, 10))
      .filter((n) => !isNaN(n));
    await window.fuller.updateSpread(spread.id, {
      spreadCode: code,
      catalogPages: pages,
    });
    onChanged();
  }

  async function remove() {
    if (!confirm('Eliminar este spread?')) return;
    await window.fuller.deleteSpread(spread.id);
    onChanged();
  }

  return (
    <div className="card" style={{ padding: 12, marginBottom: 10, cursor: 'default' }}>
      <div className="muted" style={{ marginBottom: 6 }}>
        {spread.isDoublePage ? 'Doble pagina' : 'Pagina simple'} · PDF pag.{' '}
        {spread.pdfPageIndices.map((i) => i + 1).join(', ')}
      </div>
      <label className="muted">Codigo del spread</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{ width: '100%', marginBottom: 8 }}
        placeholder="08"
      />
      <label className="muted">Paginas del catalogo (ej 16-17)</label>
      <input
        value={catalog}
        onChange={(e) => setCatalog(e.target.value)}
        style={{ width: '100%', marginBottom: 8 }}
        placeholder="16-17"
      />
      <div className="row">
        <button className="primary" onClick={save}>
          Guardar
        </button>
        <button onClick={remove}>Eliminar</button>
      </div>
    </div>
  );
}
