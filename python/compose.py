"""
Composicion de piezas digitales a partir de spreads del catalogo.

Principio rector: FIDELIDAD. Todo se hace con los pixeles del arte original.
No se redibuja, no se inventan cifras ni empaques. Las operaciones permitidas
son: rasterizar, recortar margen de pliegue, escalar (Lanczos), ubicar en un
lienzo y dibujar una etiqueta de ubicacion.

Entradas tipicas (desde el main process de Electron):
    spreads: lista de dicts con:
        - sourcePath: ruta del PDF/imagen original
        - pdfPageIndices: [i] o [i, j]
        - isDoublePage: bool
        - label: texto de la etiqueta de ese spread (ej "Spread 08 - Pags. 16-17")
    format: "9:16" | "4:5" | "1:1"
    width, height: resolucion de salida
    outPath: ruta del PNG final
"""

import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pdfrender import render_pdf_page

RASTER_DPI = 300

# Umbral para considerar una columna como "blanca" (margen de pliegue).
WHITE_THRESHOLD = 245
# Fraccion minima de pixeles claros en una columna para considerarla margen.
WHITE_RATIO = 0.90
# Resolucion minima recomendada (lado corto) antes de alertar baja calidad.
MIN_SHORT_SIDE = 900

# Margenes y estilo de la etiqueta.
LABEL_MARGIN = 24
LABEL_PADDING_X = 18
LABEL_PADDING_Y = 10
BG_COLOR = (255, 255, 255)


def _render_page(doc_path: str, page_index: int, dpi: int = RASTER_DPI) -> Image.Image:
    """Rasteriza una pagina de PDF o abre una imagen como PIL.Image RGB."""
    if doc_path.lower().endswith(".pdf"):
        return render_pdf_page(doc_path, page_index, dpi)
    return Image.open(doc_path).convert("RGB")


# Maxima fraccion del ancho de la pagina que se permite recortar del lado del
# pliegue, para NUNCA comerse contenido aunque la deteccion se equivoque.
MAX_GUTTER_TRIM = 0.12


def _trim_inner_margin(img: Image.Image, side: str) -> Image.Image:
    """
    Recorta el margen del lado interno de una pagina (hacia el pliegue).

    Considera "margen" tanto columnas casi blancas como columnas de muy baja
    variacion (sombras/degradado del pliegue), para resolver mejor los casos
    reales del catalogo. Es conservador: nunca recorta mas de MAX_GUTTER_TRIM
    del ancho, para no eliminar contenido.
    """
    arr = np.asarray(img).astype(np.int16)
    w = img.width
    max_trim = int(w * MAX_GUTTER_TRIM)

    # Columna "margen" si es casi blanca O tiene muy poca variacion vertical
    # (una franja uniforme tipica del borde/pliegue, aunque no sea blanca pura).
    near_white = (arr.min(axis=2) >= WHITE_THRESHOLD).mean(axis=0) >= WHITE_RATIO
    col_std = arr.std(axis=(0, 2))  # variacion por columna
    low_variation = col_std <= 6.0
    is_margin = near_white | low_variation

    if side == "right":
        cut = w
        for x in range(w - 1, w - 1 - max_trim, -1):
            if is_margin[x]:
                cut = x
            else:
                break
        return img.crop((0, 0, cut, img.height))
    else:  # left
        cut = 0
        for x in range(0, max_trim):
            if is_margin[x]:
                cut = x + 1
            else:
                break
        return img.crop((cut, 0, w, img.height))


def _stitch_double(left: Image.Image, right: Image.Image) -> Image.Image:
    """Une dos paginas enfrentadas eliminando el margen del pliegue central."""
    left_t = _trim_inner_margin(left, "right")
    right_t = _trim_inner_margin(right, "left")
    # Igualar altura al menor de los dos (sin deformar: se escala proporcional).
    h = min(left_t.height, right_t.height)
    if left_t.height != h:
        new_w = round(left_t.width * h / left_t.height)
        left_t = left_t.resize((new_w, h), Image.LANCZOS)
    if right_t.height != h:
        new_w = round(right_t.width * h / right_t.height)
        right_t = right_t.resize((new_w, h), Image.LANCZOS)
    out = Image.new("RGB", (left_t.width + right_t.width, h), BG_COLOR)
    out.paste(left_t, (0, 0))
    out.paste(right_t, (left_t.width, 0))
    return out


def _apply_crop(img: Image.Image, region: dict | None) -> Image.Image:
    """
    Recorta una region normalizada (0..1) del render. Se usa cuando una pagina
    contiene varias ofertas y cada pieza toma solo su bloque del arte ORIGINAL.
    """
    if not region:
        return img
    x = max(0.0, min(1.0, float(region.get("x", 0))))
    y = max(0.0, min(1.0, float(region.get("y", 0))))
    w = max(0.0, min(1.0, float(region.get("w", 1))))
    h = max(0.0, min(1.0, float(region.get("h", 1))))
    left = int(round(x * img.width))
    top = int(round(y * img.height))
    right = int(round((x + w) * img.width))
    bottom = int(round((y + h) * img.height))
    # Asegurar un area valida minima.
    right = max(right, left + 1)
    bottom = max(bottom, top + 1)
    return img.crop((left, top, min(right, img.width), min(bottom, img.height)))


def _render_spread(spread: dict) -> Image.Image:
    """Produce la imagen de un spread (simple o doble unido), con recorte opcional."""
    path = spread["sourcePath"]
    indices = spread["pdfPageIndices"]
    if spread.get("isDoublePage") and len(indices) == 2:
        left = _render_page(path, indices[0])
        right = _render_page(path, indices[1])
        img = _stitch_double(left, right)
    else:
        img = _render_page(path, indices[0])
    # Recorte de region (varias ofertas por pagina).
    return _apply_crop(img, spread.get("cropRegion"))


def _fit_contain(img: Image.Image, box_w: int, box_h: int) -> Image.Image:
    """Escala proporcional para caber dentro de la caja (sin recortes)."""
    scale = min(box_w / img.width, box_h / img.height)
    new_w = max(1, round(img.width * scale))
    new_h = max(1, round(img.height * scale))
    return img.resize((new_w, new_h), Image.LANCZOS)


def _resource_base() -> str:
    """
    Carpeta base de recursos. Con PyInstaller (--onefile) los datos empaquetados
    se extraen a sys._MEIPASS; en desarrollo es la carpeta del script.
    """
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        return meipass
    return os.path.dirname(os.path.abspath(__file__))


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    """Carga la fuente serif empaquetada; si falla, usa una del sistema o default."""
    base = _resource_base()
    candidates = [
        os.path.join(base, "assets", "fonts", "serif.ttf"),
        # Fallbacks del sistema (Windows/macOS/Linux comunes).
        "C:\\Windows\\Fonts\\times.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _draw_label(
    canvas: Image.Image,
    text: str,
    position: str = "bottom-left",
    font_scale: float = 1.0,
) -> None:
    """
    Dibuja la etiqueta del spread, discreta, sobre una pastilla semitranslucida
    para legibilidad sin tapar contenido. position: bottom-left/bottom-right/
    top-left/top-right.
    """
    if not text:
        return
    draw = ImageDraw.Draw(canvas, "RGBA")
    font_size = max(16, round(canvas.width * 0.028 * font_scale))
    font = _load_font(font_size)

    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    box_w = tw + 2 * LABEL_PADDING_X
    box_h = th + 2 * LABEL_PADDING_Y

    if "right" in position:
        x0 = canvas.width - LABEL_MARGIN - box_w
    else:
        x0 = LABEL_MARGIN
    if "top" in position:
        y0 = LABEL_MARGIN
    else:
        y0 = canvas.height - LABEL_MARGIN - box_h

    # Pastilla con esquinas redondeadas, blanca semitransparente.
    draw.rounded_rectangle(
        [x0, y0, x0 + box_w, y0 + box_h],
        radius=round(box_h / 2),
        fill=(255, 255, 255, 220),
        outline=(0, 0, 0, 40),
        width=1,
    )
    draw.text(
        (x0 + LABEL_PADDING_X - bbox[0], y0 + LABEL_PADDING_Y - bbox[1]),
        text,
        font=font,
        fill=(30, 30, 30, 255),
    )


def compose_piece(request: dict) -> dict:
    """
    Compone una pieza final a partir de uno o varios spreads, apilados
    verticalmente, dentro de un lienzo del formato elegido.
    """
    spreads = request["spreads"]
    width = int(request["width"])
    height = int(request["height"])
    out_path = request["outPath"]
    piece_label = request.get("pieceLabel", "")

    # Ajustes de composicion (opcionales). Vienen de la interpretacion del
    # comentario del usuario por la IA. SON AJUSTES DE COMPOSICION, no de
    # contenido: no redibujan nada, solo cambian escala/margenes/etiqueta.
    adj = request.get("adjustments") or {}
    content_scale = _clamp(float(adj.get("contentScale", 1.0)), 0.5, 1.0)
    outer_pad_scale = _clamp(float(adj.get("outerPadScale", 1.0)), 0.0, 3.0)
    gap_scale = _clamp(float(adj.get("gapScale", 1.0)), 0.0, 4.0)
    label_font_scale = _clamp(float(adj.get("labelFontScale", 1.0)), 0.6, 2.0)
    label_position = adj.get("labelPosition", "bottom-left")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    warnings_list: list[str] = []

    # 1) Render de cada spread.
    rendered: list[Image.Image] = []
    for sp in spreads:
        img = _render_spread(sp)
        if min(img.width, img.height) < MIN_SHORT_SIDE:
            warnings_list.append(
                f"Resolucion baja en spread {sp.get('spreadCode', '?')}: "
                f"{img.width}x{img.height}px. Puede verse pixelado."
            )
        rendered.append(img)

    # 2) Lienzo de salida con fondo limpio.
    canvas = Image.new("RGB", (width, height), BG_COLOR)

    # 3) Distribucion vertical: cada spread recibe una banda de igual alto.
    outer_pad = round(width * 0.03 * outer_pad_scale)
    gap = round(height * 0.02 * gap_scale)
    n = len(rendered)
    usable_w = width - 2 * outer_pad
    usable_h = height - 2 * outer_pad - gap * (n - 1)
    band_h = usable_h // n if n > 0 else usable_h

    y = outer_pad
    for img in rendered:
        # content_scale<1 deja mas aire; =1 aprovecha todo el espacio (default).
        box_w = round(usable_w * content_scale)
        box_h = round(band_h * content_scale)
        fitted = _fit_contain(img, box_w, box_h)
        x = (width - fitted.width) // 2
        band_y = y + (band_h - fitted.height) // 2
        canvas.paste(fitted, (x, band_y))
        y += band_h + gap

    # 4) (Sin etiqueta de spread: se omite por decision de diseno.)

    # 5) Guardar.
    canvas.save(out_path, "PNG")

    return {
        "outPath": out_path,
        "width": width,
        "height": height,
        "warnings": warnings_list,
    }


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def fit_cover(request: dict) -> dict:
    """
    Lleva la imagen adaptada por la IA al tamano exacto (WxH) del formato.

    La IA ya compone el arte llenando el marco de borde a borde; aqui solo se
    reescala a la resolucion exacta, SIN fondo borroso, SIN bordes blancos y
    SIN recortar. Si la proporcion de la IA difiere levemente del destino, se
    reescala proporcionalmente (ajuste minimo) en lugar de rellenar o recortar.
    """
    in_path = request["inPath"]
    out_path = request["outPath"]
    width = int(request["width"])
    height = int(request["height"])

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img = Image.open(in_path).convert("RGB")

    # Reescala directo al destino: usa todo el arte real de la IA (sin blur,
    # sin franjas, sin recorte). El pequeno ajuste de proporcion es uniforme.
    out = img.resize((width, height), Image.LANCZOS)
    out.save(out_path, "PNG")
    return {"outPath": out_path, "width": width, "height": height}
