import { ipcMain } from 'electron';
import { join } from 'node:path';
import { IPC } from '../../src/shared/ipc';
import type {
  Piece,
  PieceVersion,
  AspectFormat,
  Spread,
  Campaign,
} from '../../src/shared/types';
import { FORMAT_SPECS } from '../../src/shared/types';
import { db, persist } from './db';
import { newId, nowIso } from './util';
import { piecesDir } from './paths';
import { callSidecar } from './sidecar';
import { toImgUrl } from './protocol';
import { writeFileSync } from 'node:fs';
import {
  adaptImageToFormat,
  NEUTRAL_ADJUSTMENTS,
  type CompositionAdjustments,
} from './openai-client';

// Manejadores de piezas y versiones. Una pieza agrupa uno o varios spreads en
// un formato; cada generacion crea una PieceVersion. Se conservan todas las
// versiones para comparar y elegir la definitiva.

interface ComposeResult {
  outPath: string;
  width: number;
  height: number;
  warnings: string[];
}

/** Adjunta la URL servible a una version para el renderer. */
function withUrl(v: PieceVersion): PieceVersion {
  return { ...v, imageUrl: v.imagePath ? toImgUrl(v.imagePath) : null };
}

/** Construye el texto de etiqueta de un spread: "Spread 08 - Pags. 16-17". */
function spreadLabel(s: Spread): string {
  const base = `Spread ${s.spreadCode}`;
  if (s.catalogPages.length > 0) {
    const pages = s.catalogPages.join('-');
    return `${base} - Pags. ${pages}`;
  }
  return base;
}

/** Etiqueta de la pieza: concatena los spreads que agrupa. */
function pieceLabel(campaign: Campaign, spreads: Spread[]): string {
  const parts = spreads.map(spreadLabel);
  return `${campaign.name} - ${parts.join(' / ')}`;
}

/** Siguiente codigo de pieza incremental dentro de la campana. */
function nextPieceCode(campaignId: string): string {
  const count = db().pieces.filter((p) => p.campaignId === campaignId).length;
  return String(count + 1).padStart(2, '0');
}

/**
 * Ejecuta la composicion de una pieza y crea una nueva PieceVersion.
 * instruction es opcional (se usa al regenerar; aqui normalmente null).
 */
async function generateVersion(
  piece: Piece,
  instruction: string | null,
  adjustments: CompositionAdjustments = NEUTRAL_ADJUSTMENTS
): Promise<PieceVersion> {
  const d = db();
  const campaign = d.campaigns.find((c) => c.id === piece.campaignId);
  if (!campaign) throw new Error('Campana no encontrada.');

  const spreads = piece.spreadIds
    .map((id) => d.spreads.find((s) => s.id === id))
    .filter((s): s is Spread => Boolean(s));
  if (spreads.length === 0) throw new Error('La pieza no tiene spreads validos.');

  const spec = FORMAT_SPECS[piece.format];

  // Numero de version incremental.
  const existing = d.versions.filter((v) => v.pieceId === piece.id);
  const versionNumber = existing.length + 1;

  const versionId = newId();
  const outPath = join(
    piecesDir(piece.campaignId),
    `${piece.pieceCode}_${piece.format.replace(':', 'x')}_v${versionNumber}.png`
  );

  // Preparar la entrada para el sidecar.
  const spreadsInput = spreads.map((s) => {
    const original = d.originals.find((o) => o.id === s.originalId);
    return {
      sourcePath: original?.storedPath ?? '',
      pdfPageIndices: s.pdfPageIndices,
      isDoublePage: s.isDoublePage,
      spreadCode: s.spreadCode,
      cropRegion: s.cropRegion ?? null,
    };
  });

  const res = await callSidecar<ComposeResult>({
    command: 'compose_piece',
    spreads: spreadsInput,
    width: spec.width,
    height: spec.height,
    outPath,
    pieceLabel: pieceLabel(campaign, spreads),
    // Ajustes de composicion derivados del comentario (si hubo regeneracion).
    adjustments,
  });

  // Adaptacion generativa al formato (reacomodo con IA, sin bordes blancos).
  // Si falla (sin clave/offline), se conserva la composicion fiel como respaldo.
  const warnings = res.ok && res.data ? [...res.data.warnings] : [];
  let finalPath = res.ok && res.data ? res.data.outPath : null;
  if (res.ok && finalPath) {
    try {
      const adapted = await adaptImageToFormat(finalPath, piece.format);
      const adaptedRaw = outPath.replace(/\.png$/, '_ai.png');
      writeFileSync(adaptedRaw, adapted);
      const fitted = outPath.replace(/\.png$/, '_fit.png');
      const fitRes = await callSidecar<{ outPath: string }>({
        command: 'fit_cover',
        inPath: adaptedRaw,
        outPath: fitted,
        width: spec.width,
        height: spec.height,
      });
      if (fitRes.ok && fitRes.data) {
        finalPath = fitRes.data.outPath;
      }
    } catch (e) {
      // La adaptacion con IA es opcional; si falla se usa la composicion base.
      warnings.push(
        `No se pudo adaptar con IA (${(e as Error).message}). Se uso la composicion base.`
      );
    }
  }

  const version: PieceVersion = {
    id: versionId,
    pieceId: piece.id,
    versionNumber,
    status: res.ok ? 'done' : 'error',
    imagePath: finalPath,
    imageUrl: null,
    instruction,
    errorMessage: res.ok ? null : res.error ?? 'Error de composicion.',
    isFinal: false,
    warnings,
    createdAt: nowIso(),
  };

  d.versions.push(version);
  persist();
  return withUrl(version);
}

export function registerPieceHandlers(): void {
  ipcMain.handle(IPC.pieceList, (_e, campaignId: string): Piece[] => {
    return db()
      .pieces.filter((p) => p.campaignId === campaignId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

  ipcMain.handle(
    IPC.pieceCreate,
    (
      _e,
      input: { campaignId: string; spreadIds: string[]; format: AspectFormat }
    ): Piece => {
      if (!input.campaignId) throw new Error('Falta la campana.');
      if (!input.spreadIds || input.spreadIds.length === 0) {
        throw new Error('Una pieza debe incluir al menos un spread.');
      }
      const piece: Piece = {
        id: newId(),
        campaignId: input.campaignId,
        spreadIds: input.spreadIds,
        format: input.format,
        pieceCode: nextPieceCode(input.campaignId),
        createdAt: nowIso(),
      };
      db().pieces.push(piece);
      persist();
      return piece;
    }
  );

  ipcMain.handle(
    IPC.pieceGenerate,
    async (_e, pieceId: string): Promise<PieceVersion> => {
      const piece = db().pieces.find((p) => p.id === pieceId);
      if (!piece) throw new Error('Pieza no encontrada.');
      return generateVersion(piece, null);
    }
  );

  // "Regenerar": edita la IMAGEN ACTUAL con el comentario del usuario usando el
  // modelo de edicion de imagenes (gpt-image-2). El comentario llega DIRECTO al
  // modelo, de modo que el cambio pedido se aplica de verdad (p. ej. "haz el
  // precio mas grande"). Conserva las versiones anteriores (crea una nueva).
  ipcMain.handle(
    IPC.pieceRegenerate,
    async (_e, pieceId: string, instruction: string): Promise<PieceVersion> => {
      const d = db();
      const piece = d.pieces.find((p) => p.id === pieceId);
      if (!piece) throw new Error('Pieza no encontrada.');

      const clean = (instruction ?? '').trim();
      if (!clean) throw new Error('Escribe que quieres cambiar para regenerar.');

      // Imagen de referencia: la ultima version con imagen.
      const prior = d.versions
        .filter((v) => v.pieceId === pieceId && v.imagePath)
        .sort((a, b) => b.versionNumber - a.versionNumber)[0];
      if (!prior?.imagePath) {
        throw new Error('No hay una imagen previa para regenerar.');
      }

      const spec = FORMAT_SPECS[piece.format];
      const versionNumber =
        d.versions.filter((v) => v.pieceId === pieceId).length + 1;
      const versionId = newId();
      const outPath = join(
        piecesDir(piece.campaignId),
        `${piece.pieceCode}_${piece.format.replace(':', 'x')}_v${versionNumber}.png`
      );

      const warnings: string[] = [];
      let finalPath: string | null = null;
      let status: 'done' | 'error' = 'done';
      let errorMessage: string | null = null;

      try {
        // Edita la imagen ACTUAL con el comentario del usuario (gpt-image-2).
        const edited = await adaptImageToFormat(prior.imagePath, piece.format, clean);
        const editedRaw = outPath.replace(/\.png$/, '_ai.png');
        writeFileSync(editedRaw, edited);
        const fitRes = await callSidecar<{ outPath: string }>({
          command: 'fit_cover',
          inPath: editedRaw,
          outPath,
          width: spec.width,
          height: spec.height,
        });
        finalPath = fitRes.ok && fitRes.data ? fitRes.data.outPath : null;
        if (!finalPath) {
          status = 'error';
          errorMessage = fitRes.error || 'No se pudo ajustar la imagen regenerada.';
        }
      } catch (e) {
        status = 'error';
        errorMessage = (e as Error).message;
      }

      const version: PieceVersion = {
        id: versionId,
        pieceId,
        versionNumber,
        status,
        imagePath: finalPath,
        imageUrl: null,
        instruction: clean,
        errorMessage,
        isFinal: false,
        warnings,
        createdAt: nowIso(),
      };
      d.versions.push(version);
      persist();
      return withUrl(version);
    }
  );

  ipcMain.handle(IPC.versionList, (_e, pieceId: string): PieceVersion[] => {
    return db()
      .versions.filter((v) => v.pieceId === pieceId)
      .sort((a, b) => a.versionNumber - b.versionNumber)
      .map(withUrl);
  });

  ipcMain.handle(IPC.versionSetFinal, (_e, versionId: string): void => {
    const d = db();
    const version = d.versions.find((v) => v.id === versionId);
    if (!version) throw new Error('Version no encontrada.');
    // Solo una version definitiva por pieza.
    for (const v of d.versions) {
      if (v.pieceId === version.pieceId) v.isFinal = v.id === versionId;
    }
    persist();
  });
}

// Reutilizable por la Etapa 4 (regeneracion con IA).
export { generateVersion };
