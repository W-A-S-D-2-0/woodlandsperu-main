import type { CatalogVariant } from '../../../shared/api/contracts'
import { WEB_ORDER_MAX_UNITS } from '../../../shared/api/public-schemas'
import { deliveryBands, deliveryUnknown } from '../../content/delivery'

/** Precio por cantidad y plazos estimados del catálogo público. Sin React: se prueba solo. */

/**
 * Precio unitario para una cantidad: aplica la escala con mayor cantidad mínima alcanzada; si no hay,
 * el precio publicado; si tampoco hay, null ("a cotizar"). Misma regla que la base de datos.
 */
export function resolveUnitPrice(variant: Pick<CatalogVariant, 'price' | 'priceTiers'>, quantity: number): number | null {
  const tier = variant.priceTiers
    .filter((t) => t.minQuantity <= quantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0]
  return tier ? tier.unitPrice : variant.price
}

export function lineTotal(unitPrice: number | null, quantity: number): number | null {
  return unitPrice === null ? null : Math.round(unitPrice * quantity * 100) / 100
}

/** Desde esta cantidad la web no cotiza: se deriva a WhatsApp. */
export const isOverWebLimit = (quantity: number) => quantity > WEB_ORDER_MAX_UNITS

/** Cantidad válida (entero ≥ 1) a partir de lo que escribió la persona; NaN si no lo es. */
export function parseQuantity(text: string): number {
  const trimmed = text.trim()
  return /^\d{1,6}$/.test(trimmed) && Number(trimmed) >= 1 ? Number(trimmed) : Number.NaN
}

/** Plazo estimado para una cantidad, sin stock real. Tramos sin definir: "por confirmar". */
export function deliveryEstimate(quantity: number): string {
  const band = deliveryBands.find((b) => quantity >= b.from && quantity <= b.to)
  return band?.estimate ?? deliveryUnknown
}
