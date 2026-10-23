import type { InventoryLevel } from '../../../shared/api/panel-contracts'

/**
 * Alarma de stock bajo del panel. La base abre la alerta sola cuando lo disponible llega al mínimo de una variante;
 * el panel la vigila solo (cada ALARM_POLL_MS) y suena una vez por cada variante que baja, diciendo cuál es.
 * Sin React: la lógica se prueba sola.
 */

export const ALARM_POLL_MS = 30_000

const ANNOUNCED_KEY = 'woodland-panel-low-stock-announced'
const SOUND_KEY = 'woodland-panel-alarm-sound'

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Las variantes con stock bajo (alerta abierta o disponible en el mínimo o menos), las más escasas primero. */
export function lowStockItems(levels: readonly InventoryLevel[]): InventoryLevel[] {
  return levels
    .filter((l) => l.lowStock || (l.minStock !== null && l.available <= l.minStock))
    .sort((a, b) => a.available - b.available || a.product.localeCompare(b.product))
}

export const levelName = (level: Pick<InventoryLevel, 'product' | 'variant'>) => `${level.product} · ${level.variant}`

/** Las que deben sonar ahora: están bajas y todavía no se anunciaron. */
export function toAnnounce(low: readonly InventoryLevel[], announced: ReadonlySet<string>): InventoryLevel[] {
  return low.filter((l) => !announced.has(l.variantId))
}

/** Lo que se recuerda como ya anunciado: solo lo que sigue bajo. Al reponerse, si vuelve a bajar, suena de nuevo. */
export const nextAnnounced = (low: readonly InventoryLevel[]): Set<string> => new Set(low.map((l) => l.variantId))

const units = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`

/** Lo que dice la voz de la alarma. Los nombres van sin el punto medio para que se lean bien. */
export function spokenMessage(items: readonly InventoryLevel[]): string {
  const first = items[0]
  if (!first) return ''
  if (items.length === 1) return `Atención. Stock bajo: ${first.product} ${first.variant}. Quedan ${units(first.available)}.`
  const names = items.slice(0, 4).map((l) => `${l.product} ${l.variant}`)
  const more = items.length > 4 ? ` y ${items.length - 4} más` : ''
  return `Atención. ${items.length} productos con stock bajo: ${names.join(', ')}${more}.`
}

export function readAnnounced(store: Store | null): Set<string> {
  try {
    const raw = store?.getItem(ANNOUNCED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

export function writeAnnounced(store: Store | null, ids: ReadonlySet<string>): void {
  try {
    store?.setItem(ANNOUNCED_KEY, JSON.stringify([...ids]))
  } catch {
    // Sin almacenamiento: puede repetirse el aviso tras recargar, nada más.
  }
}

/** El sonido está activado salvo que la persona lo haya apagado. */
export function readSoundEnabled(store: Store | null): boolean {
  try {
    return store?.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function writeSoundEnabled(store: Store | null, enabled: boolean): void {
  try {
    store?.setItem(SOUND_KEY, enabled ? 'on' : 'off')
  } catch {
    // Sin almacenamiento: vale solo para esta visita.
  }
}
