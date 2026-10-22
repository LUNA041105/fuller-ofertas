import { useEffect, useState } from 'react';
import type { AspectFormat, Campaign } from '../../../shared/types';
import type { WizardResult } from './types';

interface Props {
  campaign: Campaign;
  format: AspectFormat;
  results: WizardResult[];
  setResults: (updater: (prev: WizardResult[]) => WizardResult[]) => void;
}

// Paso 4: galeria de resultados con nombre editable, regenerar, descargar,
// vista ampliada, descargar todas (zip) y guardar en la app.
export function Step4Results({ campaign, format, results, setResults }: Props) {
  const [enlarge, setEnlarge] = useState<WizardResult | null>(null);
  const [regenFor, setRegenFor] = useState<WizardResult | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const doneCount = results.filter((r) => r.status === 'done').length;
  const pending = results.some(
    (r) => r.status !== 'done' && r.status !== 'error'
  );
  const anyError = results.some((r) => r.status === 'error');

  function setName(pieceId: string, name: string) {
    setResults((prev) =>
      prev.map((r) => (r.pieceId === pieceId ? { ...r, name } : r))
    );
  }

  async function downloadOne(r: WizardResult) {
    if (!r.versionId) return;
    const clean = r.name.trim();
    if (!clean) {
      setMsg('Asigna un nombre a esa imagen antes de descargar.');
      return;
    }
    const res = await window.fuller.exportVersionSingle({
      versionId: r.versionId,
      name: clean,
    });
    if (res.ok && res.path) flash('Imagen descargada.');
    else if (res.error) flash(res.error);
  }

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 3500);
  }

  // --- Descargar todas (zip) ---
  async function downloadAllZip() {
    if (pending || anyError) {
      flash('Resuelve las piezas pendientes o fallidas antes de descargar todas.');
      return;
    }
    const missing = results.filter((r) => r.status === 'done' && !r.name.trim());
    if (missing.length > 0) {
      // Aviso claro y bloqueante: no se descarga el ZIP sin nombres.
      alert(
        'Necesitas ponerle un nombre a las imagenes para descargar el ZIP.\n\n' +
          `Faltan ${missing.length} ${missing.length === 1 ? 'nombre' : 'nombres'}. ` +
          'Escribelos en el campo "Nombre" de cada tarjeta.'
      );
      return;
    }
    const items = results
      .filter((r) => r.versionId)
      .map((r) => ({ versionId: r.versionId as string, name: r.name.trim() }));
    const res = await window.fuller.exportZipVersions({
      items,
      zipName: `${campaign.slug}_Ofertas`,
    });
    if (res.ok && res.path) flash('ZIP descargado.');
    else if (res.error) flash(res.error);
  }

  return (
    <div className="wz-panel">
      <div className="wz-results-head">
        <div>
          <span className="wz-results-eyebrow">04 · Revisar resultados</span>
          <div className="wz-muted">
            {campaign.name} · Formato {format} ·{' '}
            {doneCount} {doneCount === 1 ? 'imagen generada' : 'imagenes generadas'}
          </div>
        </div>
      </div>

      {msg && <div className="wz-toast">{msg}</div>}

      <div className="wz-gallery">
        {results.map((r) => (
          <ResultCard
            key={r.pieceId}
            result={r}
            onEnlarge={() => r.imageUrl && setEnlarge(r)}
            onRegen={() => setRegenFor(r)}
            onDownload={() => downloadOne(r)}
            onNameChange={(n) => setName(r.pieceId, n)}
          />
        ))}
      </div>

      <div className="wz-results-actions">
        <button
          onClick={downloadAllZip}
          disabled={doneCount === 0}
          className="wz-btn-outline-red"
        >
          Descargar todas (.zip)
        </button>
        <button
          className="primary"
          onClick={() => setShowSave(true)}
          disabled={doneCount === 0}
        >
          Guardar en la app
        </button>
      </div>

      {(pending || anyError) && (
        <div className="wz-hint">
          Hay piezas pendientes o con error. Resuelvelas para descargar/guardar todo.
        </div>
      )}

      {enlarge && enlarge.imageUrl && (
        <EnlargeViewer result={enlarge} onClose={() => setEnlarge(null)} />
      )}
      {regenFor && (
        <RegenDialog
          result={regenFor}
          format={format}
          onClose={() => setRegenFor(null)}
          onApplied={(updated) => {
            setResults((prev) =>
              prev.map((r) => (r.pieceId === updated.pieceId ? updated : r))
            );
            setRegenFor(null);
          }}
        />
      )}
      {showSave && (
        <SaveDialog
          campaign={campaign}
          results={results.filter((r) => r.status === 'done' && r.versionId)}
          onClose={() => setShowSave(false)}
          onNameChange={setName}
          onSaved={() => {
            setShowSave(false);
            flash('Imagenes guardadas en la biblioteca.');
          }}
        />
      )}
    </div>
  );
}

// Tarjeta de un resultado.
function ResultCard({
  result,
  onEnlarge,
  onRegen,
  onDownload,
  onNameChange,
}: {
  result: WizardResult;
  onEnlarge: () => void;
  onRegen: () => void;
  onDownload: () => void;
  onNameChange: (name: string) => void;
}) {
  const r = result;
  return (
    <div className="wz-card">
      <div className="wz-card-img" onClick={onEnlarge}>
        {r.status === 'generating' || r.status === 'pending' ? (
          <div className="wz-card-state">Generando…</div>
        ) : r.status === 'regenerating' ? (
          <div className="wz-card-state">Regenerando…</div>
        ) : r.status === 'error' ? (
          <div className="wz-card-state wz-card-err">Error: {r.error}</div>
        ) : r.imageUrl ? (
          <img src={r.imageUrl} alt={r.name || 'resultado'} />
        ) : (
          <div className="wz-card-state">Sin imagen</div>
        )}
      </div>
      <label className="wz-label">Nombre</label>
      <input
        value={r.name}
        placeholder="Escribe un nombre"
        onChange={(e) => onNameChange(e.target.value)}
      />
      <div className="wz-card-actions">
        <button onClick={onRegen} disabled={r.status !== 'done'}>
          Regenerar
        </button>
        <button onClick={onDownload} disabled={r.status !== 'done'}>
          Descargar
        </button>
      </div>
    </div>
  );
}

// Vista ampliada.
function EnlargeViewer({
  result,
  onClose,
}: {
  result: WizardResult;
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
        <span className="lib-fs-name">{result.name || 'Imagen'}</span>
        <button className="lib-fs-close" onClick={onClose}>
          × Cerrar
        </button>
      </div>
      <div className="lib-fs-stage">
        {result.imageUrl && <img src={result.imageUrl} alt={result.name} />}
      </div>
      <div className="lib-fs-hint">Esc para salir</div>
    </div>
  );
}

// Regenerar una sola imagen (comentario obligatorio).
function RegenDialog({
  result,
  format,
  onClose,
  onApplied,
}: {
  result: WizardResult;
  format: AspectFormat;
  onClose: () => void;
  onApplied: (updated: WizardResult) => void;
}) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regen() {
    const clean = comment.trim();
    if (!clean) {
      setError('Escribe que quieres cambiar para regenerar.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Solo esta pieza. Conserva la version anterior como previousVersionId.
      const v = await window.fuller.regeneratePiece(result.pieceId, clean);
      if (v.status === 'error') {
        setError(v.errorMessage || 'No se pudo regenerar.');
        setBusy(false);
        return;
      }
      onApplied({
        ...result,
        previousVersionId: result.versionId,
        versionId: v.id,
        imageUrl: v.imageUrl,
        warnings: v.warnings,
        status: 'done',
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="lib-modal-overlay" onClick={onClose}>
      <div className="lib-modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="lib-modal-head">
          <h3>Regenerar imagen</h3>
          <button className="lib-modal-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="wz-regen-body">
          {result.imageUrl && (
            <div className="wz-regen-preview">
              <img src={result.imageUrl} alt={result.name} />
            </div>
          )}
          <div className="wz-regen-form">
            <label className="wz-label">¿Que quieres cambiar?</label>
            <textarea
              autoFocus
              rows={4}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setError(null);
              }}
              placeholder="El precio se ve muy pequeno. Hazlo mas grande y conserva los productos."
            />
            <div className="wz-muted" style={{ marginTop: 6, fontSize: 12 }}>
              Solo se regenerara esta imagen ({format}). Las demas se conservan.
            </div>
            {error && <div className="lib-error">{error}</div>}
          </div>
        </div>
        <div className="lib-modal-actions">
          <button onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="primary" onClick={regen} disabled={busy || !comment.trim()}>
            {busy ? 'Regenerando...' : 'Regenerar esta imagen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Guardar en la app: valida nombres y guarda en la biblioteca.
function SaveDialog({
  campaign,
  results,
  onClose,
  onNameChange,
  onSaved,
}: {
  campaign: Campaign;
  results: WizardResult[];
  onClose: () => void;
  onNameChange: (pieceId: string, name: string) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perError, setPerError] = useState<Record<string, string>>({});

  async function save() {
    setBusy(true);
    setError(null);
    setPerError({});

    // Validacion local: nombres no vacios y sin duplicados en el lote.
    const seen = new Map<string, string>();
    const errs: Record<string, string> = {};
    for (const r of results) {
      const n = r.name.trim();
      if (!n) {
        errs[r.pieceId] = 'Escribe un nombre para esta imagen.';
        continue;
      }
      const key = n.toLowerCase();
      if (seen.has(key)) errs[r.pieceId] = 'Nombre repetido en este lote.';
      seen.set(key, r.pieceId);
    }
    if (Object.keys(errs).length > 0) {
      setPerError(errs);
      setBusy(false);
      return;
    }

    // Guarda cada una; valida conflicto con la campana via libraryCheckName.
    const failed: string[] = [];
    for (const r of results) {
      if (!r.versionId) continue;
      try {
        const check = await window.fuller.libraryCheckName({
          campaignId: campaign.id,
          name: r.name.trim(),
        });
        if (!check.ok) {
          setPerError((p) => ({ ...p, [r.pieceId]: check.error ?? 'Nombre no valido.' }));
          failed.push(r.pieceId);
          continue;
        }
        await window.fuller.librarySave({
          versionId: r.versionId,
          campaignId: campaign.id,
          name: r.name.trim(),
        });
      } catch (e) {
        setPerError((p) => ({ ...p, [r.pieceId]: (e as Error).message }));
        failed.push(r.pieceId);
      }
    }

    if (failed.length > 0) {
      setError(
        `Se guardaron ${results.length - failed.length} de ${results.length}. ` +
          'Revisa las marcadas y reintenta.'
      );
      setBusy(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="lib-modal-overlay" onClick={onClose}>
      <div className="lib-modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="lib-modal-head">
          <h3>Guardar imagenes en la app</h3>
          <button className="lib-modal-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="wz-muted" style={{ marginBottom: 12 }}>
          Destino: <strong>{campaign.name}</strong>
        </div>

        <div className="wz-save-list">
          {results.map((r) => (
            <div key={r.pieceId} className="wz-save-row">
              {r.imageUrl && <img src={r.imageUrl} alt={r.name} />}
              <div className="wz-save-name">
                <div className="lib-name-row">
                  <input
                    value={r.name}
                    placeholder="Escribe un nombre"
                    onChange={(e) => onNameChange(r.pieceId, e.target.value)}
                    style={perError[r.pieceId] ? { borderColor: '#c0392b' } : undefined}
                  />
                  <span className="lib-ext">.png</span>
                </div>
                {perError[r.pieceId] && (
                  <div className="lib-error">{perError[r.pieceId]}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="lib-error">{error}</div>}
        <div className="lib-modal-actions">
          <button onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? 'Guardando...' : `Guardar ${results.length} imagenes`}
          </button>
        </div>
      </div>
    </div>
  );
}
