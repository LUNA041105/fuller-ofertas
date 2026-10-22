import { useState } from 'react';
import type { Campaign } from '../../shared/types';
import { OriginalsPanel } from './OriginalsPanel';
import { SpreadsPanel } from './SpreadsPanel';
import { PiecesPanel } from './PiecesPanel';

interface Props {
  campaign: Campaign;
}

type Tab = 'originales' | 'spreads' | 'piezas';

// Vista de una campana con las tres pestanas del flujo:
// Originales -> Spreads -> Piezas. El contenido de cada pestana se implementa
// en las etapas 1 a 5. En la Etapa 0 queda la estructura navegable.
export function CampaignView({ campaign }: Props) {
  const [tab, setTab] = useState<Tab>('originales');

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{campaign.name}</h2>

      <div className="row" style={{ marginBottom: 20 }}>
        <button
          className={tab === 'originales' ? 'primary' : ''}
          onClick={() => setTab('originales')}
        >
          Originales
        </button>
        <button
          className={tab === 'spreads' ? 'primary' : ''}
          onClick={() => setTab('spreads')}
        >
          Spreads
        </button>
        <button
          className={tab === 'piezas' ? 'primary' : ''}
          onClick={() => setTab('piezas')}
        >
          Piezas
        </button>
      </div>

      <div style={{ height: 'calc(100vh - 230px)' }}>
        {tab === 'originales' && <OriginalsPanel campaign={campaign} />}
        {tab === 'spreads' && <SpreadsPanel campaign={campaign} />}
        {tab === 'piezas' && <PiecesPanel campaign={campaign} />}
      </div>
    </div>
  );
}
