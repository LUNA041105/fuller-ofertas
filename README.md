# Fuller Ofertas

Aplicacion de escritorio (Windows, macOS, Linux) para convertir PDFs e imagenes
del catalogo Fuller en piezas digitales listas para compartir.

## Construir los instaladores en la nube (sin instalar nada en tu equipo)

Este repositorio incluye un flujo de GitHub Actions que compila los instaladores
de **Windows (.exe), macOS (.dmg) y Linux (.AppImage/.deb)** en servidores de
GitHub. No necesitas Node ni Python en tu computadora.

### Pasos
1. Sube este proyecto a un repositorio de GitHub (ver "Primera subida" abajo).
2. En GitHub, entra a la pestana **Actions**.
3. Abre el flujo **"Construir instaladores (Win / macOS / Linux)"**.
4. Pulsa **Run workflow** (boton a la derecha) y confirma.
5. Espera a que termine (unos minutos). Al finalizar, en la parte inferior de la
   ejecucion veras los **Artifacts**:
   - `fuller-ofertas-mac` → contiene el `.dmg`
   - `fuller-ofertas-win` → contiene el `.exe`
   - `fuller-ofertas-linux` → contiene `.AppImage` y `.deb`
6. Descarga el que necesites.

### Instalar en macOS
Abre el `.dmg`, arrastra **Fuller Ofertas** a Aplicaciones. La primera vez, como
la app no esta firmada, abrela con **clic derecho > Abrir > Abrir** (o en
Ajustes del Sistema > Privacidad y seguridad > "Abrir de todos modos").

### Clave de OpenAI
Dentro de la app, en **Ajustes**, pega tu clave de OpenAI. No se guarda en el
codigo; queda cifrada en el almacen del sistema operativo.

## Primera subida a GitHub
Desde una terminal en la carpeta del proyecto:

```
git init
git add .
git commit -m "Version inicial de Fuller Ofertas"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Reemplaza la URL por la de tu repositorio nuevo en GitHub.

## Desarrollo local
Ver `BUILD.md` para construir y ejecutar en tu propia maquina.
