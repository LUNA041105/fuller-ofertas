import type { AspectFormat, Campaign, OfferRegion } from '../../../shared/types';

// Estado del asistente "Crear nuevas ofertas". Vive en memoria mientras el
// usuario recorre los pasos; se conserva al navegar atras/adelante.

/** Estado de deteccion de regiones de una pagina. */
export type DetectStatus = 'idle' | 'detecting' | 'done' | 'error';

/** Regiones detectadas/confirmadas de una pagina concreta. */
export interface PageRegions {
  originalId: string;
  pageIndex: number;
  regions: OfferRegion[];
  status: DetectStatus;
  error?: string;
}

/** Un archivo subido en el paso 2, con sus paginas y su seleccion. */
export interface WizardFile {
  /** id del OriginalFile ya importado en el main process. */
  originalId: string;
  displayName: string;
  kind: 'pdf' | 'image';
  pageCount: number;
  /** Paginas seleccionadas (indices 0-based). Por defecto todas. */
  selectedPages: Set<number>;
  /** URLs de miniatura por pagina (cache). */
  thumbs: Record<number, string>;
  status: 'ready' | 'loading' | 'error';
  error?: string;
}

/** Clave estable de una pagina: "originalId:pageIndex". */
export function pageKey(originalId: string, pageIndex: number): string {
  return `${originalId}:${pageIndex}`;
}

/** Una pieza generada en el paso 4. */
export interface WizardResult {
  /** id de la pieza. */
  pieceId: string;
  /** id de la version actual mostrada. */
  versionId: string | null;
  /** id de la version anterior (para "volver a la anterior" tras regenerar). */
  previousVersionId: string | null;
  originalId: string;
  pageIndex: number;
  /** Nombre editable elegido por el usuario (sin extension). Vacio = sin nombre. */
  name: string;
  imageUrl: string | null;
  status: 'pending' | 'generating' | 'done' | 'error' | 'regenerating';
  error?: string;
  warnings: string[];
}

export type StepId = 1 | 2 | 3 | 4;

export interface WizardState {
  step: StepId;
  campaign: Campaign | null;
  files: WizardFile[];
  format: AspectFormat | null;
  results: WizardResult[];
  /** True cuando hay resultados que ya no corresponden a archivos/formato. */
  resultsStale: boolean;
}

export const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: 'Campaña' },
  { id: 2, label: 'Archivos' },
  { id: 3, label: 'Formato' },
  { id: 4, label: 'Resultados' },
];
