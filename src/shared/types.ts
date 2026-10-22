// Tipos compartidos entre el proceso main (Electron), el preload y el renderer (React).
// Son la fuente de verdad del modelo de datos de la aplicacion.

/** Formatos de salida. Las proporciones son requisito; las resoluciones son propuesta inicial. */
export type AspectFormat = '9:16' | '4:5' | '1:1';

export interface FormatSpec {
  format: AspectFormat;
  width: number;
  height: number;
  label: string;
}

/** Resoluciones propuestas por formato. */
export const FORMAT_SPECS: Record<AspectFormat, FormatSpec> = {
  '9:16': { format: '9:16', width: 1080, height: 1920, label: 'Vertical 9:16' },
  '4:5': { format: '4:5', width: 1080, height: 1350, label: 'Vertical 4:5' },
  '1:1': { format: '1:1', width: 1080, height: 1080, label: 'Cuadrado 1:1' },
};

/** Una campana agrupa originales, spreads y piezas generadas. Ej: "CY26 C02". */
export interface Campaign {
  id: string;
  name: string;
  /** Codigo normalizado para nombres de archivo, ej "CY26_C02". */
  slug: string;
  /** Anio del ciclo, ej 2026 (se muestra como "CY 26"). Puede derivarse del nombre. */
  year: number | null;
  /** Numero de campana, ej 2 (se muestra como "C02"). Puede derivarse del nombre. */
  campaignNumber: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Deriva {year, campaignNumber} del nombre/slug de una campana.
 * Reconoce patrones como "CY26 C02", "CY 26 C2", "CY26-C02".
 * Devuelve null en los campos que no pueda interpretar.
 */
export function parseCampaignName(name: string): {
  year: number | null;
  campaignNumber: number | null;
} {
  const yearMatch = name.match(/CY\s*0*(\d{2,4})/i);
  const campMatch = name.match(/\bC\s*0*(\d{1,3})\b/i);
  let year: number | null = null;
  if (yearMatch) {
    const n = parseInt(yearMatch[1], 10);
    year = n < 100 ? 2000 + n : n; // "26" -> 2026
  }
  const campaignNumber = campMatch ? parseInt(campMatch[1], 10) : null;
  return { year, campaignNumber };
}

/** Etiqueta de anio para el arbol: 2026 -> "CY 26". */
export function yearLabel(year: number | null): string {
  if (year == null) return 'Sin anio';
  return `CY ${String(year % 100).padStart(2, '0')}`;
}

/** Etiqueta de campana para el arbol: 2 -> "C02". */
export function campaignNumberLabel(n: number | null): string {
  if (n == null) return 'Campana';
  return `C${String(n).padStart(2, '0')}`;
}

/** Tipo de archivo original cargado por el usuario. */
export type OriginalKind = 'pdf' | 'image';

/** Un archivo original (PDF o imagen) cargado dentro de una campana. */
export interface OriginalFile {
  id: string;
  campaignId: string;
  kind: OriginalKind;
  /** Nombre mostrado al usuario. */
  displayName: string;
  /** Ruta absoluta del archivo copiado dentro del almacen local de la campana. */
  storedPath: string;
  /** Numero de paginas (1 para imagenes). */
  pageCount: number;
  createdAt: string;
}

/**
 * Un spread es una composicion del catalogo: una pagina o dos paginas enfrentadas.
 * El numero de pagina impreso puede diferir del indice de pagina del PDF.
 */
export interface Spread {
  id: string;
  campaignId: string;
  originalId: string;
  /** Identificador editable, ej "08". */
  spreadCode: string;
  /** Indices de pagina (0-based) del PDF/imagen que forman el spread. 1 o 2 entradas. */
  pdfPageIndices: number[];
  /** Numeros de pagina impresos en el catalogo, ej [16, 17]. Pueden editarse. */
  catalogPages: number[];
  /** True si son dos paginas enfrentadas que deben unirse por el pliegue. */
  isDoublePage: boolean;
  /**
   * Region normalizada (0..1) a recortar de la pagina para esta pieza.
   * Si es null, se usa la pagina completa. Permite varias ofertas por pagina.
   */
  cropRegion: OfferRegion | null;
  createdAt: string;
}

/** Una pieza es la unidad exportable. Puede contener uno o varios spreads. */
export interface Piece {
  id: string;
  campaignId: string;
  /** Spreads que agrupa esta pieza (uno o varios). */
  spreadIds: string[];
  format: AspectFormat;
  /** Identificador legible de la pieza para nombres de archivo. */
  pieceCode: string;
  createdAt: string;
}

/** Estado de una version generada. */
export type VersionStatus = 'pending' | 'done' | 'error';

/** Una version es un intento de generar una pieza. Se conservan todas para comparar. */
export interface PieceVersion {
  id: string;
  pieceId: string;
  /** Numero incremental de version dentro de la pieza (1, 2, 3...). */
  versionNumber: number;
  status: VersionStatus;
  /** Ruta del PNG generado (si status = done). */
  imagePath: string | null;
  /** URL servible (protocolo fuller-img://) para mostrar en el renderer. */
  imageUrl: string | null;
  /** Comentario del usuario que origino esta regeneracion (si aplica). */
  instruction: string | null;
  /** Mensaje de error de procesamiento (si status = error). */
  errorMessage: string | null;
  /** True si es la version marcada como definitiva. */
  isFinal: boolean;
  /** Alertas de fidelidad/calidad (ej baja resolucion). */
  warnings: string[];
  createdAt: string;
}

/**
 * Una imagen guardada en la biblioteca administrada por la app (lo que se ve en
 * "Consultar ofertas"). Su identidad es el id estable, NO el nombre: renombrar
 * o mover no rompe la vista previa ni las referencias.
 */
export interface LibraryImage {
  id: string;
  campaignId: string;
  /** Nombre elegido por el usuario, SIN extension. */
  name: string;
  /** Extension real segun el formato del archivo, ej ".png". */
  ext: string;
  /** Ruta absoluta de la copia administrada por la app. */
  storedPath: string;
  /** URL servible (fuller-img://) para mostrar en el renderer. */
  imageUrl: string | null;
  /** Version de pieza de origen (para reexportar a resolucion original). */
  sourceVersionId: string | null;
  /** Formato de la pieza (9:16/4:5/1:1) si proviene de una pieza. */
  format: AspectFormat | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/** Nodo de campana en el arbol de la biblioteca. */
export interface LibraryCampaignNode {
  campaignId: string;
  label: string; // "C02"
  campaignNumber: number | null;
  images: LibraryImage[];
}

/** Nodo de anio en el arbol de la biblioteca. */
export interface LibraryYearNode {
  year: number | null;
  label: string; // "CY 26"
  campaigns: LibraryCampaignNode[];
}

/**
 * Region normalizada (0..1) de una oferta/spread detectada dentro de una pagina.
 * x,y = esquina superior izquierda; w,h = ancho/alto. El recorte usa el arte
 * ORIGINAL (no se redibuja nada); la IA solo localiza.
 */
export interface OfferRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Etiqueta breve opcional que describe la oferta (solo informativa). */
  label?: string;
}

/** Ajustes de la aplicacion. La API key NO se guarda aqui en texto plano. */
export interface AppSettings {
  openaiModel: string;
  /** Modelo de edicion de imagenes (reacomodo al formato). */
  openaiImageModel: string;
  /** Indica si hay una API key configurada (sin exponer su valor). */
  hasApiKey: boolean;
}
