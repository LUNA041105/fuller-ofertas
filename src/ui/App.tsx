import { useEffect, useState } from 'react';
import type { Campaign } from '../shared/types';
import { HomeScreen } from './views/HomeScreen';
import { ConsultarOfertas } from './views/ConsultarOfertas';
import { CrearOfertas } from './views/CrearOfertas';
import { CampaignList } from './views/CampaignList';
import { CampaignView } from './views/CampaignView';
import { SettingsDialog } from './views/SettingsDialog';

// Shell principal de la aplicacion. Navegacion de alto nivel:
// bienvenida (home) -> consultar ofertas (biblioteca) / crear (asistente).

type View = 'home' | 'consultar' | 'crear' | 'list';

export function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [view, setView] = useState<View>('home');
  const [autoCreate, setAutoCreate] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  async function refresh() {
    setCampaigns(await window.fuller.listCampaigns());
  }

  useEffect(() => {
    refresh();
  }, []);

  const active = campaigns.find((c) => c.id === activeId) ?? null;

  function goConsultar() {
    setView('consultar');
  }

  function goCrear() {
    setView('crear');
  }

  function goHome() {
    setActiveId(null);
    setView('home');
  }

  if (view === 'home') {
    return (
      <>
        <HomeScreen
          onConsultar={goConsultar}
          onCrear={goCrear}
          onSettings={() => setShowSettings(true)}
        />
        {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      </>
    );
  }

  if (view === 'consultar') {
    return <ConsultarOfertas onHome={goHome} />;
  }

  if (view === 'crear') {
    return <CrearOfertas onHome={goHome} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 onClick={goHome} style={{ cursor: 'pointer' }} title="Ir al inicio">
          Fuller · Ofertas a consumidor
        </h1>
        <div className="row">
          {active ? (
            <button onClick={() => setActiveId(null)}>← Campañas</button>
          ) : (
            <button onClick={goHome}>← Inicio</button>
          )}
          <button onClick={() => setShowSettings(true)}>Ajustes</button>
        </div>
      </header>

      <main className="app-body">
        {active ? (
          <CampaignView campaign={active} />
        ) : (
          <CampaignList
            campaigns={campaigns}
            autoCreate={autoCreate}
            onOpen={(id) => setActiveId(id)}
            onChanged={refresh}
            onConsumedAutoCreate={() => setAutoCreate(false)}
          />
        )}
      </main>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  );
}
