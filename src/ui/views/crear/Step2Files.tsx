import { useRef, useState } from 'react';
import type { Campaign } from '../../../shared/types';
import type { WizardFile, PageRegions } from './types';
import { pageKey } from './types';

interface Props {
  campaign: Campaign;
  files: WizardFile[];
  setFiles: (updater: (prev: WizardFile[]) => WizardFile[]) => void;
  regionsByPage: Record<string, PageRegions>;
  setRegionsByPage: (
    updater: (prev: Record<string, PageRegions>) => Record<string, PageRegions>
  ) => void;
}

// Paso 2: subir imagenes/PDF (drag-drop o seleccion), revisar y seleccionar
// paginas. Por defecto todas las paginas validas quedan seleccionadas.
// La deteccion de ofertas por pagina se dispara automaticamente al cargar.
export function Step2Files({
  campaign,
  files,
  setFiles,
  regionsByPage,
  setRegionsByPage,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function importPaths(paths: string[]) {
    if (paths.length === 0) return;
    const imported = await window.fuller.importOriginalPaths(campaign.id, paths);
    // Crea la entrada del wizard por cada original importado.
    const newFiles: WizardFile[] = imported.map((o) => ({
      originalId: o.id,
      displayName: o.displayName,
      kind: o.kind,
      pageCount: o.pageCount,
      selectedPages: new Set(Array.from({ length: o.pageCount }, (_, i) => i)),
      thumbs: {},
      status: 'ready',
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    // Precarga miniaturas y dispara deteccion automatica por pagina.
    for (const f of newFiles) {
      for (let p = 0; p < f.pageCount; p++) {
        loadThumb(f.originalId, p);
        detectPage(f.originalId, p);
      }
    }
  }

  // Deteccion automatica de ofertas/spreads en una pagina (IA vision).
  async function detectPage(originalId: string, pageIndex: number) {
    const key = pageKey(originalId, pageIndex);
    setRegionsByPage((prev) => ({
      ...prev,
      [key]: { originalId, pageIndex, regions: [], status: 'detecting' },
    }));
    try {
      const regions = await window.fuller.detectRegions(originalId, pageIndex);
      setRegionsByPage((prev) => ({
        ...prev,
        [key]: { originalId, pageIndex, regions, status: 'done' },
      }));
    } catch (e) {
      setRegionsByPage((prev) => ({
        ...prev,
        [key]: {
          originalId,
          pageIndex,
          regions: [],
          status: 'error',
          error: (e as Error).message,
        },
      }));
    }
  }

  async function loadThumb(originalId: string, pageIndex: number) {
    try {
      const url = await window.fuller.pagePreview(originalId, pageIndex);
      setFiles((prev) =>
        prev.map((f) =>
          f.originalId === originalId
            ? { ...f, thumbs: { ...f.thumbs, [pageIndex]: url } }
            : f
        )
      );
    } catch {
      // Ignora fallos de miniatura puntuales.
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const paths: string[] = [];
    for (const file of Array.from(e.dataTransfer.files)) {
      try {
        const p = window.fuller.pathForFile(file);
        if (p) paths.push(p);
      } catch {
        /* ignore */
      }
    }
    importPaths(paths);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const paths: string[] = [];
    for (const file of Array.from(e.target.files ?? [])) {
      try {
        const p = window.fuller.pathForFile(file);
        if (p) paths.push(p);
      } catch {
        /* ignore */
      }
    }
    importPaths(paths);
    e.target.value = '';
  }

  function removeFile(originalId: string) {
    setFiles((prev) => prev.filter((f) => f.originalId !== originalId));
  }

  function togglePage(originalId: string, pageIndex: number) {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.originalId !== originalId) return f;
        const next = new Set(f.selectedPages);
        next.has(pageIndex) ? next.delete(pageIndex) : next.add(pageIndex);
        return { ...f, selectedPages: next };
      })
    );
    const f = files.find((x) => x.originalId === originalId);
    if (f && !f.thumbs[pageIndex]) loadThumb(originalId, pageIndex);
  }

  const totalSelected = files.reduce((n, f) => n + f.selectedPages.size, 0);

  return (
    <div className="wz-panel">
      <div className="wz-subtitle">
        Campaña: <strong>{campaign.name}</strong>
      </div>

      <div
        className={`wz-drop${dragOver ? ' wz-drop-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="wz-drop-icon" aria-hidden>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4" />
            <path d="m7 9 5-5 5 5" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </div>
        <div>Arrastra tus imagenes o PDF aqui</div>
        <button onClick={() => inputRef.current?.click()}>Seleccionar archivos</button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          style={{ display: 'none' }}
          onChange={onPick}
        />
      </div>

      {files.length === 0 ? (
        <div className="wz-hint">Agrega al menos un archivo para continuar.</div>
      ) : (
        <div className="wz-files">
          {files.map((f) => (
            <div key={f.originalId} className="wz-file">
              <div className="wz-file-head">
                <span className="wz-file-icon">{f.kind === 'pdf' ? 'PDF' : 'IMG'}</span>
                <span className="wz-file-name">{f.displayName}</span>
                {f.kind === 'pdf' && (
                  <span className="wz-muted">{f.pageCount} paginas</span>
                )}
                <span className="wz-file-status">
                  {f.status === 'error' ? (
                    <span className="wz-badge-err">Error</span>
                  ) : (
                    <span className="wz-badge-ok">✓</span>
                  )}
                </span>
                <button className="wz-x" onClick={() => removeFile(f.originalId)} title="Quitar">
                  ×
                </button>
              </div>

              {/* Resumen de deteccion de ofertas por archivo. */}
              <div className="wz-detect-summary">
                {detectSummary(f, regionsByPage)}
              </div>

              {/* Miniaturas de paginas: seleccionar las que se usaran. */}
              <div className="wz-pages">
                {Array.from({ length: f.pageCount }).map((_, i) => {
                  const sel = f.selectedPages.has(i);
                  if (!f.thumbs[i]) loadThumbOnce(f, i, loadThumb);
                  return (
                    <button
                      key={i}
                      className={`wz-page${sel ? ' wz-page-sel' : ''}`}
                      onClick={() => togglePage(f.originalId, i)}
                      title={`Pagina ${i + 1}`}
                    >
                      {f.thumbs[i] ? (
                        <img src={f.thumbs[i]} alt={`Pag ${i + 1}`} />
                      ) : (
                        <span className="wz-page-ph">…</span>
                      )}
                      <span className="wz-page-num">{i + 1}</span>
                      {sel && <span className="wz-page-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalSelected > 0 ? (
        <div className="wz-ok">
          {totalSelected} {totalSelected === 1 ? 'pagina seleccionada' : 'paginas seleccionadas'}.
        </div>
      ) : (
        files.length > 0 && (
          <div className="wz-hint">Selecciona al menos una pagina para continuar.</div>
        )
      )}
    </div>
  );
}

// Texto de resumen de deteccion por archivo.
function detectSummary(
  f: WizardFile,
  regionsByPage: Record<string, PageRegions>
): string {
  let detecting = 0;
  let total = 0;
  let errors = 0;
  for (const p of f.selectedPages) {
    const pr = regionsByPage[pageKey(f.originalId, p)];
    if (!pr || pr.status === 'detecting') detecting++;
    else if (pr.status === 'error') errors++;
    else total += pr.regions.length;
  }
  if (detecting > 0) return 'Detectando ofertas...';
  if (errors > 0) return 'No se pudo detectar en algunas paginas (puedes revisarlas manualmente).';
  if (total === 0) return 'No se detectaron ofertas; se usara la pagina completa.';
  return `${total} ${total === 1 ? 'oferta detectada' : 'ofertas detectadas'}.`;
}

// Dispara la carga de una miniatura una sola vez (evita bucles de render).
const requested = new Set<string>();
function loadThumbOnce(
  f: WizardFile,
  pageIndex: number,
  load: (id: string, p: number) => void
) {
  const key = `${f.originalId}:${pageIndex}`;
  if (requested.has(key)) return;
  requested.add(key);
  load(f.originalId, pageIndex);
}
