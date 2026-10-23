/**
 * Forma de cada tabla del catálogo oficial, para dibujar la vista previa del grabado con su silueta real.
 * Las proporciones salen de las medidas oficiales (docs/marca/CATALOGO-OFICIAL.md); no se inventa ningún
 * diseño. Es una vista de referencia: el grabado final lo confirma el equipo antes de producir.
 */

export type BoardKind = 'rect' | 'round' | 'paddle' | 'rounded-sides'

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
  // 40 × 16 cm.
  'bosques amazonicos': { kind: 'rect', ratio: 40 / 16, room: 80, inset: 7 },
  // 53 × 20 cm.
  huambrilla: { kind: 'rect', ratio: 53 / 20, room: 80, inset: 7 },
  // 30 × 18 cm, costados boleados.
  nanito: { kind: 'rounded-sides', ratio: 30 / 18, room: 70, inset: 11 },
}

const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** La silueta del modelo que se nombra («Ñañito», «Ya Vuelta»…); la genérica si no se conoce. */
export function boardShapeFor(model: string | undefined | null): BoardShape {
  return (model ? shapes[plain(model)] : undefined) ?? defaultBoardShape
}

export const knownBoardModels: readonly string[] = Object.keys(shapes)
