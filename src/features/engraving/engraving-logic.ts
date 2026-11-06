import {
  defaultEngravingPosition,
  engravingAligns,
  engravingFonts,
  engravingLimits,
  engravingMotifs,
  engravingPositions,
  engravingSizes,
  naturalAlign,
  type EngravingAlign,
  type EngravingFont,
  type EngravingMotif,
  type EngravingPosition,
  type EngravingSizes,
} from '../../content/engraving'

/** Lógica del personalizador de grabado. Sin React: se prueba sola. */

/** Cómo se acomoda el texto: qué línea va más grande, hacia dónde se alinea y si lleva un dibujo. */
export interface EngravingStyle {
  sizes: EngravingSizes
  /** null: la que corresponde a la posición (a la derecha en las esquinas derechas, etc.). */
  align: EngravingAlign | null
  motif: EngravingMotif
}

export const defaultEngravingStyle: EngravingStyle = { sizes: 'top', align: null, motif: 'none' }

export interface EngravingValues extends EngravingStyle {
  line1: string
  line2: string
  position: EngravingPosition
  font: EngravingFont
}

export const defaultEngraving: EngravingValues = { line1: '', line2: '', position: defaultEngravingPosition, font: 'classic', ...defaultEngravingStyle }

/** Quita saltos de línea y espacios repetidos; recorta al largo permitido. */
export function cleanLine(value: string, max: number): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').slice(0, max)
}

export function normalizeEngraving(values: EngravingValues): EngravingValues {
  return {
    ...values,
    line1: cleanLine(values.line1.trim(), engravingLimits.line1).trim(),
    line2: cleanLine(values.line2.trim(), engravingLimits.line2).trim(),
  }
}

export const hasEngravingText = (values: EngravingValues) => normalizeEngraving(values).line1 !== ''

const label = <T extends string>(options: readonly { value: T; label: string }[], value: T) =>
  options.find((o) => o.value === value)?.label ?? value

/** La alineación que se ve: la elegida o, si no eligió, la de la posición. */
export const effectiveAlign = (style: Pick<EngravingStyle, 'align'>, position: EngravingPosition): EngravingAlign => style.align ?? naturalAlign(position)

/**
 * Lo que el estilo agrega al resumen, solo si se cambió: «Tamaño: Abajo más grande · Alineación: Centro · Dibujo: Gorro de chef».
 * Sin cambios el resumen queda como siempre (arriba más grande, alineado según la posición, sin dibujo).
 */
function styleSummary(v: EngravingValues): string[] {
  return [
    v.line2 && v.sizes !== defaultEngravingStyle.sizes ? `Tamaño: ${label(engravingSizes, v.sizes)}` : null,
    v.align ? `Alineación: ${label(engravingAligns, v.align)}` : null,
    v.motif !== 'none' ? `Dibujo: ${label(engravingMotifs, v.motif)}` : null,
  ].filter((part): part is string => part !== null)
}

/** Texto que viaja a la cotización como personalización (máximo 1000 caracteres en la API). */
export function engravingSummary(values: EngravingValues): string {
  const v = normalizeEngraving(values)
  const lines = [`"${v.line1}"`, v.line2 ? `"${v.line2}"` : null].filter(Boolean).join(' / ')
  return [`Grabado: ${lines}`, `Posición: ${label(engravingPositions, v.position)}`, `Letra: ${label(engravingFonts, v.font)}`, ...styleSummary(v)].join(' · ')
}

const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** El estilo que trae un resumen de «Para ti» (lo contrario de engravingSummary); lo que no dice queda como siempre. */
export function styleFromSummary(text: string): EngravingStyle {
  const n = plain(text)
  const pick = <T extends string>(key: string, options: readonly { value: T; label: string }[]) =>
    options.find((o) => n.includes(`${key}: ${plain(o.label)}`))?.value
  return {
    sizes: pick('tamano', engravingSizes) ?? defaultEngravingStyle.sizes,
    align: pick('alineacion', engravingAligns) ?? null,
    motif: pick('dibujo', engravingMotifs) ?? 'none',
  }
}

const alignPhrase: Record<EngravingAlign, string> = { left: 'alineado a la izquierda', center: 'centrado', right: 'alineado a la derecha' }

/** El estilo en pocas palabras para el pedido («abajo más grande · centrado · dibujo: gorro de chef»); vacío si es el de siempre. */
export function styleDetails(style: EngravingStyle, hasLine2: boolean): string[] {
  return [
    hasLine2 && style.sizes !== 'top' ? label(engravingSizes, style.sizes).toLowerCase() : null,
    style.align ? alignPhrase[style.align] : null,
    style.motif !== 'none' ? `dibujo: ${label(engravingMotifs, style.motif).toLowerCase()}` : null,
  ].filter((part): part is string => part !== null)
}

/** El estilo dentro de una marca o un enlace: «bottom,center,chef-hat» (la alineación vacía sigue a la posición). */
export function encodeStyle(style: EngravingStyle): string {
  return `${style.sizes},${style.align ?? ''},${style.motif}`
}

const sizeValues = new Set<string>(engravingSizes.map((o) => o.value))
const alignValues = new Set<string>(engravingAligns.map((o) => o.value))
const motifValues = new Set<string>(engravingMotifs.map((o) => o.value))

/** Lee el estilo de una marca o un enlace; lo que falta o no es válido queda como siempre (las marcas viejas no lo traen). */
export function decodeStyle(value: string | null | undefined): EngravingStyle {
  const [sizes = '', align = '', motif = ''] = (value ?? '').split(',').map((part) => part.trim())
  return {
    sizes: sizeValues.has(sizes) ? (sizes as EngravingSizes) : defaultEngravingStyle.sizes,
    align: alignValues.has(align) ? (align as EngravingAlign) : null,
    motif: motifValues.has(motif) ? (motif as EngravingMotif) : 'none',
  }
}

/** Ancho aproximado de un carácter respecto del tamaño de letra, por estilo (la moderna va en mayúsculas). */
const charWidth: Record<EngravingFont, number> = { classic: 0.56, italic: 0.52, modern: 0.82 }
/** Tope del tamaño, en unidades de ancho de la tabla: la línea destacada, la secundaria y las dos iguales. */
const maxSize = { big: 9, small: 4.4, same: 6.2 } as const

/** Qué tamaño le toca a una línea según lo que se eligió: la de arriba más grande (lo de siempre), la de abajo o iguales. */
export function lineRole(line: 'line1' | 'line2', sizes: EngravingSizes = 'top', hasLine2 = true): keyof typeof maxSize {
  if (!hasLine2) return 'big'
  if (sizes === 'same') return 'same'
  return (line === 'line1') === (sizes === 'top') ? 'big' : 'small'
}

/** Tamaño de letra en unidades de ancho de la tabla (cqw) para que la línea quepa sin cortarse. */
export function engravingFontSize(text: string, font: EngravingFont, line: 'line1' | 'line2', room = 80, sizes: EngravingSizes = 'top', hasLine2 = true): number {
  const fit = room / (Math.max(text.length, 1) * charWidth[font])
  return Math.round(Math.min(maxSize[lineRole(line, sizes, hasLine2)], fit) * 100) / 100
}
