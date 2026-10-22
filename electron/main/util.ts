import { randomUUID } from 'node:crypto';

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Convierte el nombre de una campana en un slug apto para nombres de archivo.
 * "CY26 C02" -> "CY26_C02".
 */
export function slugify(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .toUpperCase();
}

// Caracteres y nombres reservados en Windows para validar nombres de archivo.
const WINDOWS_INVALID = /[<>:"/\\|?*\u0000-\u001F]/;
const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/**
 * Valida que un nombre de archivo (SIN extension) sea valido para Windows.
 * Devuelve un mensaje de error en espanol, o null si es valido.
 */
export function validateFileName(name: string): string | null {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'El nombre no puede estar vacio.';
  if (WINDOWS_INVALID.test(trimmed)) {
    return 'El nombre contiene caracteres no permitidos: < > : " / \\ | ? *';
  }
  if (trimmed.endsWith('.') || trimmed.endsWith(' ')) {
    return 'El nombre no puede terminar en punto ni espacio.';
  }
  if (WINDOWS_RESERVED.test(trimmed)) {
    return 'Ese nombre esta reservado por el sistema. Elige otro.';
  }
  if (trimmed.length > 150) return 'El nombre es demasiado largo.';
  return null;
}
