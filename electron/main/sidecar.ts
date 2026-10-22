import { app } from 'electron';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, writeFileSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Puente hacia el sidecar de Python que hace el trabajo pesado de imagen
// (rasterizar PDFs, detectar spreads, unir pliegue, componer piezas).
//
// En desarrollo se ejecuta con el interprete del venv local.
// En produccion se ejecuta el binario empaquetado por PyInstaller.
//
// La peticion/respuesta se intercambian por ARCHIVOS (--in / --out) en lugar de
// stdin/stdout. Es mas robusto con el binario congelado y con payloads grandes
// (p. ej. imagenes en base64) en los tres sistemas operativos.

interface SidecarRequest {
  command: string;
  [key: string]: unknown;
}

interface SidecarResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

function resolveSidecar(): { cmd: string; baseArgs: string[] } {
  if (app.isPackaged) {
    // Binario incluido como extraResource (ver electron-builder.yml).
    const bin =
      process.platform === 'win32' ? 'fuller-sidecar.exe' : 'fuller-sidecar';
    return { cmd: join(process.resourcesPath, 'sidecar', bin), baseArgs: [] };
  }
  // Desarrollo: usar el Python del venv local.
  const venvPython =
    process.platform === 'win32'
      ? join(app.getAppPath(), 'python', '.venv', 'Scripts', 'python.exe')
      : join(app.getAppPath(), 'python', '.venv', 'bin', 'python');
  const script = join(app.getAppPath(), 'python', 'sidecar.py');
  const cmd = existsSync(venvPython) ? venvPython : 'python';
  return { cmd, baseArgs: [script] };
}

/**
 * Ejecuta un comando en el sidecar de Python mediante archivos de intercambio.
 */
export function callSidecar<T = unknown>(
  request: SidecarRequest
): Promise<SidecarResponse<T>> {
  const { cmd, baseArgs } = resolveSidecar();

  // Carpeta temporal para los archivos de peticion/respuesta.
  const dir = mkdtempSync(join(tmpdir(), 'fuller-'));
  const inPath = join(dir, 'in.json');
  const outPath = join(dir, 'out.json');
  writeFileSync(inPath, JSON.stringify(request), 'utf-8');

  const args = [...baseArgs, '--in', inPath, '--out', outPath];

  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));

    child.on('error', (err) => {
      cleanup(dir);
      resolve({ ok: false, error: `No se pudo iniciar el sidecar: ${err.message}` });
    });

    child.on('close', (code) => {
      try {
        if (!existsSync(outPath)) {
          resolve({
            ok: false,
            error:
              stderr.trim() ||
              `El sidecar no produjo respuesta (codigo ${code}). ` +
                'Puede faltar el componente de procesamiento.',
          });
          return;
        }
        const parsed = JSON.parse(readFileSync(outPath, 'utf-8')) as SidecarResponse<T>;
        resolve(parsed);
      } catch (e) {
        resolve({
          ok: false,
          error: `Respuesta invalida del sidecar: ${(e as Error).message}`,
        });
      } finally {
        cleanup(dir);
      }
    });
  });
}

function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignorar errores de limpieza.
  }
}
