// Hook de electron-builder que se ejecuta despues de empaquetar la .app y
// antes de crear el .dmg. Su trabajo es firmar (ad-hoc) el binario del sidecar
// de Python y sus librerias nativas, que electron-builder NO firma por estar
// en extraResources.
//
// Sin esto, macOS detecta una firma incoherente dentro del bundle y muestra
// "la aplicacion esta danada y no puede abrirse".
//
// Solo actua en macOS; en Windows/Linux no hace nada.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') {
    return; // Solo macOS.
  }

  const appName = packager.appInfo.productFilename; // "Fuller Ofertas"
  const appPath = path.join(appOutDir, `${appName}.app`);
  const sidecarDir = path.join(
    appPath,
    'Contents',
    'Resources',
    'sidecar',
  );

  if (!fs.existsSync(sidecarDir)) {
    console.log(`[afterPack] No se encontro el sidecar en ${sidecarDir}, se omite.`);
    return;
  }

  const entitlements = path.join(__dirname, 'entitlements.mac.plist');

  // Firma ad-hoc ("-") con runtime endurecido y entitlements. Firmamos cada
  // archivo del sidecar (binarios Mach-O: el ejecutable y sus .so/.dylib) y al
  // final la carpeta/ejecutable principal.
  const sign = (target) => {
    execFileSync(
      'codesign',
      [
        '--force',
        '--sign', '-',
        '--timestamp=none',
        '--options', 'runtime',
        '--entitlements', entitlements,
        target,
      ],
      { stdio: 'inherit' },
    );
  };

  // Recorre recursivamente y firma binarios Mach-O (desde hojas hacia la raiz).
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        // Firma todo archivo del sidecar; codesign ignora los que no son Mach-O
        // si fallara, lo intentamos y continuamos.
        try {
          sign(full);
        } catch (e) {
          // Los archivos que no son binarios Mach-O haran fallar codesign;
          // es esperado, los ignoramos.
        }
      }
    }
  };

  console.log(`[afterPack] Firmando (ad-hoc) el sidecar en ${sidecarDir}`);
  walk(sidecarDir);

  // Re-firmar el bundle completo de la app al final, para que la firma raiz
  // incluya el contenido ya firmado del sidecar.
  console.log(`[afterPack] Re-firmando el bundle ${appPath}`);
  sign(appPath);

  console.log('[afterPack] Firma ad-hoc del sidecar completada.');
};
