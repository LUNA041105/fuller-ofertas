import { useEffect, useState } from 'react';
import type { Campaign, OriginalFile } from '../../shared/types';

interface Props {
  campaign: Campaign;
}

// Pestana "Originales": importar PDFs/imagenes, listarlos y previsualizar
// cada pagina. Es el primer paso del flujo (Etapa 1).
export function OriginalsPanel({ campaign }: Props) {
  const [originals, setOriginals] = useState<OriginalFile[]>([]);
  const [selected, setSelected] = useState<OriginalFile | null>(null);
  const [page, setPage] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function refresh() {
    const list = await window.fuller.listOriginals(campaign.id);
    setOriginals(list);
    if (!selected && list.length > 0) {
      setSelected(list[0]);
      setPage(0);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  // Carga la previsualizacion cuando cambia el archivo o la pagina.
  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      if (!selected) {
        setPreviewUrl(null);
        return;
      }
      setLoading(true);
      try {
        const url = await window.fuller.pagePreview(selected.id, page);
        if (!cancelled) setPreviewUrl(url);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [selected, page]);

  async function importFiles() {
    setImporting(true);
    try {
      await window.fuller.importOriginals(campaign.id);
      await refresh();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      {/* Panel lateral: lista de archivos */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <div className="toolbar">
          <button className="primary" onClick={importFiles} disabled={importing}>
            {importing ? 'Importando...' : '+ Cargar PDFs o imagenes'}
          </button>
        </div>
        {originals.length === 0 ? (
          <div className="muted">Aún no hay archivos en esta campaña.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {originals.map((o) => (
              <div
                key={o.id}
                className="card"
                style={{
                  padding: 12,
                  borderColor: selected?.id === o.id ? 'var(--accent)' : undefined,
                }}
                onClick={() => {
                  setSelected(o);
                  setPage(0);
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, wordBreak: 'break-all' }}>
                  {o.displayName}
                </div>
                <div className="muted">
                  {o.kind.toUpperCase()} · {o.pageCount}{' '}
                  {o.pageCount === 1 ? 'pagina' : 'paginas'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel central: previsualizacion */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selected ? (
          <div className="empty">Selecciona un archivo para previsualizar.</div>
        ) : (
          <div>
            <div className="row" style={{ marginBottom: 12 }}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Anterior
              </button>
              <span className="muted">
                Pagina {page + 1} de {selected.pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(selected.pageCount - 1, p + 1))}
                disabled={page >= selected.pageCount - 1}
              >
                Siguiente →
              </button>
            </div>
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: '#fff',
                padding: 12,
                display: 'flex',
                justifyContent: 'center',
                minHeight: 300,
                alignItems: 'center',
              }}
            >
              {loading ? (
                <span className="muted">Generando previsualizacion...</span>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt={`Pagina ${page + 1}`}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                />
              ) : (
                <span className="muted">No se pudo cargar la previsualizacion.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
