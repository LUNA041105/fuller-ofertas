import { readFileSync } from 'node:fs';
import { getApiKey } from './secrets';
import { getSetting } from './db';
import type { OfferRegion } from '../../src/shared/types';

// Cliente de OpenAI (vision) para interpretar el comentario del usuario en
// "Volver a generar" y traducirlo a AJUSTES DE COMPOSICION.
//
// IMPORTANTE (fidelidad): la IA NO redibuja ni regenera contenido. Solo observa
// la imagen y el comentario y devuelve parametros de composicion acotados
// (escala, margenes, posicion y tamano de la etiqueta). El motor de Python
// aplica esos parametros sobre los pixeles del arte original.

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';
// Modelo de EDICION de imagenes (reacomodo al formato, conservando elementos).
const DEFAULT_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

export interface CompositionAdjustments {
  contentScale: number; // 0.5..1.0 (1 = aprovecha todo el espacio)
  outerPadScale: number; // 0..3 (margen exterior)
  gapScale: number; // 0..4 (separacion entre spreads)
  labelFontScale: number; // 0.6..2.0 (tamano de la etiqueta)
  labelPosition: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  notes?: string; // explicacion breve de los cambios
}

/** Ajustes neutrales por defecto (sin cambios respecto a la composicion base). */
export const NEUTRAL_ADJUSTMENTS: CompositionAdjustments = {
  contentScale: 1.0,
  outerPadScale: 1.0,
  gapScale: 1.0,
  labelFontScale: 1.0,
  labelPosition: 'bottom-left',
};

const SYSTEM_PROMPT = `Eres un asistente de composicion grafica para piezas publicitarias.
Recibes una imagen ya compuesta (arte original del catalogo, NO debes redibujarla)
y un comentario del usuario que pide un ajuste visual.
Tu tarea es traducir ese comentario a PARAMETROS DE COMPOSICION, sin inventar ni
modificar precios, textos, productos ni empaques.
Responde UNICAMENTE con un objeto JSON con estas claves:
- contentScale (0.5 a 1.0): cuanto ocupa el contenido dentro de su banda. Si piden
  "mas grande el precio/producto" acerca a 1.0; si piden "mas aire/margen" baja el valor.
- outerPadScale (0 a 3): margen exterior. Mas margen = valor mayor.
- gapScale (0 a 4): separacion entre ofertas apiladas.
- labelFontScale (0.6 a 2.0): tamano de la etiqueta de ubicacion.
- labelPosition: una de "bottom-left","bottom-right","top-left","top-right".
- notes: explicacion breve (una frase) de que ajustaste.
No agregues texto fuera del JSON.`;

/**
 * Interpreta el comentario sobre la imagen actual y devuelve ajustes.
 * Lanza error si no hay API key o falla la llamada.
 */
export async function interpretInstruction(
  imagePath: string,
  instruction: string
): Promise<CompositionAdjustments> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'No hay clave de OpenAI configurada. Agregala en Ajustes o define OPENAI_API_KEY.'
    );
  }
  const model = getSetting('openai_model') || DEFAULT_MODEL;

  // Imagen como data URL (base64) para enviarla al modelo de vision.
  const b64 = readFileSync(imagePath).toString('base64');
  const dataUrl = `data:image/png;base64,${b64}`;

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Comentario del usuario: ${instruction}` },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI devolvio ${resp.status}: ${txt.slice(0, 300)}`);
  }

  const json = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Respuesta vacia de OpenAI.');

  let parsed: Partial<CompositionAdjustments>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI no devolvio un JSON valido.');
  }

  // Normaliza y acota los valores recibidos.
  return {
    contentScale: clamp(num(parsed.contentScale, 1.0), 0.5, 1.0),
    outerPadScale: clamp(num(parsed.outerPadScale, 1.0), 0, 3),
    gapScale: clamp(num(parsed.gapScale, 1.0), 0, 4),
    labelFontScale: clamp(num(parsed.labelFontScale, 1.0), 0.6, 2.0),
    labelPosition: isValidPosition(parsed.labelPosition)
      ? parsed.labelPosition!
      : 'bottom-left',
    notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
  };
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? fallback : n;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function isValidPosition(v: unknown): v is CompositionAdjustments['labelPosition'] {
  return (
    v === 'bottom-left' ||
    v === 'bottom-right' ||
    v === 'top-left' ||
    v === 'top-right'
  );
}

// ===== Adaptacion generativa al formato (reacomodo, sin quitar/agregar) =====

import type { AspectFormat } from '../../src/shared/types';

/** Tamano de edicion de gpt-image mas cercano a cada proporcion. */
function editSizeFor(format: AspectFormat): string {
  if (format === '1:1') return '1024x1024';
  // 4:5 y 9:16 son verticales: el tamano vertical soportado es 1024x1536.
  return '1024x1536';
}

function adaptPrompt(format: AspectFormat): string {
  const orient =
    format === '1:1'
      ? 'un cuadro cuadrado'
      : 'un marco vertical alto (tipo historia de celular)';
  return `Readapta esta pieza publicitaria del catalogo Fuller para que ocupe
COMPLETAMENTE ${orient} con relacion de aspecto ${format}.

El arte debe EXTENDERSE y REORGANIZARSE para llenar TODO el encuadre, borde a
borde. NO dejes fondos vacios, NO dejes franjas ni bordes blancos, NO uses un
fondo borroso ni barras: extiende el fondo real (colores, texturas, elementos
graficos del propio arte) hasta cubrir todo el marco.

REGLAS ESTRICTAS (obligatorias):
- Conserva TODOS los elementos existentes: productos, modelos, precios,
  porcentajes, claims, copys, encabezados, logotipos y frases.
- NO elimines ni agregues productos, textos, precios ni elementos nuevos.
- NO cambies el concepto, los colores de marca ni el significado.
- Reproduce los textos EXACTAMENTE igual (mismas palabras, mismos numeros,
  mismo espaciado entre letras y palabras). No separes ni juntes letras.
- Tienes libertad para mover, redistribuir y reescalar (mas grande o mas
  pequeno) los elementos existentes y ampliar el fondo para que todo encaje
  de forma equilibrada y legible en ${format}.
El resultado es la MISMA oferta, reorganizada y ampliada para llenar ${format}.`;
}

/**
 * Adapta (reacomoda con IA de edicion) una imagen compuesta al formato indicado,
 * llenando el encuadre sin bordes blancos y conservando todos los elementos.
 * Si se pasa `instruction`, se agrega como peticion de cambio del usuario.
 * Devuelve el buffer PNG resultante. Lanza error si no hay API key o falla.
 */
export async function adaptImageToFormat(
  imagePath: string,
  format: AspectFormat,
  instruction?: string
): Promise<Buffer> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'No hay clave de OpenAI configurada. Agregala en Ajustes o define OPENAI_API_KEY.'
    );
  }
  const model = getSetting('openai_image_model') || DEFAULT_IMAGE_MODEL;

  let prompt = adaptPrompt(format);
  if (instruction && instruction.trim()) {
    prompt +=
      `\n\nADEMAS, aplica este cambio solicitado por el usuario, SIN eliminar ni ` +
      `agregar elementos y conservando todos los textos y precios exactos:\n` +
      `"${instruction.trim()}"`;
  }

  const bytes = readFileSync(imagePath);
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', editSizeFor(format));
  // La imagen de referencia a editar.
  form.append(
    'image',
    new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
    'input.png'
  );

  const resp = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI (imagen) devolvio ${resp.status}: ${txt.slice(0, 300)}`);
  }

  const json = (await resp.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const b64 = json.data?.[0]?.b64_json;
  if (b64) return Buffer.from(b64, 'base64');

  // Algunos modelos devuelven URL en lugar de base64.
  const url = json.data?.[0]?.url;
  if (url) {
    const img = await fetch(url);
    if (!img.ok) throw new Error('No se pudo descargar la imagen generada.');
    return Buffer.from(await img.arrayBuffer());
  }
  throw new Error('OpenAI no devolvio ninguna imagen.');
}

// ===== Deteccion de ofertas/spreads en una pagina =====

const DETECT_PROMPT = `Eres un asistente que LOCALIZA ofertas dentro de una pagina
de catalogo. La imagen puede contener varias ofertas o spreads (bloques
rectangulares, cada uno con su producto, precio y textos).

Tu unica tarea es DETECTAR y CONTAR esos bloques y devolver sus coordenadas.
NO redibujes, NO inventes, NO describas productos ni precios.

Ignora encabezados generales de la pagina (p. ej. el titulo "OFERTAS A
CONSUMIDOR" o el logo) salvo que formen parte de un bloque de oferta.

Responde UNICAMENTE con un objeto JSON con esta forma:
{
  "regions": [
    { "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0, "label": "texto breve" }
  ]
}
Donde x,y,w,h son fracciones (0 a 1) respecto al ancho y alto de la imagen:
- x,y = esquina superior izquierda del bloque.
- w,h = ancho y alto del bloque.
Incluye un "label" corto y neutro por bloque (ej "oferta 1") solo para
identificarlo. No agregues texto fuera del JSON.`;

/**
 * Detecta las regiones de ofertas/spreads en una imagen de pagina.
 * Devuelve regiones normalizadas (0..1). Lanza error si no hay API key.
 */
export async function detectOfferRegions(
  imagePath: string
): Promise<OfferRegion[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'No hay clave de OpenAI configurada. Agregala en Ajustes o define OPENAI_API_KEY.'
    );
  }
  const model = getSetting('openai_model') || DEFAULT_MODEL;

  const b64 = readFileSync(imagePath).toString('base64');
  const dataUrl = `data:image/png;base64,${b64}`;

  const body = {
    model,
    messages: [
      { role: 'system', content: DETECT_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Detecta todas las ofertas/spreads de esta pagina y devuelve sus coordenadas.',
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI devolvio ${resp.status}: ${txt.slice(0, 300)}`);
  }

  const json = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Respuesta vacia de OpenAI.');

  let parsed: { regions?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI no devolvio un JSON valido.');
  }

  const raw = Array.isArray(parsed.regions) ? parsed.regions : [];
  const regions: OfferRegion[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const x = clamp(num(r.x, 0), 0, 1);
    const y = clamp(num(r.y, 0), 0, 1);
    let w = clamp(num(r.w, 0), 0, 1);
    let h = clamp(num(r.h, 0), 0, 1);
    // Recorta para que no se salga de la pagina.
    w = Math.min(w, 1 - x);
    h = Math.min(h, 1 - y);
    // Descarta regiones demasiado pequenas (ruido).
    if (w < 0.03 || h < 0.03) continue;
    regions.push({
      x,
      y,
      w,
      h,
      label: typeof r.label === 'string' ? r.label : undefined,
    });
  }
  return regions;
}
