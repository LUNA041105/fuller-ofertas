# PyInstaller spec para el sidecar de Fuller Ofertas.
# Empaqueta sidecar.py + compose.py + la fuente serif en un unico ejecutable.
#
# Uso (desde la carpeta python, con el venv activo):
#   pyinstaller sidecar.spec --distpath ../resources/sidecar --workpath build --noconfirm
#
# El separador de --add-data es ';' en Windows y ':' en macOS/Linux, pero al
# usar el spec lo indicamos como tuplas (origen, destino) que son portables.

import os
from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

# Incluir la fuente serif como dato, en la subcarpeta "assets/fonts".
datas = [
    (os.path.join('assets', 'fonts', 'serif.ttf'), os.path.join('assets', 'fonts')),
]
binaries = []
hiddenimports = ['compose', 'pdfrender']

# Recolectar TODO lo de pypdfium2 (incluye el binario nativo de PDFium) y de
# PIL/numpy, para que el binario onefile funcione sin instalacion externa.
for pkg in ('pypdfium2', 'pypdfium2_raw', 'PIL', 'numpy'):
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception:
        pass

a = Analysis(
    ['sidecar.py'],
    pathex=['.'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='fuller-sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
