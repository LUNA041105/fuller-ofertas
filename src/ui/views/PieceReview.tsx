import { useEffect, useState } from 'react';
import type { Piece, PieceVersion } from '../../shared/types';

interface Props {
  piece: Piece;
  onBack: () => void;
}

// Dialogo de nombre OBLIGATORIO al guardar una pieza en la biblioteca.
// Asocia la imagen a la campana actual (contexto) para que aparezca en
// "Consultar ofertas". No crea el registro si el usuario cancela o falla.
function SaveToLibraryDialog({
  version,
  campaignId,
  onClose,
  onSaved,
}: {
  version: PieceVersion;
  campaignId: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const clean = name.trim();
    if (!clean) {
      setError('Escribe un nombre para continuar.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const check = await window.fuller.libraryCheckName({ campaignId, name: clean });
      if (!check.ok) {
        setError(check.error);
        setBusy(false);
        return;
      }
      await window.fuller.librarySave({ versionId: version.id, campaignId, name: clean });
      onSaved(clean);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="lib-modal-overlay" onClick={onClose}>
      <div className="lib-modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="lib-modal-head">
          <h3>Guardar en la biblioteca</h3>
          <button className="lib-modal-x" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {version.imageUrl && (
          <div className="lib-export-preview">
            <img src={version.imageUrl} alt="pieza" />
          </div>
        )}
        <label className="lib-field-label">Nombre del archivo</label>
        <div className="lib-name-row">
          <input
            autoFocus
            value={name}
            placeholder="Ej: Ofertas de belleza"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <span className="lib-ext">.png</span>
        </div>
        {error && <div className="lib-error">{error}</div>}
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Quedará disponible en "Consultar ofertas", dentro de esta campaña.
        </div>
        <div className="lib-modal-actions">
          <button onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Revision de una pieza (Etapa 4):
// - Lista de versiones (se conservan todas).
// - Comparacion lado a lado de dos versiones.
// - "Volver a generar" con recuadro de comentario -> IA ajusta la composicion.
// - Marcar la version definitiva.
// - Copiar / exportar la version activa (Etapa 5).
export function PieceReview({ piece, onBack }: Props) {
  const [versions, setVersions] = useState<PieceVersion[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);

  async function refresh() {
    const list = await window.fuller.listVersions(piece.id);
    setVersions(list);
    if (!activeId && list.length > 0) setActiveId(list[list.length - 1].id);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id]);

  const active = versions.find((v) => v.id === activeId) ?? null;
  const compare = versions.find((v) => v.id === compareId) ?? null;

  async function generateFirst() {
    setBusy(true);
    setError(null);
    try {
      const v = await window.fuller.generatePiece(piece.id);
      await refresh();
      setActiveId(v.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const v = await window.fuller.regeneratePiece(piece.id, comment.trim());
      await refresh();
      // La version anterior queda como comparacion automatica.
      setCompareId(activeId);
      setActiveId(v.id);
      setComment('');
      setShowComment(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markFinal() {
    if (!active) return;
    await window.fuller.setFinalVersion(active.id);
    await refresh();
  }

  function copyToClipboard() {
    if (!active?.imagePath) return;
    const ok = window.fuller.copyImageToClipboard(active.imagePath);
    setCopyMsg(ok ? 'Imagen copiada al portapapeles.' : 'No se pudo copiar.');
    setTimeout(() => setCopyMsg(null), 2500);
  }

  async function exportOne() {
    if (!active) return;
    const dest = await window.fuller.exportSingle(active.id);
    if (dest) setCopyMsg(`Exportada a: ${dest}`);
    setTimeout(() => setCopyMsg(null), 3500);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ marginBottom: 14 }}>
        <button onClick={onBack}>← Volver a piezas</button>
        <strong>
          Pieza {piece.pieceCode} · {piece.format}
        </strong>
      </div>

      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
        {/* Lista de versiones */}
        <div style={{ width: 210, flexShrink: 0, overflow: 'auto' }}>
          <div style={{ marginBottom: 10 }}>
            {versions.length === 0 ? (
              <button className="primary" onClick={generateFirst} disabled={busy}>
                {busy ? 'Generando...' : 'Generar pieza'}
              </button>
            ) : (
              <button
                className="primary"
                onClick={() => setShowComment((s) => !s)}
                disabled={busy}
              >
                Volver a generar
              </button>
            )}
          </div>

          {showComment && (
            <div className="card" style={{ padding: 10, marginBottom: 10, cursor: 'default' }}>
              <label className="muted">Indicacion para la IA</label>
              <textarea
                autoFocus
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ej: haz mas grande el precio, mas margen, etiqueta arriba a la derecha"
                style={{ width: '100%', marginTop: 6, resize: 'vertical' }}
              />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="primary" onClick={regenerate} disabled={busy}>
                  {busy ? 'Procesando...' : 'Aplicar'}
                </button>
                <button onClick={() => setShowComment(false)} disabled={busy}>
                  Cancelar
                </button>
              </div>
              <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
                Requiere internet y clave de OpenAI. Respeta el arte original.
                Ajusta encuadre, margenes, escala general y la etiqueta. Aun no
                modifica regiones aisladas (p. ej. solo el precio) de forma
                independiente.
              </div>
            </div>
          )}

          {versions.map((v) => (
            <div
              key={v.id}
              className="card"
              style={{
                padding: 8,
                marginBottom: 6,
                borderColor: activeId === v.id ? 'var(--accent)' : undefined,
              }}
              onClick={() => setActiveId(v.id)}
            >
              <div style={{ fontWeight: 600 }}>
                Version {v.versionNumber} {v.isFinal && '★'}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {v.status === 'done' ? 'Lista' : v.status === 'error' ? 'Error' : 'Pendiente'}
              </div>
              {v.instruction && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                  “{v.instruction}”
                </div>
              )}
              <button
                style={{ marginTop: 6, fontSize: 11, padding: '4px 8px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCompareId(compareId === v.id ? null : v.id);
                }}
              >
                {compareId === v.id ? 'Quitar comparacion' : 'Comparar'}
              </button>
            </div>
          ))}
        </div>

        {/* Vista principal (con comparacion opcional) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {error && (
            <div
              style={{
                background: '#fdecea',
                border: '1px solid #f5b7b1',
                borderRadius: 8,
                padding: 10,
                marginBottom: 10,
                color: '#c0392b',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {!active ? (
            <div className="empty">Genera la pieza para verla aqui.</div>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
                <button className="primary" onClick={markFinal} disabled={active.isFinal}>
                  {active.isFinal ? '★ Es la definitiva' : 'Marcar como definitiva'}
                </button>
                <button
                  onClick={() => setShowSave(true)}
                  disabled={!active.imagePath || active.status !== 'done'}
                >
                  Guardar en biblioteca
                </button>
                <button onClick={copyToClipboard} disabled={!active.imagePath}>
                  Copiar al portapapeles
                </button>
                <button onClick={exportOne} disabled={!active.imagePath}>
                  Exportar imagen
                </button>
                {copyMsg && <span className="muted">{copyMsg}</span>}
              </div>

              {active.warnings.length > 0 && (
                <div
                  style={{
                    background: '#fff4e5',
                    border: '1px solid #ffd9a0',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                    fontSize: 13,
                  }}
                >
                  {active.warnings.map((w, i) => (
                    <div key={i}>⚠ {w}</div>
                  ))}
                </div>
              )}

              <div style={{ flex: 1, display: 'flex', gap: 14, minHeight: 0 }}>
                <VersionImage title={`Version ${active.versionNumber}`} v={active} />
                {compare && compare.id !== active.id && (
                  <VersionImage title={`Version ${compare.versionNumber}`} v={compare} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showSave && active && (
        <SaveToLibraryDialog
          version={active}
          campaignId={piece.campaignId}
          onClose={() => setShowSave(false)}
          onSaved={() => {
            setShowSave(false);
            setCopyMsg('Guardada en la biblioteca.');
            setTimeout(() => setCopyMsg(null), 2500);
          }}
        />
      )}
    </div>
  );
}

function VersionImage({ title, v }: { title: string; v: PieceVersion }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="muted" style={{ marginBottom: 6 }}>
        {title}
      </div>
      <div
        style={{
          flex: 1,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {v.status === 'error' ? (
          <span style={{ color: '#c0392b' }}>Error: {v.errorMessage}</span>
        ) : v.imageUrl ? (
          <img
            src={v.imageUrl}
            alt={title}
            style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
          />
        ) : (
          <span className="muted">Sin imagen</span>
        )}
      </div>
    </div>
  );
}
