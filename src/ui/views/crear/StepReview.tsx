import { useEffect, useRef, useState } from 'react';
import type { OfferRegion } from '../../../shared/types';
import type { WizardFile, PageRegions } from './types';
import { pageKey } from './types';

interface Props {
  pages: { originalId: string; pageIndex: number }[];
  files: WizardFile[];
  regionsByPage: Record<string, PageRegions>;
  setRegionsByPage: (
    updater: (prev: Record<string, PageRegions>) => Record<string, PageRegions>
  ) => void;
}

// Paso de revision: muestra cada pagina seleccionada con las regiones de oferta
// detectadas superpuestas. Permite quitar, agregar (dibujando) y reencuadrar.
export function StepReview({ pages, files, regionsByPage, setRegionsByPage }: Props) {
  const [active, setActive] = useState(0);
  const page = pages[Math.min(active, pages.length - 1)];

  if (!page) {
    return <div className="wz-panel wz-hint">No hay paginas seleccionadas.</div>;
  }

  const file = files.find((f) => f.originalId === page.originalId);
  const key = pageKey(page.originalId, page.pageIndex);
  const pr = regionsByPage[key];
  const thumb = file?.thumbs[page.pageIndex] ?? null;

  function setRegions(next: OfferRegion[]) {
    setRegionsByPage((prev) => ({
      ...prev,
      [key]: {
        originalId: page.originalId,
        pageIndex: page.pageIndex,
        regions: next,
        status: 'done',
      },
    }));
  }

  const regions = pr?.regions ?? [];
  const totalAll = pages.reduce((n, pg) => {
    const r = regionsByPage[pageKey(pg.originalId, pg.pageIndex)];
    return n + (r && r.regions.length > 0 ? r.regions.length : 1);
  }, 0);

  return (
    <div className="wz-panel">
      <div className="wz-subtitle">
        Revisa las ofertas detectadas. Puedes quitar, agregar o reencuadrar cada
        recuadro antes de generar. <strong>{totalAll}</strong> piezas en total.
      </div>

      {/* Navegacion entre paginas seleccionadas */}
      {pages.length > 1 && (
        <div className="wz-review-pager">
          <button onClick={() => setActive((a) => Math.max(0, a - 1))} disabled={active === 0}>
            ← Pagina anterior
          </button>
          <span className="wz-muted">
            Pagina {active + 1} de {pages.length}
            {file ? ` · ${file.displayName}` : ''}
          </span>
          <button
            onClick={() => setActive((a) => Math.min(pages.length - 1, a + 1))}
            disabled={active >= pages.length - 1}
          >
            Siguiente pagina →
          </button>
        </div>
      )}

      {pr?.status === 'detecting' ? (
        <div className="wz-hint">Detectando ofertas en esta pagina...</div>
      ) : (
        <RegionEditor
          imageUrl={thumb}
          regions={regions}
          onChange={setRegions}
          detectError={pr?.status === 'error' ? pr.error : undefined}
        />
      )}
    </div>
  );
}

// Editor visual de regiones sobre la imagen de la pagina.
function RegionEditor({
  imageUrl,
  regions,
  onChange,
  detectError,
}: {
  imageUrl: string | null;
  regions: OfferRegion[];
  onChange: (r: OfferRegion[]) => void;
  detectError?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<OfferRegion | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // Dibuja una nueva region arrastrando sobre la imagen.
  function toNorm(e: React.MouseEvent): { x: number; y: number } {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function onDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.wz-region-del')) return;
    const p = toNorm(e);
    dragStart.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onMove(e: React.MouseEvent) {
    if (!dragStart.current) return;
    const p = toNorm(e);
    const s = dragStart.current;
    setDraft({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  }
  function onUp() {
    if (draft && draft.w > 0.03 && draft.h > 0.03) {
      onChange([...regions, { ...draft, label: `oferta ${regions.length + 1}` }]);
    }
    setDraft(null);
    dragStart.current = null;
  }

  function remove(i: number) {
    onChange(regions.filter((_, idx) => idx !== i));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDraft(null);
        dragStart.current = null;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div>
      {detectError && (
        <div className="wz-note" style={{ marginBottom: 12 }}>
          No se pudo detectar automaticamente en esta pagina ({detectError}).
          Dibuja los recuadros manualmente.
        </div>
      )}
      <div className="wz-review-hint wz-muted">
        Arrastra sobre la imagen para agregar un recuadro. Pulsa la × de un
        recuadro para quitarlo.
      </div>
      <div
        className="wz-review-stage"
        ref={stageRef}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="pagina" draggable={false} />
        ) : (
          <div className="wz-muted" style={{ padding: 40 }}>
            Cargando pagina...
          </div>
        )}

        {regions.map((r, i) => (
          <div
            key={i}
            className="wz-region"
            style={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
            }}
          >
            <span className="wz-region-tag">{i + 1}</span>
            <button
              className="wz-region-del"
              title="Quitar"
              onClick={(e) => {
                e.stopPropagation();
                remove(i);
              }}
            >
              ×
            </button>
          </div>
        ))}

        {draft && (
          <div
            className="wz-region wz-region-draft"
            style={{
              left: `${draft.x * 100}%`,
              top: `${draft.y * 100}%`,
              width: `${draft.w * 100}%`,
              height: `${draft.h * 100}%`,
            }}
          />
        )}
      </div>

      <div className="wz-row" style={{ marginTop: 12 }}>
        <span className="wz-muted">
          {regions.length === 0
            ? 'Sin recuadros: se usara la pagina completa (1 pieza).'
            : `${regions.length} ${regions.length === 1 ? 'oferta' : 'ofertas'} en esta pagina.`}
        </span>
        {regions.length > 0 && (
          <button onClick={() => onChange([])}>Quitar todos</button>
        )}
      </div>
    </div>
  );
}
