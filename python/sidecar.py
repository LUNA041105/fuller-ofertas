"""
Sidecar de procesamiento de imagen para Fuller Ofertas.

Recibe una peticion JSON por stdin y responde JSON por stdout:
    entrada:  {"command": "...", ...parametros}
    salida:   {"ok": true, "data": ...}  |  {"ok": false, "error": "..."}

Comandos:
    - ping           : prueba de vida y versiones de librerias.
    - inspect_file   : cuenta paginas y entrega dimensiones de un PDF o imagen.
    - rasterize_page : rasteriza una pagina (PDF) o una imagen a PNG de alta
                       resolucion y la guarda en disco.

NO redibuja contenido: todo el trabajo es composicion de pixeles del original.
"""

import sys
import json
import os
import warnings

# Silenciar warnings para que no contaminen stdout (el main process parsea JSON).
warnings.filterwarnings("ignore")

# Asegurar que el directorio del script este en sys.path para importar compose.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# DPI base para rasterizar PDFs a alta resolucion (fidelidad para celular).
RASTER_DPI = 300


def _is_pdf(path: str) -> bool:
    return path.lower().endswith(".pdf")


def inspect_file(path: str) -> dict:
    """Devuelve el numero de paginas y las dimensiones (en puntos/pixeles)."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"No existe el archivo: {path}")

    if _is_pdf(path):
        from pdfrender import pdf_page_sizes

        sizes = pdf_page_sizes(path)
        pages = [
            {
                "widthPt": round(w, 2),
                "heightPt": round(h, 2),
                "landscape": w > h,
            }
            for (w, h) in sizes
        ]
        return {"kind": "pdf", "pageCount": len(sizes), "pages": pages}

    # Imagen: una sola "pagina".
    from PIL import Image

    with Image.open(path) as img:
        w, h = img.size
    return {
        "kind": "image",
        "pageCount": 1,
        "pages": [{"widthPt": w, "heightPt": h, "landscape": w > h}],
    }


def rasterize_page(path: str, page_index: int, out_path: str, dpi: int = RASTER_DPI) -> dict:
    """
    Rasteriza una pagina de PDF (o copia/convierte una imagen) a PNG en out_path.
    Devuelve las dimensiones del PNG resultante.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"No existe el archivo: {path}")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    if _is_pdf(path):
        from pdfrender import render_pdf_page

        img = render_pdf_page(path, page_index, dpi)
        img.save(out_path, "PNG")
        return {"outPath": out_path, "width": img.width, "height": img.height}

    # Imagen: convertir a PNG conservando resolucion.
    from PIL import Image

    with Image.open(path) as img:
        rgb = img.convert("RGB")
        rgb.save(out_path, "PNG")
        w, h = rgb.size
    return {"outPath": out_path, "width": w, "height": h}


def handle(request: dict) -> dict:
    command = request.get("command")

    if command == "ping":
        info = {"python": sys.version.split()[0]}
        try:
            import pypdfium2

            info["pypdfium2"] = str(getattr(pypdfium2, "__version__", "ok"))
        except Exception as exc:  # noqa: BLE001
            info["pypdfium2_error"] = str(exc)
        try:
            import PIL

            info["pillow"] = PIL.__version__
        except Exception as exc:  # noqa: BLE001
            info["pillow_error"] = str(exc)
        return {"ok": True, "data": info}

    if command == "inspect_file":
        data = inspect_file(request["path"])
        return {"ok": True, "data": data}

    if command == "rasterize_page":
        data = rasterize_page(
            request["path"],
            int(request["pageIndex"]),
            request["outPath"],
            int(request.get("dpi", RASTER_DPI)),
        )
        return {"ok": True, "data": data}

    if command == "compose_piece":
        # Importacion diferida: numpy/compose solo se cargan al componer.
        from compose import compose_piece

        data = compose_piece(request)
        return {"ok": True, "data": data}

    if command == "fit_cover":
        from compose import fit_cover

        data = fit_cover(request)
        return {"ok": True, "data": data}

    return {"ok": False, "error": f"Comando no reconocido: {command}"}


def _read_args() -> tuple[str | None, str | None]:
    """Parsea --in <archivo> y --out <archivo> si se pasaron por linea de comandos."""
    in_path = None
    out_path = None
    argv = sys.argv[1:]
    for i, a in enumerate(argv):
        if a == "--in" and i + 1 < len(argv):
            in_path = argv[i + 1]
        elif a == "--out" and i + 1 < len(argv):
            out_path = argv[i + 1]
    return in_path, out_path


def main() -> None:
    import traceback

    in_path, out_path = _read_args()

    # Leer la peticion: desde archivo (--in) o desde stdin.
    try:
        if in_path:
            with open(in_path, "r", encoding="utf-8") as f:
                raw = f.read()
        else:
            raw = sys.stdin.read()
        request = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as exc:
        _emit({"ok": False, "error": f"JSON invalido: {exc}"}, out_path)
        return
    except Exception as exc:  # noqa: BLE001
        _emit({"ok": False, "error": f"No se pudo leer la peticion: {exc}"}, out_path)
        return

    # Ejecutar el comando con captura completa de errores (incluye traceback).
    try:
        response = handle(request)
    except Exception as exc:  # noqa: BLE001
        response = {
            "ok": False,
            "error": str(exc),
            "trace": traceback.format_exc(),
        }

    _emit(response, out_path)


def _emit(response: dict, out_path: str | None) -> None:
    """Escribe la respuesta JSON a un archivo (--out) o a stdout."""
    text = json.dumps(response)
    if out_path:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text)
    else:
        sys.stdout.write(text)
        sys.stdout.flush()


if __name__ == "__main__":
    main()
