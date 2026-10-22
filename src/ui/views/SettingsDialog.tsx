import { useEffect, useState } from 'react';
import type { AppSettings } from '../../shared/types';

interface Props {
  onClose: () => void;
}

// Dialogo de ajustes: configuracion de la API key de OpenAI y el modelo.
// La clave se guarda en el almacen seguro del sistema, nunca en texto plano.
export function SettingsDialog({ onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    window.fuller.getSettings().then((s) => {
      setSettings(s);
      setModel(s.openaiModel);
      setImageModel(s.openaiImageModel);
    });
  }, []);

  async function saveKey() {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const s = await window.fuller.setApiKey(apiKey.trim());
      setSettings(s);
      setApiKey('');
      setMsg('Clave guardada de forma segura.');
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveModel() {
    setSaving(true);
    try {
      const s = await window.fuller.setModel(model.trim());
      setSettings(s);
      setMsg('Modelo actualizado.');
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveImageModel() {
    setSaving(true);
    try {
      const s = await window.fuller.setImageModel(imageModel.trim());
      setSettings(s);
      setMsg('Modelo de imagen actualizado.');
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 520, cursor: 'default' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Ajustes</h3>

        <section style={{ marginTop: 16 }}>
          <label className="muted">Clave de OpenAI (API key)</label>
          <div className="row" style={{ marginTop: 6 }}>
            <input
              type="password"
              placeholder={
                settings?.hasApiKey ? '•••••• (ya configurada)' : 'sk-...'
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="primary" onClick={saveKey} disabled={saving}>
              Guardar
            </button>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Se guarda cifrada en el almacen del sistema operativo. Tambien puede
            leerse de la variable de entorno OPENAI_API_KEY.
          </div>
        </section>

        <section style={{ marginTop: 20 }}>
          <label className="muted">Modelo de IA (vision / regenerar)</label>
          <div className="row" style={{ marginTop: 6 }}>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={saveModel} disabled={saving}>
              Guardar
            </button>
          </div>
        </section>

        <section style={{ marginTop: 20 }}>
          <label className="muted">Modelo de IA (edicion de imagenes / adaptar formato)</label>
          <div className="row" style={{ marginTop: 6 }}>
            <input
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={saveImageModel} disabled={saving}>
              Guardar
            </button>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Se usa para reacomodar la pieza al formato elegido sin bordes blancos.
            Requiere internet y tiene costo por imagen.
          </div>
        </section>

        {msg && (
          <div className="muted" style={{ marginTop: 14 }}>
            {msg}
          </div>
        )}

        <div className="row" style={{ marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
