import { safeStorage, app } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Manejo seguro de la API key de OpenAI.
//
// La clave NUNCA se escribe en texto plano en el codigo ni en el repositorio.
// Precedencia de lectura:
//   1. Variable de entorno OPENAI_API_KEY (comodo para desarrollo).
//   2. Almacen cifrado del sistema operativo via Electron safeStorage
//      (Credential Manager en Windows, Keychain en macOS, libsecret en Linux).
//
// safeStorage cifra con las claves del SO, de modo que el archivo en disco
// no contiene la clave legible.

const keyFile = () => join(app.getPath('userData'), 'openai.key.enc');

/** Guarda la API key cifrada en el almacen del sistema operativo. */
export function setApiKey(plain: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'El cifrado del sistema no esta disponible; no se puede guardar la clave de forma segura.'
    );
  }
  const encrypted = safeStorage.encryptString(plain.trim());
  writeFileSync(keyFile(), encrypted);
}

/** Obtiene la API key: primero del entorno, luego del almacen cifrado. */
export function getApiKey(): string | null {
  const fromEnv = process.env.OPENAI_API_KEY;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  const file = keyFile();
  if (!existsSync(file) || !safeStorage.isEncryptionAvailable()) {
    return null;
  }
  try {
    const encrypted = readFileSync(file);
    const plain = safeStorage.decryptString(encrypted);
    return plain.trim().length > 0 ? plain.trim() : null;
  } catch {
    return null;
  }
}

/** Indica si hay una clave disponible sin exponer su valor. */
export function hasApiKey(): boolean {
  return getApiKey() !== null;
}
