// Hook de electron-builder que se ejecuta despues de empaquetar la .app y
// antes de crear el .dmg.
//
// Como en electron-builder.yml dejamos `identity: null` (electron-builder NO
// firma), ESTE hook hace TODA la firma ad-hoc del bundle:
//   1. Firma el binario del sidecar de Python y sus librerias (.so/.dylib).
//   2. Firma el ejecutable principal de Electron y sus frameworks.
//   3. Firma el bundle .app completo como raiz.
//
// La firma ad-hoc ("-") no requiere certificado de Apple, pero deja el bundle
// COHERENTE para que macOS no lo marque como "danado".
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
  const entitlements = path.join(__dirname, 'entitlements.mac.plist');

  if (!fs.existsSync(appPath)) {
    console.log(`[afterPack] No se encontro la app en ${appPath}, se omite.`);
    return;
  }

  // Firma ad-hoc con runtime endurecido y entitlements.
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

  // Determina si un archivo es un binario Mach-O (ejecutable o libreria nativa).
  const isMachO = (file) => {
    try {
      const fd = fs.openSync(file, 'r');
      const buf = Buffer.alloc(4);
      fs.readSync(fd, buf, 0, 4, 0);
      fs.closeSync(fd);
      const magic = buf.readUInt32BE(0);
      // Magias Mach-O (32/64 bits, big/little endian) y FAT/universal.
      return (
        magic === 0xfeedface || // MH_MAGIC
        magic === 0xcefaedfe || // MH_CIGAM
        magic === 0xfeedfacf || // MH_MAGIC_64
        magic === 0xcffaedfe || // MH_CIGAM_64
        magic === 0xcafebabe || // FAT_MAGIC
        magic === 0xbebafeca    // FAT_CIGAM
      );
    } catch {
      return false;
    }
  };

  // Recorre recursivamente, firmando binarios Mach-O desde las hojas hacia la
  // raiz (las dependencias deben firmarse antes que lo que las contiene).
  const signTree = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        signTree(full);
        // Firmar bundles anidados (.framework, .app, helpers) como unidad.
        if (/\.(framework|app)$/.test(entry.name)) {
          try { sign(full); } catch { /* se re-firma al final */ }
        }
      } else if (entry.isFile() && isMachO(full)) {
        try {
          sign(full);
        } catch (e) {
          console.log(`[afterPack] aviso: no se pudo firmar ${full}: ${e.message}`);
        }
      }
    }
  };

  console.log(`[afterPack] Firmando (ad-hoc) todo el contenido de ${appPath}`);
  signTree(path.join(appPath, 'Contents'));

  // Firma final del bundle completo como raiz.
  console.log(`[afterPack] Re-firmando el bundle raiz ${appPath}`);
  sign(appPath);

  // Verificacion inmediata (falla el build si la firma quedo incoherente).
  console.log('[afterPack] Verificando la firma...');
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    stdio: 'inherit',
  });

  console.log('[afterPack] Firma ad-hoc completada y verificada.');
};
