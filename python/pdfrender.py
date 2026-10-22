"""
Motor de renderizado de PDF basado en pypdfium2 (PDFium de Google/Foxit).

Se eligio PDFium sobre PyMuPDF porque se empaqueta de forma mucho mas confiable
con PyInstaller (PyMuPDF causaba un access violation 0xC0000005 en el binario
congelado). PDFium es una libreria liberal (BSD/Apache) y multiplataforma.

Todas las funciones devuelven imagenes PIL en RGB. NO se redibuja contenido.
"""

import pypdfium2 as pdfium
from PIL import Image

# 72 pt = 1 pulgada. scale = dpi/72 convierte puntos a pixeles.
PT_PER_INCH = 72.0


def pdf_page_count(path: str) -> int:
    pdf = pdfium.PdfDocument(path)
    try:
        return len(pdf)
    finally:
        pdf.close()


def pdf_page_sizes(path: str) -> list[tuple[float, float]]:
    """Devuelve (ancho, alto) en puntos de cada pagina."""
    pdf = pdfium.PdfDocument(path)
    try:
        sizes = []
        for i in range(len(pdf)):
            page = pdf[i]
            w, h = page.get_size()
            sizes.append((float(w), float(h)))
            page.close()
        return sizes
    finally:
        pdf.close()


def render_pdf_page(path: str, page_index: int, dpi: int) -> Image.Image:
    """Rasteriza una pagina de PDF a una imagen PIL RGB al DPI indicado."""
    pdf = pdfium.PdfDocument(path)
    try:
        if page_index < 0 or page_index >= len(pdf):
            raise IndexError(f"Indice de pagina fuera de rango: {page_index}")
        page = pdf[page_index]
        scale = dpi / PT_PER_INCH
        bitmap = page.render(scale=scale)
        img = bitmap.to_pil().convert("RGB")
        page.close()
        return img
    finally:
        pdf.close()
