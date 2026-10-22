import { useEffect, useState } from 'react';
import type { LibraryImage } from '../../shared/types';

// Base de ventana modal reutilizable.
function Modal({
  title,
  onClose,
  children,
  width = 440,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lib-modal-overlay" onClick={onClose}>
      <div
        className="lib-modal"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lib-modal-head">
          <h3>{title}</h3>
          <button className="lib-modal-x" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// --- Cambiar nombre ---
export function RenameDialog({
  image,
  onClose,
  onDone,
}: {
  image: LibraryImage;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(image.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Validacion en vivo (vacio, invalido, duplicado) en el main process.
      const check = await window.fuller.libraryCheckName({
        campaignId: image.campaignId,
        name,
        exceptId: image.id,
      });
      if (!check.ok) {
        setError(check.error);
        setBusy(false);
        return;
      }
      await window.fuller.libraryRename({ id: image.id, name: name.trim() });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Cambiar nombre" onClose={onClose}>
      <label className="lib-field-label">Nombre del archivo</label>
      <div className="lib-name-row">
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <span className="lib-ext">{image.ext}</span>
      </div>
      {error && <div className="lib-error">{error}</div>}
      <div className="lib-modal-actions">
        <button onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button className="primary" onClick={save} disabled={busy}>
          {busy ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
}

// --- Mover archivo ---
interface CampaignOption {
  campaignId: string;
  label: string;
}
export function MoveDialog({
  image,
  campaigns,
  currentPath,
  onClose,
  onDone,
}: {
  image: LibraryImage;
  campaigns: CampaignOption[];
  currentPath: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const targetLabel = campaigns.find((c) => c.campaignId === target)?.label ?? '—';

  async function move() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await window.fuller.libraryMove({ id: image.id, targetCampaignId: target });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Mover archivo" onClose={onClose} width={480}>
      <div className="lib-field-label">
        {image.name}
        {image.ext}
      </div>
      <div className="muted" style={{ marginBottom: 12 }}>
        Ubicacion actual: {currentPath}
      </div>

      <div className="lib-move-tree">
        {campaigns.map((c) => {
          const isCurrent = c.campaignId === image.campaignId;
          const isSel = target === c.campaignId;
          return (
            <button
              key={c.campaignId}
              className={`lib-move-opt${isSel ? ' lib-move-opt-sel' : ''}`}
              disabled={isCurrent}
              onClick={() => setTarget(c.campaignId)}
            >
              <span className="lib-folder-icon" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </span>
              {c.label}
              {isCurrent && <span className="muted"> (actual)</span>}
            </button>
          );
        })}
      </div>

      <div className="muted" style={{ marginTop: 12 }}>
        Destino: {targetLabel}
      </div>
      {error && <div className="lib-error">{error}</div>}

      <div className="lib-modal-actions">
        <button onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button className="primary" onClick={move} disabled={busy || !target}>
          {busy ? 'Moviendo...' : 'Mover aqui'}
        </button>
      </div>
    </Modal>
  );
}

// --- Eliminar ---
export function DeleteDialog({
  image,
  path,
  onClose,
  onDone,
}: {
  image: LibraryImage;
  path: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await window.fuller.libraryDelete(image.id);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="" onClose={onClose}>
      <div className="lib-delete">
        <div className="lib-delete-icon" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </div>
        <h3 className="lib-delete-title">¿Eliminar este archivo?</h3>
        <div className="lib-delete-name">
          {image.name}
          {image.ext}
        </div>
        <div className="muted">{path}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Se eliminara de la biblioteca de la aplicacion.
        </div>
        {error && <div className="lib-error">{error}</div>}
        <div className="lib-modal-actions" style={{ justifyContent: 'center' }}>
          <button onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="lib-btn-danger" onClick={remove} disabled={busy}>
            {busy ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// --- Exportar ---
export function ExportDialog({
  image,
  onClose,
}: {
  image: LibraryImage;
  onClose: () => void;
}) {
  const [name, setName] = useState(image.name);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doExport() {
    const clean = name.trim();
    if (!clean) {
      setError('Escribe un nombre para continuar.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await window.fuller.libraryExport({ id: image.id, name: clean });
      if (res.ok && res.path) {
        setMsg('Imagen exportada correctamente.');
        setTimeout(onClose, 1200);
      } else if (res.error) {
        setError(res.error);
        setBusy(false);
      } else {
        // Cancelado en el dialogo de guardado del sistema.
        setBusy(false);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Exportar imagen" onClose={onClose}>
      {image.imageUrl && (
        <div className="lib-export-preview">
          <img src={image.imageUrl} alt={image.name} />
        </div>
      )}
      <label className="lib-field-label">Nombre del archivo</label>
      <div className="lib-name-row">
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <span className="lib-ext">{image.ext}</span>
      </div>
      {error && <div className="lib-error">{error}</div>}
      {msg && <div className="lib-success">{msg}</div>}
      <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
        Al continuar eliges la carpeta del equipo donde se guardara la copia.
      </div>
      <div className="lib-modal-actions">
        <button onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button className="primary" onClick={doExport} disabled={busy || !name.trim()}>
          {busy ? 'Exportando...' : 'Exportar'}
        </button>
      </div>
    </Modal>
  );
}

// --- Visor pantalla completa ---
export function FullscreenViewer({
  image,
  onClose,
}: {
  image: LibraryImage;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lib-fs">
      <div className="lib-fs-bar">
        <span className="lib-fs-name">
          {image.name}
          {image.ext}
        </span>
        <button className="lib-fs-close" onClick={onClose}>
          × Cerrar
        </button>
      </div>
      <div className="lib-fs-stage">
        {image.imageUrl ? (
          <img src={image.imageUrl} alt={image.name} />
        ) : (
          <div className="lib-img-error">No se pudo cargar la imagen.</div>
        )}
      </div>
      <div className="lib-fs-hint">Esc para salir</div>
    </div>
  );
}
