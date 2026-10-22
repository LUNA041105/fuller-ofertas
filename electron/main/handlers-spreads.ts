import { ipcMain } from 'electron';
import { IPC } from '../../src/shared/ipc';
import type { Spread } from '../../src/shared/types';
import { db, persist } from './db';
import { newId, nowIso } from './util';

// Manejadores de spreads: una composicion del catalogo (1 pagina o 2 enfrentadas).
// Permiten registrar y corregir el identificador, las paginas del PDF y las
// paginas impresas del catalogo (que pueden diferir del indice del PDF).

export function registerSpreadHandlers(): void {
  ipcMain.handle(IPC.spreadList, (_e, campaignId: string): Spread[] => {
    return db()
      .spreads.filter((s) => s.campaignId === campaignId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

  ipcMain.handle(IPC.spreadCreate, (_e, input: Partial<Spread>): Spread => {
    if (!input.campaignId) throw new Error('Falta la campana.');
    if (!input.originalId) throw new Error('Falta el archivo original.');
    const pdfPageIndices = input.pdfPageIndices ?? [];
    if (pdfPageIndices.length === 0) {
      throw new Error('Un spread debe tener al menos una pagina.');
    }
    if (pdfPageIndices.length > 2) {
      throw new Error('Un spread admite como maximo dos paginas enfrentadas.');
    }

    const spread: Spread = {
      id: newId(),
      campaignId: input.campaignId,
      originalId: input.originalId,
      spreadCode: (input.spreadCode ?? '').trim() || nextSpreadCode(input.campaignId),
      pdfPageIndices,
      catalogPages: input.catalogPages ?? [],
      isDoublePage: pdfPageIndices.length === 2,
      cropRegion: input.cropRegion ?? null,
      createdAt: nowIso(),
    };
    db().spreads.push(spread);
    persist();
    return spread;
  });

  ipcMain.handle(
    IPC.spreadUpdate,
    (_e, id: string, patch: Partial<Spread>): Spread => {
      const spread = db().spreads.find((s) => s.id === id);
      if (!spread) throw new Error('Spread no encontrado.');

      if (patch.spreadCode !== undefined) {
        spread.spreadCode = patch.spreadCode.trim();
      }
      if (patch.pdfPageIndices !== undefined) {
        if (patch.pdfPageIndices.length < 1 || patch.pdfPageIndices.length > 2) {
          throw new Error('Un spread debe tener una o dos paginas.');
        }
        spread.pdfPageIndices = patch.pdfPageIndices;
        spread.isDoublePage = patch.pdfPageIndices.length === 2;
      }
      if (patch.catalogPages !== undefined) {
        spread.catalogPages = patch.catalogPages;
      }
      persist();
      return spread;
    }
  );

  ipcMain.handle(IPC.spreadDelete, (_e, id: string): void => {
    const d = db();
    // Elimina el spread y lo quita de cualquier pieza que lo referencie.
    d.spreads = d.spreads.filter((s) => s.id !== id);
    for (const piece of d.pieces) {
      piece.spreadIds = piece.spreadIds.filter((sid) => sid !== id);
    }
    // Piezas que quedaron sin spreads se eliminan junto con sus versiones.
    const emptyPieceIds = d.pieces.filter((p) => p.spreadIds.length === 0).map((p) => p.id);
    d.versions = d.versions.filter((v) => !emptyPieceIds.includes(v.pieceId));
    d.pieces = d.pieces.filter((p) => p.spreadIds.length > 0);
    persist();
  });
}

/** Genera un codigo de spread incremental tipo "01", "02" para la campana. */
function nextSpreadCode(campaignId: string): string {
  const count = db().spreads.filter((s) => s.campaignId === campaignId).length;
  return String(count + 1).padStart(2, '0');
}
