# Fuller Ofertas — Construir, abrir y empaquetar

## Requisitos
- Node.js 20+ (probado en 24.20.0)
- Python 3.11–3.14 (probado en 3.14.7)
- Internet para la primera instalacion de dependencias y para la funcion de IA.

## 1. Instalar dependencias (una vez)
```
npm install
python -m venv python/.venv
python/.venv/Scripts/pip install -r python/requirements.txt     # Windows
# macOS/Linux:  python/.venv/bin/pip install -r python/requirements.txt
```

## 2. Compilar el componente de procesamiento (sidecar)
El sidecar es un ejecutable autonomo (no requiere Python instalado en la maquina final).
```
cd python
.venv/Scripts/pyinstaller sidecar.spec --distpath ../resources/sidecar --workpath build --noconfirm
```
Genera `resources/sidecar/fuller-sidecar(.exe)`.

## 3. Ejecutar en desarrollo
```
npm run dev
```
Abre la ventana de Electron con recarga en caliente. En dev el sidecar se ejecuta
con el Python del venv; en produccion se usa el ejecutable empaquetado.

## 4. Generar el instalador

### Windows (.exe NSIS) — PROBADO
```
npm run build
node node_modules/electron-builder/cli.js --win nsis
```
Salida: `release/Fuller Ofertas-<version>-win-x64.exe`

> Nota Windows: electron-builder necesita extraer "winCodeSign". En cuentas sin
> privilegio para crear enlaces simbolicos aparece el error
> "Cannot create symbolic link". Solucion aplicada: pre-extraer el paquete
> ignorando los symlinks de macOS (que no se usan en Windows):
> ```
> $cache="$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
> Invoke-WebRequest "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z" -OutFile "$cache\wcs.7z"
> node_modules\7zip-bin\win\x64\7za.exe x -snld "$cache\wcs.7z" "-o$cache\winCodeSign-2.6.0"
> ```
> Alternativa: activar el "Modo de desarrollador" de Windows.

### macOS (.dmg) — REQUIERE UNA MAC (no construido aun)
En una Mac con el repo y dependencias:
```
python/.venv/bin/pyinstaller python/sidecar.spec --distpath resources/sidecar --workpath python/build --noconfirm
npm run build
node node_modules/electron-builder/cli.js --mac dmg
```
- El sidecar DEBE recompilarse en macOS (PyInstaller produce binarios por plataforma).
- Sin firma: macOS mostrara una advertencia de seguridad (aceptado para el piloto).
  Para abrir: clic derecho > Abrir, o Ajustes del Sistema > Privacidad y seguridad.

### Linux (.AppImage / .deb) — REQUIERE LINUX (no construido aun)
En una maquina Linux:
```
python/.venv/bin/pyinstaller python/sidecar.spec --distpath resources/sidecar --workpath python/build --noconfirm
npm run build
node node_modules/electron-builder/cli.js --linux AppImage deb
```

## 5. Clave de OpenAI (funcion "Volver a generar")
La clave NO esta en el codigo. Se configura de dos formas:
- Variable de entorno `OPENAI_API_KEY`, o
- Pantalla "Ajustes" dentro de la app (se guarda cifrada en el almacen del sistema:
  Credential Manager en Windows, Keychain en macOS, libsecret en Linux).
El modelo tambien se configura en Ajustes (por defecto `gpt-5.6`).

## Arquitectura
- Electron (main + preload) + React/Vite (renderer).
- Sidecar Python (pypdfium2 + Pillow + numpy) para rasterizar PDF, unir el pliegue,
  componer la pieza y dibujar la etiqueta. Comunicacion por archivos JSON (--in/--out).
- Persistencia local en JSON (`userData/fuller-ofertas.json`) + archivos por campana.
- Protocolo seguro `fuller-img://` para mostrar imagenes locales en el renderer.
