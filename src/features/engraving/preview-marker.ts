import { engravingFonts, engravingLimits, engravingPositions, type EngravingFont, type EngravingPosition } from '../../content/engraving'

/**
 * Marcas que Teca escribe en sus respuestas para que el chat dibuje la tabla con el nombre grabado y el botón
 * de WhatsApp. Son líneas completas entre dobles corchetes; el chat las convierte en imágenes y botones, y el
 * resto del texto se muestra normal. Sin React: el servidor las arma y el navegador las lee.
 *
 *   [[vista|línea 1|línea 2|letra|posición,posición|modelo]]
 *   [[whatsapp|mensaje|consulta de la vista]]
 */

export interface PreviewMarker {
  kind: 'preview'
  line1: string
  line2: string
  font: EngravingFont
  positions: EngravingPosition[]
  model: string
}

export interface WhatsappMarker {
  kind: 'whatsapp'
  message: string
  /** Parámetros de la página /grabado con las vistas, para que Brigitte vea lo mismo que el cliente. */
  query: string
}

/** Quita lo que rompería la marca. */
const clean = (value: string, max: number) => value.replace(/[|[\]\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max)

const positionValues = new Set<string>(engravingPositions.map((p) => p.value))
const fontValues = new Set<string>(engravingFonts.map((f) => f.value))

export const positionLabel = (position: EngravingPosition) => engravingPositions.find((p) => p.value === position)?.label ?? position

/** Parámetros de /grabado: texto, letra, posiciones y modelo. */
export function previewQuery(p: { line1: string; line2?: string; font: EngravingFont; positions: readonly EngravingPosition[]; model?: string }): string {
  const params = new URLSearchParams({ t: clean(p.line1, engravingLimits.line1), f: p.font, p: p.positions.join(',') })
  if (p.line2) params.set('l', clean(p.line2, engravingLimits.line2))
  if (p.model) params.set('m', clean(p.model, 60))
  return params.toString()
}

export function buildPreviewMarker(p: { line1: string; line2?: string; font: EngravingFont; positions: readonly EngravingPosition[]; model?: string }): string {
  return `[[vista|${clean(p.line1, engravingLimits.line1)}|${clean(p.line2 ?? '', engravingLimits.line2)}|${p.font}|${p.positions.join(',')}|${clean(p.model ?? '', 60)}]]`
}

export function buildWhatsappMarker(message: string, query: string): string {
  return `[[whatsapp|${clean(message, 600)}|${query.replace(/[|[\]\r\n]/g, '')}]]`
}

/** Lee una línea del chat; null si no es una marca válida (se muestra como texto). */
export function parseMarkerLine(line: string): PreviewMarker | WhatsappMarker | null {
  const match = /^\[\[(vista|whatsapp)\|(.*)\]\]$/.exec(line.trim())
  if (!match) return null
  const parts = match[2]!.split('|')
  if (match[1] === 'vista') {
    const [line1 = '', line2 = '', font = 'classic', positions = '', model = ''] = parts
    const valid = positions.split(',').filter((p): p is EngravingPosition => positionValues.has(p))
    if (!line1.trim() || valid.length === 0) return null
    return { kind: 'preview', line1, line2, font: fontValues.has(font) ? (font as EngravingFont) : 'classic', positions: valid, model }
  }
  const [message = '', query = ''] = parts
  return message.trim() ? { kind: 'whatsapp', message, query } : null
}

/** Enlace de WhatsApp con el mensaje ya escrito (solo el texto: sin enlaces a otras páginas). */
export function whatsappUrl(number: string, marker: WhatsappMarker): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(marker.message)}`
}

/** Lo que trae /grabado en la dirección, validado. Null si no hay texto o posiciones. */
export function parseShareParams(search: string): PreviewMarker | null {
  const q = new URLSearchParams(search)
  const line1 = clean(q.get('t') ?? '', engravingLimits.line1)
  const positions = (q.get('p') ?? '').split(',').filter((p): p is EngravingPosition => positionValues.has(p))
  if (!line1 || positions.length === 0) return null
  const font = q.get('f') ?? ''
  return {
    kind: 'preview',
    line1,
    line2: clean(q.get('l') ?? '', engravingLimits.line2),
    font: fontValues.has(font) ? (font as EngravingFont) : 'classic',
    positions: positions.slice(0, 5),
    model: clean(q.get('m') ?? '', 60),
  }
}
