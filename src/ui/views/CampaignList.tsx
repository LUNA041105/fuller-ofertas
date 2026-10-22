import { useEffect, useState } from 'react';
import type { Campaign } from '../../shared/types';

interface Props {
  campaigns: Campaign[];
  onOpen: (id: string) => void;
  onChanged: () => void;
  /** Si viene de "Crear nuevas ofertas", abre el formulario automaticamente. */
  autoCreate?: boolean;
  onConsumedAutoCreate?: () => void;
}

// Lista de campanas y creacion de nuevas.
export function CampaignList({
  campaigns,
  onOpen,
  onChanged,
  autoCreate,
  onConsumedAutoCreate,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  // Abre el formulario de creacion si se entro por "Crear nuevas ofertas".
  useEffect(() => {
    if (autoCreate) {
      setCreating(true);
      onConsumedAutoCreate?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate]);

  async function create() {
    const clean = name.trim();
    if (!clean) return;
    await window.fuller.createCampaign(clean);
    setName('');
    setCreating(false);
    onChanged();
  }

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta campaña y todo su contenido?')) return;
    await window.fuller.deleteCampaign(id);
    onChanged();
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Campañas</h2>
      <div className="toolbar">
        {creating ? (
          <>
            <input
              autoFocus
              placeholder="Ej: CY26 C02"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <button className="primary" onClick={create}>
              Crear
            </button>
            <button onClick={() => setCreating(false)}>Cancelar</button>
          </>
        ) : (
          <button className="primary" onClick={() => setCreating(true)}>
            + Nueva campaña
          </button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="empty">Aún no hay campañas. Crea la primera.</div>
      ) : (
        <div className="card-grid">
          {campaigns.map((c) => (
            <div key={c.id} className="card" onClick={() => onOpen(c.id)}>
              <h3>{c.name}</h3>
              <div className="muted">{c.slug}</div>
              <div className="row" style={{ marginTop: 14 }}>
                <button onClick={(e) => remove(c.id, e)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
