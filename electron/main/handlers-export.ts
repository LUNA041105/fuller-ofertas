import { ipcMain, dialog, BrowserWindow } from 'electron';
import { join, extname } from 'node:path';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import AdmZip from 'adm-zip';
import { IPC } from '../../src/shared/ipc';
import type { Campaign, Piece, PieceVersion, Spread } from '../../src/shared/types';
import { db } from './db';
import { validateFileName } from './util';

// Manejadores de exportacion y nombres de archivo.
//
// Convencion de nombres (requisito):
//   CY26_C02_Spread_08_9x16_01.png
// Si una pieza agrupa varios spreads, se usa el identificador de la pieza:
//   CY26_C02_Pieza_03_9x16_01.png
// Un contador final evita sobrescrituras entre formatos/versiones del mismo spread.

function formatToken(format: string): string {
  return format.replace(':', 'x'); // "9:16" -> "9x16"
}

/**
 * Construye el nombre base (sin contador) de una pieza, segun sus spreads.
 */
function pieceBaseName(campaign: Campaign, piece: Piece, spreads: Spread[]): string {
  const fmt = formatToken(piece.format);
  const own = spreads.filter((s) => piece.spreadIds.includes(s.id));
  if (own.length === 1) {
    return `${campaign.slug}_Spread_${own[0].spreadCode}_${fmt}`;
  }
  // Varios spreads: identificador de pieza.
  return `${campaign.slug}_Pieza_${piece.pieceCode}_${fmt}`;
}

/**
 * Resuelve un nombre de archivo unico dentro de un conjunto ya usado,
 * agregando un contador incremental de dos digitos.
 */
function uniqueName(base: string, used: Set<string>): string {
  let seq = 1;
  let name = `${base}_${String(seq).padStart(2, '0')}.png`;
  while (used.has(name)) {
    seq += 1;
    name = `${base}_${String(seq).padStart(2, '0')}.png`;
  }
  used.add(name);
  return name;
}

/** Obtiene la version a exportar de una pieza (definitiva o la ultima lista). */
function exportableVersion(pieceId: string): PieceVersion | null {
  const versions = db()
    .versions.filter((v) => v.pieceId === pieceId && v.imagePath && v.status === 'done')
    .sort((a, b) => a.versionNumber - b.versionNumber);
  const final = versions.find((v) => v.isFinal);
  return final ?? versions[versions.length - 1] ?? null;
}

function ctx(versionId: string) {
  const d = db();
  const version = d.versions.find((v) => v.id === versionId);
  if (!version) throw new Error('Version no encontrada.');
  const piece = d.pieces.find((p) => p.id === version.pieceId);
  if (!piece) throw new Error('Pieza no encontrada.');
  const campaign = d.campaigns.find((c) => c.id === piece.campaignId);
  if (!campaign) throw new Error('Campana no encontrada.');
  const spreads = d.spreads.filter((s) => piece.spreadIds.includes(s.id));
  return { version, piece, campaign, spreads };
}

export function registerExportHandlers(): void {
  // Exportar una sola imagen: abre dialogo "Guardar como" con nombre sugerido.
  ipcMain.handle(IPC.exportSingle, async (_e, versionId: string): Promise<string | null> => {
    const { version, piece, campaign, spreads } = ctx(versionId);
    if (!version.imagePath) throw new Error('La version no tiene imagen.');

    const suggested = `${pieceBaseName(campaign, piece, spreads)}_01.png`;
    const win = BrowserWindow.getFocusedWindow() ?? undefined;
    const res = await dialog.showSaveDialog(win!, {
      title: 'Exportar imagen',
      defaultPath: suggested,
      filters: [{ name: 'PNG', extensions: ['png'] }],
    });
    if (res.canceled || !res.filePath) return null;
    copyFileSync(version.imagePath, res.filePath);
    return res.filePath;
  });

  // Exportar una seleccion de versiones a una carpeta elegida.
  ipcMain.handle(
    IPC.exportSelection,
    async (_e, versionIds: string[]): Promise<string | null> => {
      if (!versionIds || versionIds.length === 0) return null;
      const win = BrowserWindow.getFocusedWindow() ?? undefined;
      const res = await dialog.showOpenDialog(win!, {
        title: 'Elegir carpeta de destino',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (res.canceled || res.filePaths.length === 0) return null;
      const destDir = res.filePaths[0];

      const used = new Set<string>();
      for (const vid of versionIds) {
        const { version, piece, campaign, spreads } = ctx(vid);
        if (!version.imagePath) continue;
        const name = uniqueName(pieceBaseName(campaign, piece, spreads), used);
        copyFileSync(version.imagePath, join(destDir, name));
      }
      return destDir;
    }
  );

  // Exportar TODAS las piezas definitivas de una campana como ZIP organizado.
  ipcMain.handle(IPC.exportZip, async (_e, campaignId: string): Promise<string | null> => {
    const d = db();
    const campaign = d.campaigns.find((c) => c.id === campaignId);
    if (!campaign) throw new Error('Campana no encontrada.');

    const pieces = d.pieces.filter((p) => p.campaignId === campaignId);
    // Reunir la version exportable de cada pieza (definitiva o ultima lista).
    const entries: { name: string; path: string }[] = [];
    const used = new Set<string>();
    for (const piece of pieces) {
      const version = exportableVersion(piece.id);
      if (!version?.imagePath || !existsSync(version.imagePath)) continue;
      const spreads = d.spreads.filter((s) => piece.spreadIds.includes(s.id));
      const name = uniqueName(pieceBaseName(campaign, piece, spreads), used);
      entries.push({ name, path: version.imagePath });
    }

    if (entries.length === 0) {
      throw new Error('No hay imagenes para exportar en esta campana.');
    }

    const win = BrowserWindow.getFocusedWindow() ?? undefined;
    const res = await dialog.showSaveDialog(win!, {
      title: 'Exportar campana como ZIP',
      defaultPath: `${campaign.slug}_Ofertas.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    if (res.canceled || !res.filePath) return null;

    // ZIP organizado en una carpeta con el nombre de la campana.
    const zip = new AdmZip();
    for (const entry of entries) {
      zip.addLocalFile(entry.path, campaign.slug, entry.name);
    }
    zip.writeZip(res.filePath);
    return res.filePath;
  });

  // --- Usados por el asistente "Crear nuevas ofertas" ---

  // Exporta UNA version con el nombre elegido por el usuario (resolucion original).
  ipcMain.handle(
    IPC.exportVersionSingle,
    async (
      _e,
      input: { versionId: string; name: string }
    ): Promise<{ ok: boolean; path?: string; error?: string }> => {
      const err = validateFileName(input.name);
      if (err) return { ok: false, error: err };
      const d = db();
      const version = d.versions.find((v) => v.id === input.versionId);
      if (!version?.imagePath || !existsSync(version.imagePath)) {
        return { ok: false, error: 'La imagen no esta disponible.' };
      }
      const ext = extname(version.imagePath) || '.png';
      const win = BrowserWindow.getFocusedWindow() ?? undefined;
      const res = await dialog.showSaveDialog(win!, {
        title: 'Descargar imagen',
        defaultPath: `${input.name.trim()}${ext}`,
        filters: [{ name: ext.replace('.', '').toUpperCase(), extensions: [ext.replace('.', '')] }],
      });
      if (res.canceled || !res.filePath) return { ok: false };
      // El saveDialog del SO ya confirma reemplazo. Copia la version actual.
      copyFileSync(version.imagePath, res.filePath);
      return { ok: true, path: res.filePath };
    }
  );

  // Exporta un ZIP con las versiones indicadas, usando los nombres elegidos.
  // Incluye SOLO la version actual de cada una (no anteriores ni fuentes).
  ipcMain.handle(
    IPC.exportZipVersions,
    async (
      _e,
      input: { items: { versionId: string; name: string }[]; zipName?: string }
    ): Promise<{ ok: boolean; path?: string; error?: string }> => {
      if (!input.items || input.items.length === 0) {
        return { ok: false, error: 'No hay imagenes para exportar.' };
      }
      // Validar nombres (vacio/invalido/duplicados en el lote).
      const used = new Set<string>();
      for (const it of input.items) {
        const e = validateFileName(it.name);
        if (e) return { ok: false, error: `"${it.name || '(vacio)'}": ${e}` };
        const key = it.name.trim().toLowerCase();
        if (used.has(key)) {
          return { ok: false, error: `Nombre duplicado en el lote: ${it.name}` };
        }
        used.add(key);
      }

      const d = db();
      const entries: { name: string; path: string }[] = [];
      for (const it of input.items) {
        const version = d.versions.find((v) => v.id === it.versionId);
        if (!version?.imagePath || !existsSync(version.imagePath)) {
          return { ok: false, error: `Falta la imagen de "${it.name}".` };
        }
        const ext = extname(version.imagePath) || '.png';
        entries.push({ name: `${it.name.trim()}${ext}`, path: version.imagePath });
      }

      const win = BrowserWindow.getFocusedWindow() ?? undefined;
      const res = await dialog.showSaveDialog(win!, {
        title: 'Descargar todas (.zip)',
        defaultPath: `${(input.zipName || 'Ofertas').trim()}.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (res.canceled || !res.filePath) return { ok: false };

      const zip = new AdmZip();
      for (const entry of entries) {
        zip.addFile(entry.name, readFileSync(entry.path));
      }
      zip.writeZip(res.filePath);
      return { ok: true, path: res.filePath };
    }
  );
}
