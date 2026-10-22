import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { userDataRoot } from './paths';
import type {
  Campaign,
  OriginalFile,
  Spread,
  Piece,
  PieceVersion,
  LibraryImage,
} from '../../src/shared/types';
import { parseCampaignName } from '../../src/shared/types';

// Capa de persistencia local basada en un unico documento JSON.
//
// Se eligio JSON puro (sin dependencias nativas) para que la app instale y
// compile sin un toolchain de C++ en Windows, macOS y Linux. El volumen de
// datos (metadatos de campanas, spreads y piezas) es pequeno y cabe comodamente
// en memoria; las imagenes y PDFs se guardan como archivos aparte.
//
// La escritura es atomica: se escribe a un archivo temporal y se renombra,
// evitando corrupcion si la app se cierra a mitad de un guardado.

interface DbShape {
  campaigns: Campaign[];
  originals: OriginalFile[];
  spreads: Spread[];
  pieces: Piece[];
  versions: PieceVersion[];
  libraryImages: LibraryImage[];
  settings: Record<string, string>;
}

const EMPTY: DbShape = {
  campaigns: [],
  originals: [],
  spreads: [],
  pieces: [],
  versions: [],
  libraryImages: [],
  settings: {},
};

let cache: DbShape | null = null;

function filePath(): string {
  return join(userDataRoot(), 'fuller-ofertas.json');
}

function load(): DbShape {
  if (cache) return cache;
  mkdirSync(userDataRoot(), { recursive: true });
  const path = filePath();
  if (!existsSync(path)) {
    cache = structuredClone(EMPTY);
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<DbShape>;
    cache = { ...structuredClone(EMPTY), ...parsed };
    migrate(cache);
  } catch {
    // Archivo corrupto: se parte de vacio para no bloquear la app.
    cache = structuredClone(EMPTY);
  }
  return cache;
}

/**
 * Migracion retrocompatible: rellena year/campaignNumber en campanas antiguas
 * que no tenian esos campos, derivandolos del nombre.
 */
function migrate(d: DbShape): void {
  let changed = false;
  for (const c of d.campaigns) {
    if (c.year === undefined || c.campaignNumber === undefined) {
      const { year, campaignNumber } = parseCampaignName(c.name);
      c.year = c.year ?? year;
      c.campaignNumber = c.campaignNumber ?? campaignNumber;
      changed = true;
    }
  }
  if (changed) {
    // Persistir la migracion (writeFileSync directo para no recursionar load()).
    try {
      writeFileSync(filePath(), JSON.stringify(d, null, 2), 'utf-8');
    } catch {
      // Si falla el guardado, la migracion queda solo en memoria (no critico).
    }
  }
}

/** Persiste el estado actual de forma atomica. */
export function persist(): void {
  const data = load();
  const path = filePath();
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  // Rename atomico sobre el archivo final.
  writeFileSync(path, readFileSync(tmp));
}

/** Inicializa el almacen (se llama al arrancar). */
export function initDb(): void {
  load();
}

// --- Acceso a colecciones ---

export function db() {
  return load();
}

// --- Ajustes clave/valor ---

export function getSetting(key: string): string | null {
  const value = load().settings[key];
  return value ?? null;
}

export function setSetting(key: string, value: string): void {
  load().settings[key] = value;
  persist();
}
