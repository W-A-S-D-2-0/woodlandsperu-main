import type { InventoryLevel } from '../../../shared/api/panel-contracts'

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
