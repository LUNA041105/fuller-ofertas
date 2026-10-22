import { contextBridge, ipcRenderer, clipboard, nativeImage, webUtils } from 'electron';
import { readFileSync } from 'node:fs';
import { IPC } from '../../src/shared/ipc';
import type {
  Campaign,
  OriginalFile,
  Spread,
  Piece,
  PieceVersion,
  AppSettings,
  AspectFormat,
  LibraryImage,
  LibraryYearNode,
  OfferRegion,
} from '../../src/shared/types';

// Puente seguro entre el renderer (React) y el main process.
// Solo se expone una API acotada; el renderer nunca accede directo a Node.

const api = {
  // Campanas
  listCampaigns: (): Promise<Campaign[]> => ipcRenderer.invoke(IPC.campaignList),
  createCampaign: (name: string): Promise<Campaign> =>
    ipcRenderer.invoke(IPC.campaignCreate, name),
  createOrReuseCampaign: (input: {
    year: number;
    campaignNumber: number;
  }): Promise<{ campaign: Campaign; reused: boolean }> =>
    ipcRenderer.invoke(IPC.campaignCreateOrReuse, input),
  deleteCampaign: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.campaignDelete, id),

  // Originales
  importOriginals: (campaignId: string): Promise<OriginalFile[]> =>
    ipcRenderer.invoke(IPC.originalImport, campaignId),
  importOriginalPaths: (
    campaignId: string,
    paths: string[]
  ): Promise<OriginalFile[]> =>
    ipcRenderer.invoke(IPC.originalImportPaths, campaignId, paths),
  // Obtiene la ruta absoluta de un File arrastrado (Electron webUtils).
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  listOriginals: (campaignId: string): Promise<OriginalFile[]> =>
    ipcRenderer.invoke(IPC.originalList, campaignId),
  pagePreview: (originalId: string, pageIndex: number): Promise<string> =>
    ipcRenderer.invoke(IPC.originalPagePreview, originalId, pageIndex),
  detectRegions: (originalId: string, pageIndex: number): Promise<OfferRegion[]> =>
    ipcRenderer.invoke(IPC.originalDetectRegions, originalId, pageIndex),

  // Spreads
  listSpreads: (campaignId: string): Promise<Spread[]> =>
    ipcRenderer.invoke(IPC.spreadList, campaignId),
  createSpread: (input: Partial<Spread>): Promise<Spread> =>
    ipcRenderer.invoke(IPC.spreadCreate, input),
  updateSpread: (id: string, patch: Partial<Spread>): Promise<Spread> =>
    ipcRenderer.invoke(IPC.spreadUpdate, id, patch),
  deleteSpread: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.spreadDelete, id),

  // Piezas y versiones
  listPieces: (campaignId: string): Promise<Piece[]> =>
    ipcRenderer.invoke(IPC.pieceList, campaignId),
  createPiece: (input: {
    campaignId: string;
    spreadIds: string[];
    format: AspectFormat;
  }): Promise<Piece> => ipcRenderer.invoke(IPC.pieceCreate, input),
  generatePiece: (pieceId: string): Promise<PieceVersion> =>
    ipcRenderer.invoke(IPC.pieceGenerate, pieceId),
  regeneratePiece: (pieceId: string, instruction: string): Promise<PieceVersion> =>
    ipcRenderer.invoke(IPC.pieceRegenerate, pieceId, instruction),
  listVersions: (pieceId: string): Promise<PieceVersion[]> =>
    ipcRenderer.invoke(IPC.versionList, pieceId),
  setFinalVersion: (versionId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.versionSetFinal, versionId),

  // Exportacion
  exportSingle: (versionId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.exportSingle, versionId),
  exportSelection: (versionIds: string[]): Promise<string | null> =>
    ipcRenderer.invoke(IPC.exportSelection, versionIds),
  exportZip: (campaignId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.exportZip, campaignId),
  exportVersionSingle: (input: {
    versionId: string;
    name: string;
  }): Promise<{ ok: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke(IPC.exportVersionSingle, input),
  exportZipVersions: (input: {
    items: { versionId: string; name: string }[];
    zipName?: string;
  }): Promise<{ ok: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke(IPC.exportZipVersions, input),

  // Copiar al portapapeles: se hace en el preload con acceso a clipboard/nativeImage.
  copyImageToClipboard: (imagePath: string): boolean => {
    try {
      const buffer = readFileSync(imagePath);
      const image = nativeImage.createFromBuffer(buffer);
      if (image.isEmpty()) return false;
      clipboard.writeImage(image);
      return true;
    } catch {
      return false;
    }
  },

  // Biblioteca ("Consultar ofertas")
  libraryTree: (): Promise<LibraryYearNode[]> =>
    ipcRenderer.invoke(IPC.libraryTree),
  librarySave: (input: {
    versionId: string;
    campaignId: string;
    name: string;
  }): Promise<LibraryImage> => ipcRenderer.invoke(IPC.librarySave, input),
  libraryCheckName: (input: {
    campaignId: string;
    name: string;
    exceptId?: string;
  }): Promise<{ ok: boolean; error: string | null }> =>
    ipcRenderer.invoke(IPC.libraryCheckName, input),
  libraryRename: (input: { id: string; name: string }): Promise<LibraryImage> =>
    ipcRenderer.invoke(IPC.libraryRename, input),
  libraryMove: (input: {
    id: string;
    targetCampaignId: string;
  }): Promise<LibraryImage> => ipcRenderer.invoke(IPC.libraryMove, input),
  libraryDelete: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.libraryDelete, id),
  libraryDeleteCampaign: (campaignId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.libraryDeleteCampaign, campaignId),
  libraryDeleteYear: (year: number): Promise<void> =>
    ipcRenderer.invoke(IPC.libraryDeleteYear, year),
  libraryExport: (input: {
    id: string;
    name: string;
  }): Promise<{ ok: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke(IPC.libraryExport, input),

  // Ajustes
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.settingsGet),
  setApiKey: (key: string): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.settingsSetApiKey, key),
  setModel: (model: string): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.settingsSetModel, model),
  setImageModel: (model: string): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.settingsSetImageModel, model),
};

contextBridge.exposeInMainWorld('fuller', api);

export type FullerApi = typeof api;
