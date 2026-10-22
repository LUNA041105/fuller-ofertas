import { ipcMain, dialog, BrowserWindow } from 'electron';
import { basename, extname, join } from 'node:path';
import { copyFileSync, existsSync } from 'node:fs';
import { IPC } from '../../src/shared/ipc';
import type { OriginalFile, OriginalKind } from '../../src/shared/types';
import { db, persist } from './db';
import { newId, nowIso } from './util';
import { originalsDir, previewsDir } from './paths';
import { callSidecar } from './sidecar';
import { toImgUrl } from './protocol';
import { detectOfferRegions } from './openai-client';
import type { OfferRegion } from '../../src/shared/types';

// Manejadores de archivos originales: importar PDFs/imagenes, listarlos y
// generar previsualizaciones rasterizadas por pagina.

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'];

function kindFromExt(path: string): OriginalKind | null {
  const ext = extname(path).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  return null;
}

interface InspectResult {
  kind: string;
  pageCount: number;
  pages: { widthPt: number; heightPt: number; landscape: boolean }[];
}

/** Importa un conjunto de rutas a la campana (copia + inspecciona). */
async function importPaths(
  campaignId: string,
  paths: string[]
): Promise<OriginalFile[]> {
  const imported: OriginalFile[] = [];
  const destDir = originalsDir(campaignId);

  for (const srcPath of paths) {
    const kind = kindFromExt(srcPath);
    if (!kind) continue;

    const id = newId();
    const ext = extname(srcPath);
    const storedPath = join(destDir, `${id}${ext}`);
    try {
      copyFileSync(srcPath, storedPath);
    } catch {
      continue; // archivo ilegible: se omite
    }

    const insp = await callSidecar<InspectResult>({
      command: 'inspect_file',
      path: storedPath,
    });
    const pageCount = insp.ok && insp.data ? insp.data.pageCount : 1;

    const original: OriginalFile = {
      id,
      campaignId,
      kind,
      displayName: basename(srcPath),
      storedPath,
      pageCount,
      createdAt: nowIso(),
    };
    db().originals.push(original);
    imported.push(original);
  }

  persist();
  return imported;
}

export function registerOriginalHandlers(): void {
  // Importa desde rutas dadas (drag & drop o seleccion del renderer).
  ipcMain.handle(
    IPC.originalImportPaths,
    async (_e, campaignId: string, paths: string[]): Promise<OriginalFile[]> => {
      if (!campaignId) throw new Error('Falta la campana.');
      if (!paths || paths.length === 0) return [];
      return importPaths(campaignId, paths);
    }
  );

  // Abre un dialogo para seleccionar archivos y los importa a la campana.
  ipcMain.handle(
    IPC.originalImport,
    async (_e, campaignId: string): Promise<OriginalFile[]> => {
      const win = BrowserWindow.getFocusedWindow() ?? undefined;
      const result = await dialog.showOpenDialog(win!, {
        title: 'Seleccionar PDFs o imagenes',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'PDF e imagenes', extensions: ['pdf', ...IMAGE_EXTS.map((e) => e.slice(1))] },
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'Imagenes', extensions: IMAGE_EXTS.map((e) => e.slice(1)) },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) return [];
      return importPaths(campaignId, result.filePaths);
    }
  );

  // Lista los originales de una campana.
  ipcMain.handle(IPC.originalList, (_e, campaignId: string): OriginalFile[] => {
    return db()
      .originals.filter((o) => o.campaignId === campaignId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

  // Genera (o reutiliza) la previsualizacion PNG de una pagina y devuelve una
  // URL de datos (file://) consumible por el renderer.
  ipcMain.handle(
    IPC.originalPagePreview,
    async (_e, originalId: string, pageIndex: number): Promise<string> => {
      const original = db().originals.find((o) => o.id === originalId);
      if (!original) throw new Error('Original no encontrado.');

      const previewPath = join(
        previewsDir(original.campaignId),
        `${originalId}_p${pageIndex}.png`
      );

      if (!existsSync(previewPath)) {
        const res = await callSidecar({
          command: 'rasterize_page',
          path: original.storedPath,
          pageIndex,
          outPath: previewPath,
          // Previsualizacion a menor DPI para rapidez; la generacion final usa 300.
          dpi: 150,
        });
        if (!res.ok) {
          throw new Error(res.error || 'No se pudo rasterizar la pagina.');
        }
      }

      // Se devuelve una URL del protocolo seguro fuller-img://.
      return toImgUrl(previewPath);
    }
  );

  // Detecta las ofertas/spreads de una pagina con IA (vision).
  // Rasteriza la pagina (reutiliza el cache de preview) y la envia a OpenAI.
  ipcMain.handle(
    IPC.originalDetectRegions,
    async (
      _e,
      originalId: string,
      pageIndex: number
    ): Promise<OfferRegion[]> => {
      const original = db().originals.find((o) => o.id === originalId);
      if (!original) throw new Error('Original no encontrado.');

      // Usa una rasterizacion de mayor resolucion para mejor deteccion.
      const detectPath = join(
        previewsDir(original.campaignId),
        `${originalId}_p${pageIndex}_detect.png`
      );
      if (!existsSync(detectPath)) {
        const res = await callSidecar({
          command: 'rasterize_page',
          path: original.storedPath,
          pageIndex,
          outPath: detectPath,
          dpi: 150,
        });
        if (!res.ok) throw new Error(res.error || 'No se pudo preparar la pagina.');
      }

      return detectOfferRegions(detectPath);
    }
  );
}
