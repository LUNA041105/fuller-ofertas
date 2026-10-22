import { useState } from 'react';
import logoUrl from '../assets/fuller-logo.png';

interface Props {
  onConsultar: () => void;
  onCrear: () => void;
  onSettings: () => void;
}

// Pantalla de bienvenida segun el boceto Fuller:
// encabezado (logo + Ajustes), hero centrado y dos tarjetas-acceso.
export function HomeScreen({ onConsultar, onCrear, onSettings }: Props) {
  const [logoOk, setLogoOk] = useState(true);

  return (
    <div className="fh">
      <header className="fh-header">
        {logoOk ? (
          <img
            className="fh-logo"
            src={logoUrl}
            alt="Fuller"
            onError={() => setLogoOk(false)}
          />
        ) : (
          // Respaldo temporal si el archivo del logo no esta presente.
          <span className="fh-logo-fallback">fuller</span>
        )}
        <button className="fh-settings" onClick={onSettings}>
          Ajustes
        </button>
      </header>

      <main className="fh-main">
        <div className="fh-glow" aria-hidden />
        <div className="fh-content">
          <h1 className="fh-title">Ofertas a consumidor</h1>
          <p className="fh-subtitle">
            Convierte tu catálogo en piezas listas para compartir.
            <br />
            Elige una opción para comenzar.
          </p>

          <div className="fh-cards">
            {/* Tarjeta izquierda: consultar */}
            <div
              className="fh-card"
              role="button"
              tabIndex={0}
              onClick={onConsultar}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onConsultar();
                }
              }}
            >
              <div className="fh-card-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h5a2 2 0 0 1 2 2v3.5" />
                  <path d="M3 7v10a2 2 0 0 0 2 2h6.5" />
                  <circle cx="17.5" cy="17" r="3" />
                  <path d="m19.7 19.2 2.3 2.3" />
                </svg>
              </div>
              <h2 className="fh-card-title">Consultar ofertas</h2>
              <p className="fh-card-desc">
                Abre una campaña existente y revisa originales, versiones y
                piezas.
              </p>
              <span className="fh-card-action">
                Consultar campaña
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </span>
            </div>

            {/* Tarjeta derecha: crear */}
            <div
              className="fh-card fh-card-accent"
              role="button"
              tabIndex={0}
              onClick={onCrear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCrear();
                }
              }}
            >
              <div className="fh-card-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
                  <path d="M12 8.5v7" />
                  <path d="M8.5 12h7" />
                </svg>
              </div>
              <h2 className="fh-card-title">Crear nuevas ofertas</h2>
              <p className="fh-card-desc">
                Inicia una campaña, carga tus archivos y genera las piezas.
              </p>
              <span className="fh-card-action">
                Crear campaña
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
