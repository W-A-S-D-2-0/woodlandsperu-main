import type { InventoryLevel, InventoryMovementType } from '../../../shared/api/panel-contracts'

/** Lógica de la pantalla de producción del taller. Sin React: se prueba sola. */

export const PRODUCTION_MAX = 10000

/** Cantidad de piezas terminadas: entero de 1 a PRODUCTION_MAX. NaN si no es válida. */
export function parseProductionQuantity(text: string): number {
  const trimmed = text.trim()
  const value = /^\d{1,6}$/.test(trimmed) ? Number(trimmed) : Number.NaN
  return value >= 1 && value <= PRODUCTION_MAX ? value : Number.NaN
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Filtra por producto, variante, medidas o SKU, sin distinguir mayúsculas ni tildes. */
export function filterLevels(levels: readonly InventoryLevel[], query: string): InventoryLevel[] {
  const q = normalize(query)
  if (!q) return [...levels]
  return levels.filter((l) => normalize(`${l.product} ${l.variant} ${l.dimensionsLabel ?? ''} ${l.sku}`).includes(q))
}

export interface ProductGroup {
  product: string
  levels: InventoryLevel[]
}

/** Agrupa por producto manteniendo el orden de aparición. */
export function groupByProduct(levels: readonly InventoryLevel[]): ProductGroup[] {
  const groups = new Map<string, InventoryLevel[]>()
  for (const level of levels) groups.set(level.product, [...(groups.get(level.product) ?? []), level])
  return [...groups].map(([product, items]) => ({ product, levels: items }))
}

export type StockState = 'out' | 'low' | 'ok'

/** Estado del stock en palabras: sin stock, bajo el mínimo o bien. Se mira lo libre para vender. */
export function stockStatus(level: Pick<InventoryLevel, 'available' | 'minStock' | 'lowStock'>): { state: StockState; label: string; tone: 'alert' | 'warn' | 'good' } {
  if (level.available <= 0) return { state: 'out', label: 'Sin stock', tone: 'alert' }
  if (level.lowStock || (level.minStock !== null && level.available <= level.minStock)) return { state: 'low', label: 'Bajo el mínimo', tone: 'warn' }
  return { state: 'ok', label: 'Bien', tone: 'good' }
}

/** «65*46*4» → «65 × 46 × 4 cm». */
export function formatDimensions(label: string | null): string | null {
  return label ? `${label.replaceAll('*', ' × ')} cm` : null
}

const urgency: Record<StockState, number> = { out: 0, low: 1, ok: 2 }

/** Primero lo que se agotó, luego lo que está bajo; el resto conserva su orden. */
export function sortByUrgency<T extends Pick<InventoryLevel, 'available' | 'minStock' | 'lowStock'>>(levels: readonly T[]): T[] {
  return levels
    .map((level, index) => ({ level, index, rank: urgency[stockStatus(level).state] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.level)
}

/** Signo de un movimiento según cómo cambia lo que hay en el taller («» si solo aparta o suelta). */
export function movementSign(type: InventoryMovementType): '+' | '−' | '' {
  if (type === 'production_in' || type === 'adjustment_in' || type === 'return_in') return '+'
  if (type === 'adjustment_out' || type === 'sale_out') return '−'
  return ''
}
