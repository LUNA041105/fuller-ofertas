# Fuller Ofertas

Aplicación de escritorio (Windows, macOS y Linux) que convierte el **catálogo de
ofertas de Fuller** (en PDF o imágenes) en **piezas digitales listas para redes
sociales**, usando inteligencia artificial.

En lugar de recortar oferta por oferta a mano, la app detecta las ofertas dentro
del catálogo y genera, para cada una, tres versiones listas para publicar:
vertical **9:16** (historias), **4:5** (feed) y cuadrado **1:1**.

> ¿Quieres una explicación a fondo (para público técnico y no técnico) de qué es,
> cómo está hecho y qué implicaría llevarlo a un servidor? Lee **[DOCUMENTACION.md](DOCUMENTACION.md)**.

---

## 1. ¿Qué hace?

- Importa catálogos en **PDF** o en **imágenes** (JPG/PNG).
- **Detecta automáticamente las ofertas** dentro de cada página usando visión por IA.
- Une "pliegos" (páginas dobles que forman una sola oferta).
- Genera cada pieza en **tres formatos** (9:16, 4:5, 1:1), reacomodando la imagen
  con IA para que no se corte el contenido importante.
- Permite **regenerar** una pieza con una instrucción escrita (ej. "centra el producto").
- Organiza el trabajo por **campañas** y guarda una **biblioteca** de imágenes.
- **Exporta** las piezas generadas, listas para subir a redes.

**Límites actuales:** no publica directamente en redes (tú subes las imágenes),
necesita **internet** y una **clave de OpenAI**, y cada computadora guarda sus
propios datos de forma local.

---

## 2. ¿Cómo funciona por dentro? (resumen)

La app tiene tres partes que trabajan juntas, más la IA de OpenAI (externa):

| Parte | Tecnología | Qué hace |
|-------|-----------|----------|
| **Interfaz** (lo que ves) | React + Vite | Pantallas para crear campañas, revisar ofertas y exportar |
| **Núcleo** (coordinador) | Electron (TypeScript) | Coordina todo, guarda los datos y protege la clave de OpenAI |
| **Sidecar de imagen** (motor) | Python (pypdfium2, Pillow, numpy) | Rasteriza PDFs, recorta, une pliegos y ajusta al formato |
| **IA** (externa) | OpenAI | Detecta las ofertas y genera/reacomoda las imágenes |

Los datos del usuario se guardan **localmente** en la carpeta de datos de la app
(`userData` del sistema). La clave de OpenAI nunca se escribe en el código: queda
**cifrada** en el almacén seguro del sistema operativo (Credential Manager en
Windows, Keychain en macOS, libsecret en Linux).

---

## 3. Instalar la app ya compilada (lo más fácil, sin programar)

Si solo quieres **usar** el programa en la máquina de trabajo y no modificar el
código, usa el instalador. No necesitas Node ni Python.

### 3.1 Conseguir el instalador

Este repositorio compila los instaladores en la nube con **GitHub Actions**:

1. En GitHub, abre la pestaña **Actions**.
2. Entra al flujo **"Construir instaladores (Win / macOS / Linux)"**.
3. Pulsa **Run workflow** y espera unos minutos.
4. Al terminar, descarga los **Artifacts**:
   - `fuller-ofertas-win` → el `.exe` (Windows)
   - `fuller-ofertas-mac` → el `.dmg` (macOS)
   - `fuller-ofertas-linux` → el `.AppImage` y `.deb` (Linux)

### 3.2 Instalar

- **Windows:** ejecuta el `.exe` y sigue el asistente. Como la app no está firmada,
  Windows puede mostrar un aviso de SmartScreen: pulsa **Más información > Ejecutar
  de todas formas** (solo la primera vez).
- **macOS:** abre el `.dmg` y arrastra **Fuller Ofertas** a Aplicaciones. La primera
  vez, abre con **clic derecho > Abrir > Abrir** (o en Ajustes del Sistema >
  Privacidad y seguridad > "Abrir de todos modos").
- **Linux:** da permisos de ejecución al `.AppImage` y ábrelo, o instala el `.deb`.

### 3.3 Configurar la clave de OpenAI

Abre la app, entra a **Ajustes** y pega tu clave de OpenAI. Se guarda cifrada en
tu equipo; no queda en el código. Ahí mismo puedes elegir el modelo a usar.

> La IA de OpenAI tiene **costo por uso**: cada imagen que procesa consume saldo
> de la cuenta de OpenAI asociada a la clave.

---

## 4. Instalar para desarrollo (ejecutar y modificar el código)

Usa esto si vas a trabajar sobre el código en tu máquina.

### 4.1 Requisitos previos

Instala estas herramientas antes de empezar:

- **Node.js 20 o superior** — https://nodejs.org (incluye `npm`).
- **Python 3.11 a 3.14** — https://www.python.org/downloads
  (en Windows, marca "Add Python to PATH" durante la instalación).
- **Git** — https://git-scm.com
- **Conexión a internet** (para instalar dependencias y para la función de IA).

### 4.2 Descargar el código

```bash
git clone https://github.com/LUNA041105/fuller-ofertas.git
cd fuller-ofertas
```

### 4.3 Instalar dependencias (una sola vez)

```bash
# Dependencias de la interfaz y el núcleo (Node)
npm install

# Entorno y dependencias del motor de imagen (Python)
python -m venv python/.venv

# Instalar las librerías de Python dentro del entorno:
#   Windows:
python/.venv/Scripts/pip install -r python/requirements.txt
#   macOS / Linux:
python/.venv/bin/pip install -r python/requirements.txt
```

### 4.4 Compilar el sidecar de Python (una sola vez)

El sidecar es un ejecutable autónomo; así la máquina final no necesita Python.

```bash
# Windows
python/.venv/Scripts/pyinstaller python/sidecar.spec --distpath resources/sidecar --workpath python/build --noconfirm

# macOS / Linux
python/.venv/bin/pyinstaller python/sidecar.spec --distpath resources/sidecar --workpath python/build --noconfirm
```

### 4.5 Ejecutar en modo desarrollo

```bash
npm run dev
```

Se abre la ventana de Electron con recarga en caliente.

### 4.6 Configurar la clave de OpenAI (desarrollo)

Dos opciones:

- Dentro de la app, en **Ajustes** (se guarda cifrada), **o**
- Copiar `.env.example` como `.env` y poner tu clave en `OPENAI_API_KEY`.
  El archivo `.env` está en `.gitignore` y **nunca** se sube al repositorio.

---

## 5. Generar los instaladores en tu propia máquina (opcional)

Si no quieres usar GitHub Actions y prefieres compilar localmente, consulta la
guía detallada en **[BUILD.md](BUILD.md)** (incluye notas por sistema operativo).

Resumen:

```bash
npm run build
# Windows:
node node_modules/electron-builder/cli.js --win nsis
# macOS (requiere una Mac):
node node_modules/electron-builder/cli.js --mac dmg
# Linux (requiere Linux):
node node_modules/electron-builder/cli.js --linux AppImage deb
```

---

## 6. Estructura del proyecto

```
electron/        Núcleo de escritorio (proceso main + preload) en TypeScript
src/             Interfaz (React + Vite)
python/          Motor de imagen (sidecar) y sus dependencias
.github/         Flujo de GitHub Actions que compila los instaladores
electron-builder.yml   Configuración de empaquetado
BUILD.md         Guía técnica para compilar y empaquetar
DOCUMENTACION.md Explicación completa del programa (técnica y no técnica)
```

Las carpetas generadas (`node_modules/`, `dist/`, `dist-electron/`, `release/`,
`resources/sidecar/`, `python/.venv/`) y los secretos (`.env`) **no** se versionan:
están en `.gitignore`.

---

*Proyecto privado de Fuller. Uso interno.*
