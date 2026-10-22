import { ipcMain, dialog, BrowserWindow } from 'electron';
import { join, extname } from 'node:path';
import { copyFileSync, existsSync, unlinkSync, renameSync } from 'node:fs';
import { IPC } from '../../src/shared/ipc';
import type {
  LibraryImage,
  LibraryYearNode,
  LibraryCampaignNode,
  PieceVersion,
} from '../../src/shared/types';
import {
  yearLabel,
  campaignNumberLabel,
} from '../../src/shared/types';
import { db, persist } from './db';
import { newId, nowIso, validateFileName } from './util';
import { libraryDir } from './paths';
import { toImgUrl } from './protocol';

// Manejadores de la biblioteca administrada ("Consultar ofertas").
// La identidad de cada imagen es su id estable; el nombre es solo presentacion.

function withUrl(li: LibraryImage): LibraryImage {
  return { ...li, imageUrl: li.storedPath ? toImgUrl(li.storedPath) : null };
}

/** True si ya existe una imagen con ese nombre (sin distinguir may/min) en la campana. */
function nameExistsInCampaign(
  campaignId: string,
  name: string,
  exceptId?: string
): boolean {
  const target = name.trim().toLowerCase();
  return db().libraryImages.some(
    (li) =>
      li.campaignId === campaignId &&
      li.id !== exceptId &&
      li.name.trim().toLowerCase() === target
  );
}

/** Construye el arbol anios -> campanas -> imagenes, ordenado por numero. */
function buildTree(): LibraryYearNode[] {
  const d = db();
  const byYear = new Map<number | null, LibraryYearNode>();

  // Incluir TODAS las campanas (aunque no tengan imagenes aun), segun boceto.
  for (const c of d.campaigns) {
    const y = c.year ?? null;
    if (!byYear.has(y)) {
      byYear.set(y, { year: y, label: yearLabel(y), campaigns: [] });
    }
    const node: LibraryCampaignNode = {
      campaignId: c.id,
      label: campaignNumberLabel(c.campaignNumber),
      campaignNumber: c.campaignNumber,
      images: d.libraryImages
        .filter((li) => li.campaignId === c.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map(withUrl),
    };
    byYear.get(y)!.campaigns.push(node);
  }

  // Ordenar campanas por numero (no alfabetico) y anios descendente.
  const years = [...byYear.values()];
  for (const yn of years) {
    yn.campaigns.sort(
      (a, b) => (a.campaignNumber ?? 9999) - (b.campaignNumber ?? 9999)
    );
  }
  years.sort((a, b) => (b.year ?? -1) - (a.year ?? -1));
  return years;
}

export function registerLibraryHandlers(): void {
  ipcMain.handle(IPC.libraryTree, (): LibraryYearNode[] => buildTree());

  // Comprueba disponibilidad de un nombre (para validacion en vivo).
  ipcMain.handle(
    IPC.libraryCheckName,
    (
      _e,
      input: { campaignId: string; name: string; exceptId?: string }
    ): { ok: boolean; error: string | null } => {
      const err = validateFileName(input.name);
      if (err) return { ok: false, error: err };
      if (nameExistsInCampaign(input.campaignId, input.name, input.exceptId)) {
        return { ok: false, error: 'Ya existe un archivo con ese nombre en la campana.' };
      }
      return { ok: true, error: null };
    }
  );

  // Guarda una version de pieza en la biblioteca con nombre obligatorio.
  ipcMain.handle(
    IPC.librarySave,
    (
      _e,
      input: { versionId: string; campaignId: string; name: string }
    ): LibraryImage => {
      const d = db();
      const version = d.versions.find((v) => v.id === input.versionId);
      if (!version || !version.imagePath) {
        throw new Error('La version no tiene imagen para guardar.');
      }
      const nameErr = validateFileName(input.name);
      if (nameErr) throw new Error(nameErr);
      if (nameExistsInCampaign(input.campaignId, input.name)) {
        throw new Error('Ya existe un archivo con ese nombre en la campana.');
      }

      const piece = d.pieces.find((p) => p.id === version.pieceId);
      const ext = extname(version.imagePath) || '.png';
      const id = newId();
      const stored = join(libraryDir(input.campaignId), `${id}${ext}`);
      copyFileSync(version.imagePath, stored);

      const li: LibraryImage = {
        id,
        campaignId: input.campaignId,
        name: input.name.trim(),
        ext,
        storedPath: stored,
        imageUrl: null,
        sourceVersionId: version.id,
        format: piece?.format ?? null,
        width: null,
        height: null,
        createdAt: nowIso(),
      };
      d.libraryImages.push(li);
      persist();
      return withUrl(li);
    }
  );

  // Renombra (solo el nombre mostrado; el id y el archivo fisico no cambian).
  ipcMain.handle(
    IPC.libraryRename,
    (_e, input: { id: string; name: string }): LibraryImage => {
      const d = db();
      const li = d.libraryImages.find((x) => x.id === input.id);
      if (!li) throw new Error('Imagen no encontrada.');
      const nameErr = validateFileName(input.name);
      if (nameErr) throw new Error(nameErr);
      if (nameExistsInCampaign(li.campaignId, input.name, li.id)) {
        throw new Error('Ya existe un archivo con ese nombre en la campana.');
      }
      li.name = input.name.trim();
      persist();
      return withUrl(li);
    }
  );

  // Mueve la imagen a otra campana (sin duplicar; conflicto de nombre falla).
  ipcMain.handle(
    IPC.libraryMove,
    (_e, input: { id: string; targetCampaignId: string }): LibraryImage => {
      const d = db();
      const li = d.libraryImages.find((x) => x.id === input.id);
      if (!li) throw new Error('Imagen no encontrada.');
      if (input.targetCampaignId === li.campaignId) {
        throw new Error('El archivo ya esta en esa campana.');
      }
      const target = d.campaigns.find((c) => c.id === input.targetCampaignId);
      if (!target) throw new Error('Campana destino no encontrada.');
      if (nameExistsInCampaign(input.targetCampaignId, li.name)) {
        throw new Error(
          'Ya existe un archivo con ese nombre en el destino. Renombralo antes de mover.'
        );
      }
      // Mover el archivo fisico a la carpeta de la nueva campana.
      const newPath = join(libraryDir(input.targetCampaignId), `${li.id}${li.ext}`);
      try {
        renameSync(li.storedPath, newPath);
      } catch {
        // Si renameSync falla entre volumenes, copiar+borrar.
        copyFileSync(li.storedPath, newPath);
        try {
          unlinkSync(li.storedPath);
        } catch {
          /* ignore */
        }
      }
      li.campaignId = input.targetCampaignId;
      li.storedPath = newPath;
      persist();
      return withUrl(li);
    }
  );

  // Elimina la imagen de la biblioteca de la app (NO toca el catalogo original
  // ni copias exportadas a otras carpetas).
  ipcMain.handle(IPC.libraryDelete, (_e, id: string): void => {
    const d = db();
    const li = d.libraryImages.find((x) => x.id === id);
    if (!li) throw new Error('Imagen no encontrada.');
    try {
      if (existsSync(li.storedPath)) unlinkSync(li.storedPath);
    } catch {
      /* el archivo fisico puede ya no existir; continuar */
    }
    d.libraryImages = d.libraryImages.filter((x) => x.id !== id);
    persist();
  });

  // Elimina una CAMPANA de la biblioteca, SOLO si no tiene imagenes guardadas.
  ipcMain.handle(IPC.libraryDeleteCampaign, (_e, campaignId: string): void => {
    const d = db();
    const campaign = d.campaigns.find((c) => c.id === campaignId);
    if (!campaign) throw new Error('Campana no encontrada.');
    const hasImages = d.libraryImages.some((li) => li.campaignId === campaignId);
    if (hasImages) {
      throw new Error('La campana tiene imagenes. Elimina primero sus imagenes.');
    }
    // Elimina la campana y su contenido auxiliar (sin imagenes guardadas).
    d.versions = d.versions.filter(
      (v) => !d.pieces.some((p) => p.id === v.pieceId && p.campaignId === campaignId)
    );
    d.pieces = d.pieces.filter((p) => p.campaignId !== campaignId);
    d.spreads = d.spreads.filter((s) => s.campaignId !== campaignId);
    d.originals = d.originals.filter((o) => o.campaignId !== campaignId);
    d.campaigns = d.campaigns.filter((c) => c.id !== campaignId);
    persist();
  });

  // Elimina un ANIO completo, SOLO si no tiene ninguna campana.
  ipcMain.handle(IPC.libraryDeleteYear, (_e, year: number): void => {
    const d = db();
    const hasCampaigns = d.campaigns.some((c) => c.year === year);
    if (hasCampaigns) {
      throw new Error('El ano tiene campanas. Elimina primero sus campanas.');
    }
    // Sin entidad propia de "ano": al no haber campanas, no hay nada que borrar.
    // Se deja el handler por consistencia con la UI.
  });

  // Exporta una copia a una carpeta del equipo con nombre editable.
  ipcMain.handle(
    IPC.libraryExport,
    async (
      _e,
      input: { id: string; name: string }
    ): Promise<{ ok: boolean; path?: string; error?: string }> => {
      const d = db();
      const li = d.libraryImages.find((x) => x.id === input.id);
      if (!li) return { ok: false, error: 'Imagen no encontrada.' };
      if (!existsSync(li.storedPath)) {
        return { ok: false, error: 'El archivo de imagen no esta disponible.' };
      }
      const nameErr = validateFileName(input.name);
      if (nameErr) return { ok: false, error: nameErr };

      const win = BrowserWindow.getFocusedWindow() ?? undefined;
      const res = await dialog.showSaveDialog(win!, {
        title: 'Exportar imagen',
        defaultPath: `${input.name.trim()}${li.ext}`,
        filters: [{ name: li.ext.replace('.', '').toUpperCase(), extensions: [li.ext.replace('.', '')] }],
      });
      if (res.canceled || !res.filePath) return { ok: false };
      // El dialogo de guardado ya confirma el reemplazo si el archivo existe.
      // Exporta la imagen ORIGINAL (archivo de la biblioteca), no una captura.
      copyFileSync(li.storedPath, res.filePath);
      return { ok: true, path: res.filePath };
    }
  );
}

// Reutilizable por otras partes (p. ej. guardar desde el flujo de creacion).
export function getVersionImagePath(versionId: string): PieceVersion | undefined {
  return db().versions.find((v) => v.id === versionId);
}
