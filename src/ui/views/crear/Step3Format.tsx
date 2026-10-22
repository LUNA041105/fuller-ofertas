import type { AspectFormat, Campaign } from '../../../shared/types';
import { FORMAT_SPECS } from '../../../shared/types';

interface Props {
  campaign: Campaign;
  format: AspectFormat | null;
  onSelect: (f: AspectFormat) => void;
  filesLoaded: number;
  piecesExpected: number;
}

const OPTIONS: { format: AspectFormat; subtitle: string }[] = [
  { format: '9:16', subtitle: 'Vertical / Historias' },
  { format: '4:5', subtitle: 'Vertical / Publicaciones' },
  { format: '1:1', subtitle: 'Cuadrado' },
];

// Paso 3: elegir formato (relacion de aspecto) + resumen.
export function Step3Format({
  campaign,
  format,
  onSelect,
  filesLoaded,
  piecesExpected,
}: Props) {
  return (
    <div className="wz-panel">
      <div className="wz-subtitle">
        Campaña: <strong>{campaign.name}</strong> · {filesLoaded}{' '}
        {filesLoaded === 1 ? 'archivo cargado' : 'archivos cargados'}
      </div>

      <div className="wz-format-cards">
        {OPTIONS.map((o) => {
          const spec = FORMAT_SPECS[o.format];
          const ratio = spec.width / spec.height;
          // Representacion proporcional dentro de una caja de 120px de alto.
          const boxH = 120;
          const boxW = Math.round(boxH * ratio);
          const sel = format === o.format;
          return (
            <button
              key={o.format}
              className={`wz-format${sel ? ' wz-format-sel' : ''}`}
              onClick={() => onSelect(o.format)}
            >
              <input type="radio" checked={sel} readOnly className="wz-format-radio" />
              <div className="wz-format-vis" style={{ height: boxH }}>
                <div
                  className="wz-format-shape"
                  style={{ width: boxW, height: boxH }}
                >
                  {o.format}
                </div>
              </div>
              <div className="wz-format-title">{o.format} · {o.subtitle}</div>
              <div className="wz-muted">{spec.width} × {spec.height} px</div>
            </button>
          );
        })}
      </div>

      <div className="wz-summary">
        <h4>Resumen</h4>
        <ul>
          <li>
            Campaña: <strong>{campaign.name}</strong>
          </li>
          <li>
            Paginas seleccionadas: <strong>{piecesExpected}</strong>
          </li>
          <li>
            Formato: <strong>{format ?? 'sin elegir'}</strong>
          </li>
          <li>
            Piezas previstas: <strong>{piecesExpected}</strong>
          </li>
        </ul>
      </div>

      {!format && (
        <div className="wz-hint">Elige un formato para generar las imagenes.</div>
      )}
    </div>
  );
}
