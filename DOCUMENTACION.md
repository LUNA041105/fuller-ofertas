# Fuller Ofertas — Documento explicativo

> Documento pensado para que **cualquier persona** (técnica o no) entienda qué
> es el programa, cómo está hecho, qué puede hacer y qué implicaría llevarlo a
> un servidor. Escrito en lenguaje claro, con las partes técnicas marcadas para
> quien quiera profundizar.

---

## 1. ¿Qué es Fuller Ofertas? (en una frase)

Es un programa que toma el **catálogo de ofertas de Fuller** (en PDF o imágenes)
y lo convierte, con ayuda de inteligencia artificial, en **piezas digitales
listas para redes sociales**: imágenes recortadas y reacomodadas a los formatos
más usados (vertical 9:16 para historias, 4:5 para feed, y cuadrado 1:1).

En lugar de que una persona abra Photoshop y recorte oferta por oferta, el
programa detecta las ofertas dentro del catálogo y genera las imágenes solo.

---

## 2. ¿Para qué sirve en el día a día?

Imagina el flujo de trabajo de alguien de marketing en Fuller:

1. Llega el catálogo de la campaña del mes (un PDF grande con muchas ofertas).
2. Hay que publicar esas ofertas en Instagram, Facebook y WhatsApp.
3. Cada red social pide un formato de imagen distinto.
4. Hacerlo a mano, oferta por oferta, lleva horas.

**Fuller Ofertas automatiza eso:**

- Cargas el PDF o las imágenes del catálogo.
- El programa **detecta las ofertas** una por una.
- Para cada oferta, genera **tres versiones** (9:16, 4:5 y 1:1) reacomodadas
  por inteligencia artificial para que se vean bien en cada formato.
- Puedes **regenerar** una imagen dándole una instrucción (por ejemplo,
  "amplía el fondo" o "centra el producto").
- Exportas todo listo para publicar.

---

## 3. ¿Qué puede hacer? (alcances)

**Lo que SÍ hace hoy:**

- Importar catálogos en **PDF** o en **imágenes** (JPG/PNG).
- **Rasterizar** (convertir en imagen) las páginas de un PDF.
- **Detectar automáticamente las ofertas** dentro de una página usando visión
  por inteligencia artificial.
- Unir "pliegos" (páginas dobles que forman una sola oferta).
- Generar las piezas en los **tres formatos** (9:16, 4:5, 1:1).
- **Reacomodar** la imagen al formato con IA (no solo recortar: extiende el
  fondo y reubica elementos para que no se corte el contenido importante).
- **Regenerar** una pieza con una instrucción escrita por el usuario.
- Organizar el trabajo por **campañas** (año y número de campaña).
- Guardar una **biblioteca** de imágenes con nombre.
- **Exportar** las piezas generadas.

**Lo que NO hace (límites actuales):**

- No publica directamente en redes sociales (genera las imágenes, pero tú las
  subes).
- No funciona sin **conexión a internet** (necesita llamar a la IA de OpenAI).
- No es multiusuario: hoy es de **una persona por computadora** (ver sección 7).
- La inteligencia artificial tiene **costo por uso** (cada imagen que procesa
  consume saldo de la cuenta de OpenAI).

---

## 4. ¿Cómo está compuesto? (las piezas del programa)

El programa está hecho de **tres grandes partes** que trabajan juntas. Piénsalo
como un restaurante:

| Parte | Qué es | Analogía del restaurante |
|-------|--------|--------------------------|
| **Interfaz (lo que ves)** | Las pantallas, botones y vistas | El comedor y el menú |
| **Núcleo (el coordinador)** | Decide qué hacer y guarda los datos | El mesero que toma la orden y la lleva |
| **Sidecar de imagen** | Hace el trabajo pesado con las imágenes | La cocina |

A esto se suma un cuarto actor **externo**: la **inteligencia artificial de
OpenAI**, que vive en internet (no dentro del programa).

### 4.1 La interfaz (lo que el usuario ve)

- Hecha con **React** (una tecnología web muy común para construir pantallas).
- Es donde el usuario crea campañas, carga el catálogo, revisa las ofertas
  detectadas y descarga los resultados.
- Vistas principales: inicio, crear/consultar campaña, ajustes.

### 4.2 El núcleo (el coordinador)

- Hecho con **Electron** (tecnología que permite que una página web funcione
  como un programa de escritorio instalable).
- Coordina todo: recibe lo que pide el usuario, llama a la cocina (sidecar),
  habla con la inteligencia artificial y **guarda los datos**.
- Aquí vive la seguridad de la clave de OpenAI (se guarda **cifrada**).

### 4.3 El sidecar de imagen (la cocina)

- Hecho en **Python**, un programa aparte que se empaqueta junto con la app.
- Hace las tareas que requieren fuerza bruta de imagen:
  - Convertir páginas de PDF en imágenes (con la librería **pypdfium2**).
  - Recortar ofertas, unir pliegos, ajustar al formato (con **Pillow** y
    **numpy**).
- Se llama "sidecar" (acompañante) porque va "al lado" del programa principal,
  como un sidecar de motocicleta.

### 4.4 La inteligencia artificial (externa)

- Se usa la IA de **OpenAI**.
- Dos usos: **ver** el catálogo para detectar dónde están las ofertas, y
  **generar/reacomodar** las imágenes a cada formato.
- Vive en los servidores de OpenAI, no dentro del programa. Por eso se necesita
  internet y una **clave (API key)**.

---

## 5. ¿Cómo está hecho por dentro? (resumen técnico)

> Esta sección es para perfiles técnicos. Si no lo eres, puedes saltarla.

**Tecnologías:**

- **Electron 32** + **React 18** + **TypeScript** — aplicación de escritorio.
- **Vite** — empaquetador del front-end.
- **Python 3.12** con **pypdfium2**, **Pillow** y **numpy** — motor de imagen.
- **PyInstaller** — empaqueta el Python en un único ejecutable por plataforma.
- **electron-builder** — genera los instaladores (.dmg, .exe, .AppImage/.deb).
- **GitHub Actions** — compila los instaladores de los tres sistemas en la nube.

**Comunicación entre partes:**

- La interfaz habla con el núcleo mediante **IPC** (mensajes internos de
  Electron).
- El núcleo habla con el sidecar de Python pasándole **archivos JSON**
  (`--in` / `--out`), lo que es robusto para cargas grandes (imágenes en base64).
- El núcleo habla con OpenAI por **HTTPS** (internet).

**Dónde se guardan los datos (clave para la sección del servidor):**

- Todo el contenido del usuario vive **en el disco de la propia computadora**,
  en la carpeta de datos de la aplicación (`userData` del sistema operativo):
  - `fuller-ofertas.json` — base de datos ligera (campañas, ofertas, piezas) en
    un solo archivo JSON.
  - `campaigns/<id>/originals` — los PDFs/imágenes originales.
  - `campaigns/<id>/pieces` — las imágenes generadas.
  - `campaigns/<id>/previews` — previsualizaciones.
  - `openai.key.enc` — la clave de OpenAI, **cifrada** con el almacén del
    sistema operativo (Keychain en macOS, Credential Manager en Windows,
    libsecret en Linux).

**Seguridad de la clave de OpenAI:**

- Nunca se escribe en el código ni se sube al repositorio.
- Cada usuario la pone una vez en **Ajustes**; queda cifrada en su equipo.

---

## 6. ¿Cómo se instala y distribuye hoy?

- Los instaladores se generan en la nube con **GitHub Actions** (no hace falta
  instalar Node ni Python para compilarlos).
- Se descargan tres instaladores: `.dmg` (Mac), `.exe` (Windows) y
  `.AppImage`/`.deb` (Linux).
- Como la app **no está firmada por Apple ni por Microsoft** (eso tiene un costo
  anual con cada fabricante), la primera vez que se abre, el sistema muestra un
  aviso de seguridad que el usuario debe aceptar una sola vez.

---

## 7. Por qué hoy "vive en una sola máquina" y qué significa llevarlo al servidor

Esta es la parte más importante del documento, así que va con detalle y
honestidad.

### 7.1 Cómo está diseñado hoy

Fuller Ofertas es, por diseño, una **aplicación de escritorio**. Eso significa:

- Se **instala en cada computadora**.
- **Cada quien guarda sus propios datos en su propio disco.** Si María usa la
  app en su PC y Juan en la suya, **no comparten** campañas ni imágenes: son dos
  islas separadas.
- La información **no está centralizada** en ningún lado.

Esto es cómodo para empezar (no hay que montar nada, cada quien instala y usa),
pero choca con lo que el equipo quiere: que **la información viva en el servidor
de la empresa**, no en la máquina de una persona.

### 7.2 Por qué quieren moverlo al servidor (es una petición razonable)

- **Que no dependa de una sola computadora.** Si esa máquina se daña, se pierde
  o la persona se va, el trabajo se pierde con ella.
- **Que varias personas compartan** las campañas y los resultados.
- **Respaldo y control centralizado** de la información de la empresa.
- **Acceso desde cualquier equipo**, no solo desde el que tiene la app instalada.

### 7.3 Qué significa realmente "llevarlo al servidor"

Aquí hay que ser claro: **no es simplemente copiar la app a un servidor y
listo.** La app de escritorio actual está pensada para correr en la computadora
de un usuario, con su pantalla y su disco. Un servidor normalmente no tiene a
nadie sentado frente a él.

Hay dos caminos posibles, de menor a mayor esfuerzo:

#### Camino A — Almacenamiento compartido (cambio pequeño/mediano)

La app sigue instalándose en cada computadora, **pero los datos dejan de vivir
en el disco local y pasan a vivir en el servidor** (una carpeta de red o una
base de datos central).

- **Ventaja:** varias personas ven las mismas campañas; hay un único lugar con
  la información; se puede respaldar fácil.
- **Lo que hay que cambiar:** la capa que hoy guarda en archivos locales
  (el `fuller-ofertas.json` y las carpetas de imágenes) debe apuntar a un
  almacenamiento central. Es un cambio acotado, pero real.
- **Limitación:** sigue necesitando instalar la app en cada equipo.

#### Camino B — Convertirlo en aplicación web (cambio grande)

La app deja de instalarse y pasa a vivir **completa en el servidor**. Los
usuarios la usan **desde el navegador** (como abrir una página), sin instalar
nada.

- **Ventaja:** es exactamente lo que suele querer decir "que viva en el
  servidor": acceso desde cualquier equipo, cero instalación, datos
  centralizados, actualizaciones en un solo lugar.
- **Lo que hay que cambiar:** es una **reingeniería**. La parte de pantallas
  (React) se puede reaprovechar bastante, pero el núcleo de Electron y el
  sidecar de Python tendrían que rehacerse como **servicios del servidor**
  (un backend). También hay que resolver usuarios, permisos, y el manejo de la
  clave de OpenAI de forma central y segura.
- **Consideración de costo:** la IA de OpenAI se seguiría pagando por uso, pero
  ahora centralizado (una sola cuenta/clave de la empresa en el servidor, en
  lugar de una por persona).

### 7.4 Recomendación honesta

- Si lo que más urge es **no depender de una máquina y poder respaldar**, el
  **Camino A** (datos en el servidor, app aún instalada) es el más rápido de
  lograr.
- Si la meta es **que cualquiera entre desde el navegador sin instalar nada**,
  entonces es el **Camino B** (app web), que es un proyecto más grande pero es
  la solución "de verdad" a lo que están pidiendo.

Ambos son posibles. La diferencia es cuánto trabajo y tiempo implica cada uno.
Lo que hoy existe (la app de escritorio) es una base sólida y funcional para
decidir, con calma, hacia cuál de los dos caminos moverse.

---

## 8. Resumen en 5 puntos

1. **Qué es:** un programa que convierte catálogos de ofertas (PDF/imágenes) en
   piezas listas para redes sociales, usando IA.
2. **De qué está hecho:** una interfaz (React), un coordinador de escritorio
   (Electron) y un motor de imágenes (Python), más la IA de OpenAI por internet.
3. **Cómo se usa:** se instala en la computadora, se carga el catálogo, se
   detectan y generan las ofertas en tres formatos, y se exportan.
4. **Dónde guarda los datos hoy:** en el disco de cada computadora (por eso hoy
   "vive" en una sola máquina).
5. **Para llevarlo al servidor:** hay dos caminos — datos centralizados con la
   app aún instalada (más rápido), o convertirlo en app web completa (más
   trabajo, pero es la solución ideal a lo que piden).

---

*Documento generado para explicar Fuller Ofertas a cualquier persona del equipo,
técnica o no.*
