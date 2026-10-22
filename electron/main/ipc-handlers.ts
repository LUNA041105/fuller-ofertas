import { ipcMain } from 'electron';
import { IPC } from '../../src/shared/ipc';
import type { Campaign, AppSettings } from '../../src/shared/types';
import { parseCampaignName } from '../../src/shared/types';
import { db, persist, getSetting, setSetting } from './db';
import { newId, nowIso, slugify } from './util';
import { registerLibraryHandlers } from './handlers-library';
import { getApiKey, hasApiKey, setApiKey } from './secrets';
import { registerOriginalHandlers } from './handlers-originals';
import { registerSpreadHandlers } from './handlers-spreads';
import { registerPieceHandlers } from './handlers-pieces';
import { registerExportHandlers } from './handlers-export';

// Registra todos los manejadores IPC.

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';

export function registerIpcHandlers(): void {
  registerCampaignHandlers();
  registerSettingsHandlers();
  registerOriginalHandlers();
  registerSpreadHandlers();
  registerPieceHandlers();
  registerExportHandlers();
  registerLibraryHandlers();
}

function registerCampaignHandlers(): void {
  ipcMain.handle(IPC.campaignList, (): Campaign[] => {
    return [...db().campaigns].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  });

  ipcMain.handle(IPC.campaignCreate, (_e, name: string): Campaign => {
    const clean = (name || '').trim();
    if (!clean) throw new Error('El nombre de la campana no puede estar vacio.');
    const { year, campaignNumber } = parseCampaignName(clean);
    const campaign: Campaign = {
      id: newId(),
      name: clean,
      slug: slugify(clean),
      year,
      campaignNumber,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db().campaigns.push(campaign);
    persist();
    return campaign;
  });

  // Crea una campana por anio+numero, o reutiliza la existente si ya hay una
  // con el mismo anio y numero (evita duplicados). Usado por el asistente.
  ipcMain.handle(
    IPC.campaignCreateOrReuse,
    (
      _e,
      input: { year: number; campaignNumber: number }
    ): { campaign: Campaign; reused: boolean } => {
      const d = db();
      const existing = d.campaigns.find(
        (c) => c.year === input.year && c.campaignNumber === input.campaignNumber
      );
      if (existing) return { campaign: existing, reused: true };

      const yy = String(input.year % 100).padStart(2, '0');
      const cc = String(input.campaignNumber).padStart(2, '0');
      const name = `CY${yy} C${cc}`;
      const campaign: Campaign = {
        id: newId(),
        name,
        slug: slugify(name),
        year: input.year,
        campaignNumber: input.campaignNumber,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      d.campaigns.push(campaign);
      persist();
      return { campaign, reused: false };
    }
  );

  ipcMain.handle(IPC.campaignDelete, (_e, id: string): void => {
    const d = db();
    // Elimina la campana y todo su contenido asociado (cascada manual).
    d.versions = d.versions.filter(
      (v) => !d.pieces.some((p) => p.id === v.pieceId && p.campaignId === id)
    );
    d.pieces = d.pieces.filter((p) => p.campaignId !== id);
    d.spreads = d.spreads.filter((s) => s.campaignId !== id);
    d.originals = d.originals.filter((o) => o.campaignId !== id);
    d.libraryImages = d.libraryImages.filter((li) => li.campaignId !== id);
    d.campaigns = d.campaigns.filter((c) => c.id !== id);
    persist();
  });
}

const DEFAULT_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

function currentSettings(): AppSettings {
  const model = getSetting('openai_model') || DEFAULT_MODEL;
  const imageModel = getSetting('openai_image_model') || DEFAULT_IMAGE_MODEL;
  return { openaiModel: model, openaiImageModel: imageModel, hasApiKey: hasApiKey() };
}

function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.settingsGet, (): AppSettings => currentSettings());

  ipcMain.handle(IPC.settingsSetApiKey, (_e, key: string): AppSettings => {
    const clean = (key || '').trim();
    if (!clean) throw new Error('La clave no puede estar vacia.');
    setApiKey(clean);
    return currentSettings();
  });

  ipcMain.handle(IPC.settingsSetModel, (_e, model: string): AppSettings => {
    const clean = (model || '').trim();
    if (!clean) throw new Error('El modelo no puede estar vacio.');
    setSetting('openai_model', clean);
    return currentSettings();
  });

  ipcMain.handle(IPC.settingsSetImageModel, (_e, model: string): AppSettings => {
    const clean = (model || '').trim();
    if (!clean) throw new Error('El modelo de imagen no puede estar vacio.');
    setSetting('openai_image_model', clean);
    return currentSettings();
  });
}

// Exportado para uso de etapas posteriores (generacion con IA).
export function resolveApiKey(): string | null {
  return getApiKey();
}
