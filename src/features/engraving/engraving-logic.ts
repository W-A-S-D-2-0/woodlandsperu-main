import {
  defaultEngravingPosition,
  engravingFonts,
  engravingLimits,
  engravingPositions,
  type EngravingFont,
  type EngravingPosition,
} from '../../content/engraving'

/** Lógica del personalizador de grabado. Sin React: se prueba sola. */

export interface EngravingValues {
  line1: string
  line2: string
  position: EngravingPosition
  font: EngravingFont
}

export const defaultEngraving: EngravingValues = { line1: '', line2: '', position: defaultEngravingPosition, font: 'classic' }

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

/** Texto que viaja a la cotización como personalización (máximo 1000 caracteres en la API). */
export function engravingSummary(values: EngravingValues): string {
  const v = normalizeEngraving(values)
  const lines = [`"${v.line1}"`, v.line2 ? `"${v.line2}"` : null].filter(Boolean).join(' / ')
  return `Grabado: ${lines} · Posición: ${label(engravingPositions, v.position)} · Letra: ${label(engravingFonts, v.font)}`
}

/** Ancho aproximado de un carácter respecto del tamaño de letra, por estilo (la moderna va en mayúsculas). */
const charWidth: Record<EngravingFont, number> = { classic: 0.56, italic: 0.52, modern: 0.82 }
const maxSize = { line1: 9, line2: 4.4 } as const

/** Tamaño de letra en unidades de ancho de la tabla (cqw) para que la línea quepa sin cortarse. */
export function engravingFontSize(text: string, font: EngravingFont, line: 'line1' | 'line2'): number {
  const fit = 80 / (Math.max(text.length, 1) * charWidth[font])
  return Math.round(Math.min(maxSize[line], fit) * 100) / 100
}
