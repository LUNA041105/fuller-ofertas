import { protocol, net } from 'electron';
import { pathToFileURL } from 'node:url';
import { normalize, sep } from 'node:path';
import { userDataRoot } from './paths';

// Protocolo seguro para servir imagenes locales (previsualizaciones y piezas)
// al renderer sin exponer todo el sistema de archivos ni relajar el CSP.
//
// Solo se sirven archivos que esten dentro de la carpeta de datos de la app.
// El renderer usa URLs como: fuller-img:///ruta/absoluta/al/archivo.png

export const IMG_SCHEME = 'fuller-img';

/** Debe llamarse ANTES de app.whenReady (requisito de Electron). */
export function registerImgSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: IMG_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

/** Debe llamarse DESPUES de app.whenReady. */
export function registerImgProtocol(): void {
  protocol.handle(IMG_SCHEME, (request) => {
    // URL forma: fuller-img://local/<ruta-absoluta-encodeada>
    const url = new URL(request.url);
    const encoded = url.pathname.replace(/^\//, '');
    const filePath = normalize(decodeURIComponent(encoded));

    // Seguridad: solo servir dentro de la carpeta de datos del usuario.
    const root = normalize(userDataRoot());
    if (!filePath.startsWith(root + sep) && filePath !== root) {
      return new Response('Acceso denegado', { status: 403 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

/** Construye una URL servible para una ruta absoluta de archivo. */
export function toImgUrl(absolutePath: string): string {
  return `${IMG_SCHEME}://local/${encodeURIComponent(absolutePath)}`;
}
