import type { CatalogPriceTier } from '../../../shared/api/contracts'

const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

/** Sin precio publicado se muestra "A cotizar" (decisión comercial vigente). */
export function formatPrice(price: number | null): string {
  return price === null ? 'A cotizar' : money.format(price)
}

export function tierLabel(tier: CatalogPriceTier): string {
  return `desde ${tier.minQuantity} u.: ${money.format(tier.unitPrice)} c/u`
}
