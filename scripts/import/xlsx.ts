import { strFromU8, unzipSync } from 'fflate'

/**
 * Lector mínimo de la primera hoja de un .xlsx: valores en caché y fórmulas.
 * Suficiente para el inventario de Woodland (una hoja, texto y números); no evalúa fórmulas.
 */

export interface Cell {
  value: string | number | null
  formula: string | null
}

export type Sheet = Map<string, Cell>

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isNaN(code) ? match : String.fromCodePoint(code)
    }
    return ENTITIES[entity] ?? match
  })
}

/** Concatena todos los <t> de un fragmento (texto simple o con formato enriquecido). */
function textRuns(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1] ?? '')).join('')
}

function firstWorksheetPath(files: Record<string, Uint8Array>): string {
  const sheets = Object.keys(files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)?.[1]) - Number(b.match(/(\d+)\.xml$/)?.[1]))
  if (!sheets[0]) throw new Error('El archivo no contiene hojas de cálculo.')
  return sheets[0]
}

export function readFirstSheet(data: Uint8Array): Sheet {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data)
  } catch {
    throw new Error('No es un archivo .xlsx válido.')
  }

  const sharedXml = files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : ''
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1] ?? ''))

  const sheetXml = strFromU8(files[firstWorksheetPath(files)]!)
  const sheet: Sheet = new Map()

  for (const match of sheetXml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = match[1] ?? ''
    const body = match[2] ?? ''
    const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1]
    if (!ref) continue

    const type = attrs.match(/\bt="(\w+)"/)?.[1]
    const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    const formula = body.match(/<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/)?.[1]

    let value: string | number | null = null
    if (type === 's' && raw !== undefined) value = shared[Number(raw)] ?? null
    else if (type === 'inlineStr') value = textRuns(body)
    else if ((type === 'str' || type === 'e') && raw !== undefined) value = decodeXml(raw)
    else if (type === 'b' && raw !== undefined) value = raw === '1' ? 1 : 0
    else if (raw !== undefined && raw !== '') value = Number(raw)

    sheet.set(ref, { value, formula: formula !== undefined ? decodeXml(formula) : null })
  }

  return sheet
}

/** "B" → 2 */
export function columnIndex(letters: string): number {
  return [...letters].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0)
}

export function splitRef(ref: string): { column: string; row: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/)
  if (!match) throw new Error(`Referencia de celda inválida: ${ref}`)
  return { column: match[1]!, row: Number(match[2]) }
}
