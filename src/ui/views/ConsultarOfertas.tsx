import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  LibraryYearNode,
  LibraryImage,
} from '../../shared/types';
import logoUrl from '../assets/fuller-logo.png';
import { RenameDialog, MoveDialog, DeleteDialog, FullscreenViewer, ExportDialog } from './LibraryDialogs';

interface Props {
  onHome: () => void;
}

// Pantalla "Consultar ofertas": navegacion tipo Explorador.
// Panel izquierdo: arbol anios/campanas/archivos. Panel derecho: vista previa.
export function ConsultarOfertas({ onHome }: Props) {
  const [tree, setTree] = useState<LibraryYearNode[]>([]);
  const [logoOk, setLogoOk] = useState(true);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedCamps, setExpandedCamps] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<LibraryImage | null>(null);

  // Dialogos / menus.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<LibraryImage | null>(null);
  const [moveTarget, setMoveTarget] = useState<LibraryImage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LibraryImage | null>(null);
  const [exportTarget, setExportTarget] = useState<LibraryImage | null>(null);
  const [fullscreen, setFullscreen] = useState<LibraryImage | null>(null);

  async function reload() {
    const t = await window.fuller.libraryTree();
    setTree(t);
    return t;
  }

  useEffect(() => {
    (async () => {
      const t = await reload();
      // Expandir el primer anio por defecto para que no se vea vacio.
      if (t.length > 0) {
        setExpandedYears(new Set([yearKey(t[0])]));
      }
    })();
  }, []);

  // Si el archivo seleccionado desaparece del arbol (p. ej. eliminado), limpiar.
  useEffect(() => {
    if (!selected) return;
    const stillThere = tree.some((y) =>
      y.campaigns.some((c) => c.images.some((i) => i.id === selected.id))
    );
    if (!stillThere) setSelected(null);
  }, [tree, selected]);

  // Cierra el menu de 3 puntos al presionar Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuFor(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function yearKey(y: LibraryYearNode): string {
    return y.year == null ? 'none' : String(y.year);
  }

  function toggleYear(y: LibraryYearNode) {
    const k = yearKey(y);
    setExpandedYears((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  function toggleCamp(campaignId: string) {
    setExpandedCamps((prev) => {
      const next = new Set(prev);
      next.has(campaignId) ? next.delete(campaignId) : next.add(campaignId);
      return next;
    });
  }

  // Ruta mostrada en la vista previa, ej "CY 26 / C02".
  const selectedPath = useMemo(() => {
    if (!selected) return '';
    for (const y of tree) {
      for (const c of y.campaigns) {
        if (c.images.some((i) => i.id === selected.id)) {
          return `${y.label} / ${c.label}`;
        }
      }
    }
    return '';
  }, [selected, tree]);

  // Campanas disponibles como destino de "Mover".
  const allCampaigns = useMemo(
    () =>
      tree.flatMap((y) =>
        y.campaigns.map((c) => ({
          campaignId: c.campaignId,
          label: `${y.label} / ${c.label}`,
          yearLabel: y.label,
          campLabel: c.label,
        }))
      ),
    [tree]
  );

  async function refreshKeepSelection() {
    const t = await reload();
    if (selected) {
      // Reapunta la seleccion al mismo id (por si cambio nombre/ubicacion).
      for (const y of t) {
        for (const c of y.campaigns) {
          const found = c.images.find((i) => i.id === selected.id);
          if (found) {
            setSelected(found);
            return;
          }
        }
      }
    }
  }

  return (
    <div className="lib">
      <header className="lib-header">
        <div className="lib-header-left">
          {logoOk ? (
            <img className="lib-logo" src={logoUrl} alt="Fuller" onError={() => setLogoOk(false)} />
          ) : (
            <span className="fh-logo-fallback">fuller</span>
          )}
          <button className="lib-back" onClick={onHome}>
            ← Inicio
          </button>
        </div>
        <div className="lib-header-center">
          <span className="lib-crumb-title">Consultar ofertas</span>
        </div>
        <div className="lib-header-right" />
      </header>

      <main className="lib-body">
        {/* Panel izquierdo: arbol */}
        <section className="lib-tree">
          {tree.length === 0 ? (
            <div className="muted" style={{ padding: 16 }}>
              Aún no hay campañas. Crea una desde el inicio.
            </div>
          ) : (
            tree.map((y) => {
              const yk = yearKey(y);
              const yOpen = expandedYears.has(yk);
              const yearEmpty = y.campaigns.length === 0;
              return (
                <div key={yk}>
                  <TreeRow
                    level={0}
                    open={yOpen}
                    hasChildren={y.campaigns.length > 0}
                    icon="folder"
                    label={y.label}
                    onToggle={() => toggleYear(y)}
                    onClick={() => toggleYear(y)}
                    canDelete={yearEmpty && y.year != null}
                    onDelete={async () => {
                      if (y.year == null) return;
                      if (!confirm(`¿Eliminar el año ${y.label}? (está vacío)`)) return;
                      try {
                        await window.fuller.libraryDeleteYear(y.year);
                        await reload();
                      } catch (e) {
                        alert((e as Error).message);
                      }
                    }}
                  />
                  {yOpen &&
                    y.campaigns.map((c) => {
                      const cOpen = expandedCamps.has(c.campaignId);
                      const campEmpty = c.images.length === 0;
                      return (
                        <div key={c.campaignId}>
                          <TreeRow
                            level={1}
                            open={cOpen}
                            hasChildren={c.images.length > 0}
                            icon="folder"
                            label={c.label}
                            onToggle={() => toggleCamp(c.campaignId)}
                            onClick={() => toggleCamp(c.campaignId)}
                            canDelete={campEmpty}
                            onDelete={async () => {
                              if (!confirm(`¿Eliminar la campaña ${c.label}? (está vacía)`)) return;
                              try {
                                await window.fuller.libraryDeleteCampaign(c.campaignId);
                                await reload();
                              } catch (e) {
                                alert((e as Error).message);
                              }
                            }}
                          />
                          {cOpen &&
                            (c.images.length === 0 ? (
                              <div className="lib-empty-camp">
                                Esta campaña todavía no tiene imágenes
                              </div>
                            ) : (
                              c.images.map((img) => (
                                <FileRow
                                  key={img.id}
                                  image={img}
                                  selected={selected?.id === img.id}
                                  menuOpen={menuFor === img.id}
                                  onSelect={() => setSelected(img)}
                                  onMenuToggle={() =>
                                    setMenuFor((m) => (m === img.id ? null : img.id))
                                  }
                                  onRename={() => {
                                    setMenuFor(null);
                                    setRenameTarget(img);
                                  }}
                                  onMove={() => {
                                    setMenuFor(null);
                                    setMoveTarget(img);
                                  }}
                                  onDelete={() => {
                                    setMenuFor(null);
                                    setDeleteTarget(img);
                                  }}
                                />
                              ))
                            ))}
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
        </section>

        {/* Panel derecho: vista previa */}
        <section className="lib-preview">
          {!selected ? (
            <div className="lib-preview-empty">
              <div className="lib-preview-empty-icon" aria-hidden>
                <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="8.5" cy="9.5" r="1.6" />
                  <path d="m21 16-4.5-4.5L7 21" />
                </svg>
              </div>
              <div className="lib-preview-empty-title">Selecciona un archivo</div>
              <div className="lib-preview-empty-desc">
                Aqui veras la imagen de tu oferta.
              </div>
            </div>
          ) : (
            <div className="lib-preview-inner">
              <div className="lib-preview-path">
                <span className="muted">{selectedPath}</span>
                <span className="lib-sep">/</span>
                <strong>
                  {selected.name}
                  {selected.ext}
                </strong>
              </div>

              <div className="lib-preview-image">
                <PreviewImage image={selected} />
              </div>

              <div className="lib-preview-actions">
                <button onClick={() => setFullscreen(selected)}>
                  Ver en pantalla completa
                </button>
                <button className="primary" onClick={() => setExportTarget(selected)}>
                  Exportar
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Dialogos */}
      {renameTarget && (
        <RenameDialog
          image={renameTarget}
          onClose={() => setRenameTarget(null)}
          onDone={async () => {
            setRenameTarget(null);
            await refreshKeepSelection();
          }}
        />
      )}
      {moveTarget && (
        <MoveDialog
          image={moveTarget}
          campaigns={allCampaigns}
          currentPath={pathOf(moveTarget, tree)}
          onClose={() => setMoveTarget(null)}
          onDone={async () => {
            setMoveTarget(null);
            await refreshKeepSelection();
          }}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          image={deleteTarget}
          path={pathOf(deleteTarget, tree)}
          onClose={() => setDeleteTarget(null)}
          onDone={async () => {
            const wasSelected = selected?.id === deleteTarget.id;
            setDeleteTarget(null);
            if (wasSelected) setSelected(null);
            await reload();
          }}
        />
      )}
      {exportTarget && (
        <ExportDialog image={exportTarget} onClose={() => setExportTarget(null)} />
      )}
      {fullscreen && (
        <FullscreenViewer image={fullscreen} onClose={() => setFullscreen(null)} />
      )}
    </div>
  );
}

function pathOf(img: LibraryImage, tree: LibraryYearNode[]): string {
  for (const y of tree) {
    for (const c of y.campaigns) {
      if (c.images.some((i) => i.id === img.id)) return `${y.label} / ${c.label}`;
    }
  }
  return '';
}

// Fila generica del arbol (anio o campana).
function TreeRow(props: {
  level: number;
  open: boolean;
  hasChildren: boolean;
  icon: 'folder';
  label: string;
  onToggle: () => void;
  onClick: () => void;
  /** Mostrar boton eliminar (solo si el nodo esta vacio). */
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div
      className="lib-row lib-row-folder"
      style={{ paddingLeft: 12 + props.level * 20 }}
      onClick={props.onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onClick();
        }
      }}
    >
      <span className="lib-caret" aria-hidden>
        {props.hasChildren ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: props.open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        ) : (
          <span style={{ width: 14, display: 'inline-block' }} />
        )}
      </span>
      <span className="lib-folder-icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      </span>
      <span className="lib-label">{props.label}</span>
      {props.canDelete && props.onDelete && (
        <button
          className="lib-row-del"
          title="Eliminar (vacio)"
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete!();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Fila de archivo con su menu de tres puntos.
function FileRow(props: {
  image: LibraryImage;
  selected: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onMenuToggle: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Cierra el menu al hacer click fuera.
  useEffect(() => {
    if (!props.menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        props.onMenuToggle();
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [props.menuOpen]);

  return (
    <div
      className={`lib-row lib-row-file${props.selected ? ' lib-row-selected' : ''}`}
      style={{ paddingLeft: 12 + 2 * 20 }}
      onClick={props.onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onSelect();
        }
      }}
    >
      <span className="lib-file-icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <circle cx="9.5" cy="13" r="1.3" />
          <path d="m13 17-2.5-2.5L7 18" />
        </svg>
      </span>
      <span className="lib-label">
        {props.image.name}
        {props.image.ext}
      </span>

      <div className="lib-menu-wrap" ref={menuRef}>
        <button
          className="lib-dots"
          title="Mas opciones"
          onClick={(e) => {
            e.stopPropagation(); // No cambia la seleccion ni abre la imagen.
            props.onMenuToggle();
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
        {props.menuOpen && (
          <div className="lib-menu" onClick={(e) => e.stopPropagation()}>
            <button onClick={props.onRename}>Cambiar nombre</button>
            <button onClick={props.onMove}>Mover</button>
            <button className="lib-menu-danger" onClick={props.onDelete}>
              Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Imagen de vista previa con manejo de error de carga.
function PreviewImage({ image }: { image: LibraryImage }) {
  const [error, setError] = useState(false);
  // Resetea el error al cambiar de imagen.
  useEffect(() => setError(false), [image.id]);

  if (!image.imageUrl || error) {
    return (
      <div className="lib-img-error">
        No se pudo cargar la imagen de este archivo.
      </div>
    );
  }
  return (
    <img
      src={image.imageUrl}
      alt={image.name}
      className="lib-img"
      onError={() => setError(true)}
    />
  );
}
