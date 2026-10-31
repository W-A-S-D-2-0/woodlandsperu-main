/**
 * Forma de cada tabla del catálogo oficial, para dibujar la vista previa del grabado con su silueta real.
 * Las proporciones salen de las medidas oficiales (docs/marca/CATALOGO-OFICIAL.md); no se inventa ningún
 * diseño. Es una vista de referencia: el grabado final lo confirma el equipo antes de producir.
 */

export type BoardKind = 'rect' | 'round' | 'paddle' | 'rounded-sides' | 'hole' | 'handle'

export interface BoardShape {
  kind: BoardKind
  /** Ancho / alto de la tabla (medidas oficiales). */
  ratio: number
  /** Cuánto espacio hay para el texto, en % del ancho de la tabla (la redonda y la del canal dan menos). */
  room: number
  /** Separación del texto al borde, en % (las tablas con canal o redondas necesitan más). */
  inset: number
  /** Moshaco: canal para jugos alrededor. */
  groove?: boolean
  /** Ñañito: hueco rectangular arriba para tomarla. */
  slot?: boolean
  /** Ñañito: madera marrón oscura. */
  dark?: boolean
}

/** Tabla genérica (modelo sin definir): la misma vista de siempre. */
export const defaultBoardShape: BoardShape = { kind: 'rect', ratio: 3 / 2, room: 80, inset: 8 }

const shapes: Record<string, BoardShape> = {
  // 65 × 46 cm · 50 × 38 · 35 × 25, con canal para jugos.
  moshaco: { kind: 'rect', ratio: 65 / 46, room: 66, inset: 13, groove: true },
  // Circunferencia de 40 cm.
  'ya vuelta': { kind: 'round', ratio: 1, room: 50, inset: 19 },
  // 52 × 30 cm con el mango incluido: la hoja va a la izquierda y el mango a la derecha.
  'sacha paleta': { kind: 'paddle', ratio: 52 / 30, room: 76, inset: 9 },
  // 40 × 16 cm, acostada: el extremo derecho redondeado con un agujero redondo (como en su foto).
  'bosques amazonicos': { kind: 'hole', ratio: 40 / 16, room: 80, inset: 8 },
  // 53 × 20 cm con el mango incluido: la tabla a la izquierda y el mango a la derecha (como en su foto).
  huambrilla: { kind: 'handle', ratio: 53 / 20, room: 80, inset: 7 },
  // 30 × 18 cm, de madera marrón oscura y con un hueco rectangular arriba para tomarla (como en su foto).
  nanito: { kind: 'rect', ratio: 30 / 18, room: 72, inset: 10, slot: true, dark: true },
}

const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** La silueta del modelo que se nombra («Ñañito», «Ya Vuelta»…); la genérica si no se conoce. */
export function boardShapeFor(model: string | undefined | null): BoardShape {
  return (model ? shapes[plain(model)] : undefined) ?? defaultBoardShape
}

export const knownBoardModels: readonly string[] = Object.keys(shapes)

/** Ancho y alto (cm) de una medida del catálogo («65*46*4» → 65 × 46); null si no trae ancho, alto y espesor (la redonda trae diámetro y espesor). */
export function boardSize(dimensionsLabel: string | null | undefined): { width: number; height: number } | null {
  const parts = (dimensionsLabel ?? '').split('*').map((n) => Number(n.replace(',', '.')))
  const [width, height] = parts
  return parts.length >= 3 && width && height ? { width, height } : null
}

/**
 * La silueta de un modelo en una medida concreta: las rectangulares toman la proporción de esa medida (la Moshaco
 * Small es más alargada que la Large); la redonda y la de mango mantienen su forma.
 */
export function boardShapeForSize(model: string | undefined | null, dimensionsLabel: string | null | undefined): BoardShape {
  const shape = boardShapeFor(model)
  const size = boardSize(dimensionsLabel)
  if (!size || (shape.kind !== 'rect' && shape.kind !== 'rounded-sides' && shape.kind !== 'hole' && shape.kind !== 'handle') || !model) return shape
  return { ...shape, ratio: size.width / size.height }
}

/**
 * Qué tan grande se dibuja una tabla respecto de la más grande del catálogo (1 = la más grande), para que se note la
 * diferencia real entre medidas. Nunca baja de `min`: así el grabado de una tabla chica se sigue leyendo.
 */
export function boardScale(dimensionsLabel: string | null | undefined, largestWidth: number, min = 0.5): number {
  const size = boardSize(dimensionsLabel)
  if (!size || largestWidth <= 0) return 1
  return Math.max(min, Math.min(1, size.width / largestWidth))
}
