import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

// Centraliza las rutas del almacen local de la aplicacion.
// Todo el contenido del usuario (campanas, originales, resultados) vive aqui
// para cumplir el requisito de conservar la informacion localmente.

export function userDataRoot(): string {
  return app.getPath('userData');
}

export function dbPath(): string {
  return join(userDataRoot(), 'fuller-ofertas.db');
}

/** Carpeta base donde se guardan los archivos de una campana. */
export function campaignDir(campaignId: string): string {
  const dir = join(userDataRoot(), 'campaigns', campaignId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Subcarpeta para los archivos originales de una campana. */
export function originalsDir(campaignId: string): string {
  const dir = join(campaignDir(campaignId), 'originals');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Subcarpeta para las imagenes generadas de una campana. */
export function piecesDir(campaignId: string): string {
  const dir = join(campaignDir(campaignId), 'pieces');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Cache de previsualizaciones rasterizadas. */
export function previewsDir(campaignId: string): string {
  const dir = join(campaignDir(campaignId), 'previews');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Subcarpeta de la biblioteca administrada (imagenes guardadas con nombre). */
export function libraryDir(campaignId: string): string {
  const dir = join(campaignDir(campaignId), 'library');
  mkdirSync(dir, { recursive: true });
  return dir;
}
