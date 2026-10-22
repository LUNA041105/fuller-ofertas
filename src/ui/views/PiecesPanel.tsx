import { useEffect, useState } from 'react';
import type {
  Campaign,
  Spread,
  Piece,
  PieceVersion,
  AspectFormat,
} from '../../shared/types';
import { FORMAT_SPECS } from '../../shared/types';
import { PieceReview } from './PieceReview';

interface Props {
  campaign: Campaign;
}

const FORMATS: AspectFormat[] = ['9:16', '4:5', '1:1'];

// Pestana "Piezas": crear piezas (agrupando spreads + formato), generarlas y
// abrir la revision de cada una. (Etapa 3; la revision/rehacer es Etapa 4)
export function PiecesPanel({ campaign }: Props) {
  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [finals, setFinals] = useState<Record<string, PieceVersion | null>>({});
  const [format, setFormat] = useState<AspectFormat>('9:16');
  const [chosenSpreads, setChosenSpreads] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [reviewPiece, setReviewPiece] = useState<Piece | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  async function refresh() {
    const [s, p] = await Promise.all([
      window.fuller.listSpreads(campaign.id),
      window.fuller.listPieces(campaign.id),
    ]);
    setSpreads(s);
    setPieces(p);
    // Carga la mejor version (definitiva o ultima) de cada pieza para la miniatura.
    const map: Record<string, PieceVersion | null> = {};
    for (const piece of p) {
      const versions = await window.fuller.listVersions(piece.id);
      const final = versions.find((v) => v.isFinal);
      map[piece.id] = final ?? versions[versions.length - 1] ?? null;
    }
    setFinals(map);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  function toggleSpread(id: string) {
    setChosenSpreads((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function createAndGenerate() {
    if (chosenSpreads.length === 0) return;
    setBusy(true);
    try {
      const piece = await window.fuller.createPiece({
        campaignId: campaign.id,
        spreadIds: chosenSpreads,
        format,
      });
      await window.fuller.generatePiece(piece.id);
      setChosenSpreads([]);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function spreadName(id: string): string {
    const s = spreads.find((x) => x.id === id);
    return s ? `Spread ${s.spreadCode}` : id;
  }

  function toggleSelected(pieceId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected((prev) =>
      prev.includes(pieceId) ? prev.filter((x) => x !== pieceId) : [...prev, pieceId]
    );
  }

  // Devuelve el id de la version exportable (final o ultima) de cada pieza seleccionada.
  function selectedVersionIds(): string[] {
    return selected
      .map((pid) => finals[pid]?.id)
      .filter((id): id is string => Boolean(id));
  }

  async function exportSelection() {
    const ids = selectedVersionIds();
    if (ids.length === 0) return;
    const dest = await window.fuller.exportSelection(ids);
    if (dest) flash(`Exportadas ${ids.length} imagenes a: ${dest}`);
  }

  async function exportZip() {
    try {
      const dest = await window.fuller.exportZip(campaign.id);
      if (dest) flash(`ZIP creado: ${dest}`);
    } catch (e) {
      flash(`Error: ${(e as Error).message}`);
    }
  }

  function flash(msg: string) {
    setExportMsg(msg);
    setTimeout(() => setExportMsg(null), 4000);
  }

  if (reviewPiece) {
    return (
      <PieceReview
        piece={reviewPiece}
        onBack={() => {
          setReviewPiece(null);
          refresh();
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      {/* Panel de creacion */}
      <div style={{ width: 320, flexShrink: 0 }}>
        <h4 style={{ marginTop: 0 }}>Nueva pieza</h4>

        <label className="muted">Formato</label>
        <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          {FORMATS.map((f) => (
            <button
              key={f}
              className={format === f ? 'primary' : ''}
              onClick={() => setFormat(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="muted" style={{ marginBottom: 14 }}>
          {FORMAT_SPECS[format].width} × {FORMAT_SPECS[format].height} px
        </div>

        <label className="muted">
          Spreads a incluir ({chosenSpreads.length} seleccionados)
        </label>
        <div style={{ marginTop: 6, marginBottom: 14, maxHeight: 280, overflow: 'auto' }}>
          {spreads.length === 0 ? (
            <div className="muted">Crea spreads en la pestana Spreads.</div>
          ) : (
            spreads.map((s) => (
              <label
                key={s.id}
                className="card"
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: 10,
                  marginBottom: 6,
                  cursor: 'pointer',
                  alignItems: 'center',
                  borderColor: chosenSpreads.includes(s.id) ? 'var(--accent)' : undefined,
                }}
              >
                <input
                  type="checkbox"
                  checked={chosenSpreads.includes(s.id)}
                  onChange={() => toggleSpread(s.id)}
                />
                <span>
                  Spread {s.spreadCode}{' '}
                  <span className="muted">
                    {s.isDoublePage ? '(doble)' : '(simple)'}
                    {s.catalogPages.length > 0 && ` · pags. ${s.catalogPages.join('-')}`}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>

        <button
          className="primary"
          onClick={createAndGenerate}
          disabled={busy || chosenSpreads.length === 0}
        >
          {busy ? 'Generando...' : 'Crear y generar pieza'}
        </button>
        {chosenSpreads.length > 1 && (
          <div className="muted" style={{ marginTop: 8 }}>
            Se agruparan {chosenSpreads.length} spreads apilados en una pieza.
          </div>
        )}
      </div>

      {/* Grid de piezas generadas */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ marginTop: 0, marginBottom: 12, flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, marginRight: 'auto' }}>Piezas de la campaña</h4>
          <button onClick={exportSelection} disabled={selected.length === 0}>
            Exportar seleccion ({selected.length})
          </button>
          <button className="primary" onClick={exportZip} disabled={pieces.length === 0}>
            Exportar ZIP de la campaña
          </button>
        </div>
        {exportMsg && (
          <div className="muted" style={{ marginBottom: 10 }}>
            {exportMsg}
          </div>
        )}
        {pieces.length === 0 ? (
          <div className="empty">Aun no hay piezas. Crea la primera.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 14,
            }}
          >
            {pieces.map((p) => {
              const v = finals[p.id];
              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: 10,
                    borderColor: selected.includes(p.id) ? 'var(--accent)' : undefined,
                  }}
                  onClick={() => setReviewPiece(p)}
                >
                  <label
                    className="row"
                    style={{ marginBottom: 6, fontSize: 12 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={(e) => toggleSelected(p.id, e as unknown as React.MouseEvent)}
                    />
                    <span className="muted">Seleccionar</span>
                  </label>
                  <div
                    style={{
                      background: '#f0ece6',
                      borderRadius: 6,
                      minHeight: 200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {v?.imageUrl ? (
                      <img
                        src={v.imageUrl}
                        alt={p.pieceCode}
                        style={{ width: '100%', maxHeight: 260, objectFit: 'contain' }}
                      />
                    ) : (
                      <span className="muted">Sin imagen</span>
                    )}
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 600 }}>
                    Pieza {p.pieceCode} · {p.format}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {p.spreadIds.map(spreadName).join(', ')}
                  </div>
                  {v?.isFinal && (
                    <div style={{ color: 'var(--accent)', fontSize: 12, marginTop: 4 }}>
                      ★ Definitiva
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
