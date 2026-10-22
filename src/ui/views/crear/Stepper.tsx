import { STEPS, type StepId } from './types';

interface Props {
  current: StepId;
  /** Paso maximo alcanzable (no se puede saltar a pasos futuros). */
  maxReachable: StepId;
  onGo: (step: StepId) => void;
}

// Indicador superior "1 Campana > 2 Archivos > 3 Formato > 4 Resultados".
// Distingue actual, completados y bloqueados.
export function Stepper({ current, maxReachable, onGo }: Props) {
  return (
    <div className="wz-steps">
      {STEPS.map((s, i) => {
        const completed = s.id < current;
        const active = s.id === current;
        const locked = s.id > maxReachable;
        const cls = active
          ? 'wz-step wz-step-active'
          : completed
          ? 'wz-step wz-step-done'
          : locked
          ? 'wz-step wz-step-locked'
          : 'wz-step';
        return (
          <div className="wz-step-wrap" key={s.id}>
            <button
              className={cls}
              disabled={locked}
              onClick={() => !locked && onGo(s.id)}
              title={locked ? 'Completa los pasos anteriores' : `Ir a ${s.label}`}
            >
              <span className="wz-step-badge">
                {completed ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : locked ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                ) : (
                  s.id
                )}
              </span>
              <span className="wz-step-label">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="wz-step-line" />}
          </div>
        );
      })}
    </div>
  );
}
